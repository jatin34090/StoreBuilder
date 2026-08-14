import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { Prisma, OrderStatus, DeliveryStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { QueryOrdersDto } from './dto/query-orders.dto';
import type { CancelOrderDto } from './dto/cancel-order.dto';
import type { ReturnOrderDto } from './dto/return-order.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { AssignDeliveryDto } from './dto/assign-delivery.dto';
import type { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { CouponsService } from '../coupons/coupons.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantService } from '../tenant/tenant.service';
import { EventsGateway, WsEvents } from '../events/events.gateway';
import { NotificationType } from '@jewellery/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';
const FREE_SHIPPING_THRESHOLD = 999;
const SHIPPING_CHARGE = 49;
const TRANSACTION_TIMEOUT_MS = 10_000;

// ─── Status machine ───────────────────────────────────────────────────────────

const VALID_ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]:          [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]:        [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]:       [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]:          [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]:        [OrderStatus.RETURN_REQUESTED],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED],
  [OrderStatus.RETURNED]:         [OrderStatus.REFUNDED],
};

const DELIVERY_AGENT_TRANSITIONS: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  [DeliveryStatus.ASSIGNED]:         [DeliveryStatus.PICKED_UP],
  [DeliveryStatus.PICKED_UP]:        [DeliveryStatus.IN_TRANSIT],
  [DeliveryStatus.IN_TRANSIT]:       [DeliveryStatus.OUT_FOR_DELIVERY],
  [DeliveryStatus.OUT_FOR_DELIVERY]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
};

const CUSTOMER_CANCELLABLE = new Set<OrderStatus>([OrderStatus.PENDING, OrderStatus.CONFIRMED]);

// ─── Select shapes ────────────────────────────────────────────────────────────

const ORDER_SUMMARY_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  subtotal: true,
  discountAmount: true,
  shippingCharge: true,
  total: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  address: { select: { name: true, line1: true, city: true, state: true, pincode: true, phone: true } },
  items: {
    select: { id: true, name: true, sku: true, price: true, quantity: true, image: true, variantId: true },
  },
  payment: { select: { id: true, method: true, status: true, gateway: true, razorpayOrderId: true, paidAt: true } },
  delivery: {
    select: { id: true, type: true, status: true, agentId: true, provider: true, awbCode: true, trackingUrl: true, estimatedAt: true },
  },
  coupon: { select: { code: true, type: true, value: true } },
} as const;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
    @Inject(forwardRef(() => PaymentsService)) private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly tenant: TenantService,
    private readonly gateway: EventsGateway,
  ) {}

  // ─── Customer: Place Order ─────────────────────────────────────────────────

  async placeOrder(userId: string, dto: CreateOrderDto, storeId = DEFAULT_STORE_ID) {
    // 0. Enforce monthly order quota before doing anything else
    await this.tenant.checkOrderQuota(storeId);

    // 1. Validate address ownership
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
    });
    if (!address) throw new NotFoundException('Delivery address not found');

    // 2. Fetch all variants with product info + primary image in one query
    const variantIds = dto.items.map((i) => i.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        sku: true,
        price: true,
        stock: true,
        product: {
          select: {
            id: true,
            name: true,
            isActive: true,
            images: {
              where: { isPrimary: true },
              select: { url: true },
              take: 1,
            },
          },
        },
      },
    });

    // 3. Validate every requested variant exists, is active, and has stock
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    for (const item of dto.items) {
      const variant = variantMap.get(item.variantId);
      if (!variant) throw new BadRequestException(`Variant ${item.variantId} not found`);
      if (!variant.product.isActive) {
        throw new BadRequestException(`Product "${variant.product.name}" is not available`);
      }
      if (variant.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${variant.product.name}" (SKU: ${variant.sku}). ` +
          `Requested: ${item.quantity}, Available: ${variant.stock}`,
        );
      }
    }

    // 4. Compute amounts
    const subtotal = dto.items.reduce((sum, item) => {
      const price = Number(variantMap.get(item.variantId)!.price);
      return sum + price * item.quantity;
    }, 0);

    const shippingCharge = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CHARGE;

    // 5. Validate and apply coupon
    let discountAmount = 0;
    let couponId: string | undefined;
    if (dto.couponCode) {
      const couponResult = await this.coupons.validate({
        code: dto.couponCode,
        orderSubtotal: subtotal,
      });
      discountAmount = couponResult.discountAmount;
      couponId = couponResult.coupon.id;
    }

    const total = Math.max(0, subtotal + shippingCharge - discountAmount);

    // 6. Create Razorpay order for non-COD payments (delegated to PaymentsService)
    let razorpayOrderId: string | null = null;
    if (dto.paymentMethod !== PaymentMethod.COD) {
      razorpayOrderId = await this.payments.createRazorpayOrder(total, `rcpt_${Date.now()}`);
    }

    // 7. Atomic DB transaction: create order, items, payment, delivery; decrement stock
    const order = await this.prisma.$transaction(
      async (tx) => {
        // Create order record
        const newOrder = await tx.order.create({
          data: {
            storeId,
            userId,
            addressId: dto.addressId,
            status: dto.paymentMethod === PaymentMethod.COD ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
            subtotal: new Prisma.Decimal(subtotal),
            discountAmount: new Prisma.Decimal(discountAmount),
            shippingCharge: new Prisma.Decimal(shippingCharge),
            total: new Prisma.Decimal(total),
            couponId: couponId ?? null,
            notes: dto.notes ?? null,
          },
          select: { id: true, orderNumber: true, status: true, total: true },
        });

        // Create order items with product snapshots
        await tx.orderItem.createMany({
          data: dto.items.map((item) => {
            const v = variantMap.get(item.variantId)!;
            return {
              orderId: newOrder.id,
              variantId: item.variantId,
              name: v.product.name,
              sku: v.sku,
              price: v.price,
              quantity: item.quantity,
              image: v.product.images[0]?.url ?? '',
            };
          }),
        });

        // Create payment record
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            method: dto.paymentMethod,
            gateway: dto.paymentMethod === PaymentMethod.COD ? 'cod' : 'razorpay',
            razorpayOrderId,
            amount: new Prisma.Decimal(total),
            // COD stays PENDING until agent collects and admin confirms remittance
            status: 'PENDING',
            paidAt: null,
          },
        });

        // Create delivery record
        await tx.delivery.create({
          data: {
            orderId: newOrder.id,
            type: dto.deliveryType,
            status: DeliveryStatus.PENDING,
          },
        });

        // Atomically decrement stock for each variant
        for (const item of dto.items) {
          const result = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (result.count === 0) {
            // Another concurrent request grabbed the last stock — rollback via throw
            const variant = variantMap.get(item.variantId)!;
            throw new BadRequestException(
              `Stock was exhausted for "${variant.product.name}" during checkout. Please try again.`,
            );
          }
        }

        // Consume coupon (increment usedCount)
        if (couponId) {
          await tx.coupon.update({
            where: { id: couponId },
            data: { usedCount: { increment: 1 } },
          });
        }

        // Clear customer cart after successful order
        await tx.cartItem.deleteMany({ where: { userId } });

        return newOrder;
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );

    // Fire-and-forget: increment order counter after successful placement
    this.tenant.incrementOrderCount(storeId).catch((e) =>
      this.logger.warn(`Failed to increment orderCount for store ${storeId}: ${(e as Error).message}`),
    );

    this.emitOrderEvent(WsEvents.ORDER_PLACED, { orderId: order.id, storeId, userId, total });

    this.logger.log(
      `Order placed: ${order.orderNumber} by user ${userId}. Total: ₹${total}. ` +
      `Method: ${dto.paymentMethod}. RzpOrderId: ${razorpayOrderId ?? 'COD'}`,
    );

    return {
      order,
      payment: {
        razorpayOrderId,
        razorpayKeyId: razorpayOrderId ? this.payments.getRazorpayKeyId() : null,
        isCod: dto.paymentMethod === PaymentMethod.COD,
      },
    };
  }

  // ─── Customer: List My Orders ──────────────────────────────────────────────

  async findMyOrders(userId: string, dto: QueryOrdersDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = { userId };
    if (dto.status) where.status = dto.status;
    if (dto.from || dto.to) {
      where.createdAt = {
        ...(dto.from && { gte: new Date(dto.from) }),
        ...(dto.to && { lte: new Date(dto.to) }),
      };
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: ORDER_SUMMARY_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, pagination: { page, limit, total } };
  }

  // ─── Customer: Single Order ────────────────────────────────────────────────

  async findMyOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: ORDER_SUMMARY_SELECT,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ─── Customer: Cancel ─────────────────────────────────────────────────────

  async cancelOrder(userId: string, orderId: string, dto: CancelOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (!CUSTOMER_CANCELLABLE.has(order.status)) {
      throw new BadRequestException(
        `Cannot cancel an order with status "${order.status}". Only PENDING or CONFIRMED orders can be cancelled.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED, notes: `Cancelled by customer: ${dto.reason}` },
      });

      // Restore stock
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    });

    this.emitOrderEvent(WsEvents.ORDER_CANCELLED, { orderId, userId });
    this.logger.log(`Order ${order.orderNumber} cancelled by customer ${userId}. Reason: ${dto.reason}`);

    return { message: 'Order cancelled successfully' };
  }

  // ─── Customer: Return Request ──────────────────────────────────────────────

  async requestReturn(userId: string, orderId: string, dto: ReturnOrderDto) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Return can only be requested for DELIVERED orders');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.RETURN_REQUESTED, notes: `Return requested: ${dto.reason}` },
    });

    this.emitOrderEvent(WsEvents.ORDER_RETURN_REQUESTED, { orderId, userId });
    this.logger.log(`Return requested for order ${order.orderNumber} by user ${userId}. Reason: ${dto.reason}`);

    return { message: 'Return request submitted successfully' };
  }

  // ─── Admin: List All Orders ────────────────────────────────────────────────

  async adminListOrders(dto: QueryOrdersDto, storeId = DEFAULT_STORE_ID) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = { storeId };
    if (dto.status) where.status = dto.status;
    if (dto.from || dto.to) {
      where.createdAt = {
        ...(dto.from && { gte: new Date(dto.from) }),
        ...(dto.to && { lte: new Date(dto.to) }),
      };
    }
    if (dto.search) {
      where.OR = [
        { orderNumber: { contains: dto.search, mode: 'insensitive' } },
        { user: { name: { contains: dto.search, mode: 'insensitive' } } },
        { user: { phone: { contains: dto.search } } },
        { user: { email: { contains: dto.search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: {
          ...ORDER_SUMMARY_SELECT,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, pagination: { page, limit, total } };
  }

  // ─── Admin: Get Single Order ───────────────────────────────────────────────

  async adminGetOrder(orderId: string, storeId = DEFAULT_STORE_ID) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      select: {
        ...ORDER_SUMMARY_SELECT,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ─── Admin: Update Order Status ────────────────────────────────────────────

  async adminUpdateStatus(orderId: string, dto: UpdateOrderStatusDto, storeId = DEFAULT_STORE_ID) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const allowed = VALID_ADMIN_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from "${order.status}" to "${dto.status}". ` +
        `Allowed: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: dto.status,
          ...(dto.notes && { notes: dto.notes }),
        },
      });

      // Restore stock on admin cancellation
      if (dto.status === OrderStatus.CANCELLED) {
        for (const item of order.items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      // Mark delivery as delivered
      if (dto.status === OrderStatus.DELIVERED) {
        await tx.delivery.updateMany({
          where: { orderId },
          data: { status: DeliveryStatus.DELIVERED, deliveredAt: new Date() },
        });
      }
    });

    this.emitOrderEvent(WsEvents.ORDER_STATUS_CHANGED, { orderId, storeId, status: dto.status });
    this.logger.log(`Order ${order.orderNumber} status → ${dto.status}`);

    return { message: `Order status updated to ${dto.status}` };
  }

  // ─── Admin: Assign Delivery ────────────────────────────────────────────────

  async adminAssignDelivery(orderId: string, storeId: string, dto: AssignDeliveryDto) {
    // Verify the order belongs to this store before touching its delivery record
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { storeId: true },
    });
    if (!order || order.storeId !== storeId) throw new NotFoundException('Order not found');

    const delivery = await this.prisma.delivery.findUnique({ where: { orderId } });
    if (!delivery) throw new NotFoundException('Delivery record not found for this order');

    if (delivery.status !== DeliveryStatus.PENDING && delivery.status !== DeliveryStatus.ASSIGNED) {
      throw new BadRequestException(
        `Cannot reassign delivery with status "${delivery.status}"`,
      );
    }

    // Validate agent exists and is online when assigning SELF delivery
    if (dto.agentId) {
      const agent = await this.prisma.deliveryAgent.findUnique({ where: { id: dto.agentId } });
      if (!agent) throw new NotFoundException('Delivery agent not found');
      if (!agent.isOnline) {
        throw new BadRequestException('Delivery agent is currently offline');
      }
    }

    const updated = await this.prisma.delivery.update({
      where: { orderId },
      data: {
        ...(dto.type && { type: dto.type }),
        ...(dto.agentId !== undefined && { agentId: dto.agentId }),
        ...(dto.provider !== undefined && { provider: dto.provider }),
        ...(dto.awbCode !== undefined && { awbCode: dto.awbCode }),
        ...(dto.trackingUrl !== undefined && { trackingUrl: dto.trackingUrl }),
        ...(dto.estimatedAt && { estimatedAt: new Date(dto.estimatedAt) }),
        status: DeliveryStatus.ASSIGNED,
      },
    });

    this.gateway.emitDeliveryEvent(WsEvents.DELIVERY_ASSIGNED, { orderId, agentId: dto.agentId ?? undefined });
    this.logger.log(`Delivery for order ${orderId} assigned to agent ${dto.agentId ?? 'third-party'}`);

    // Notify the assigned agent of the new delivery (push + in-app).
    if (dto.agentId) {
      const agent = await this.prisma.deliveryAgent.findUnique({
        where: { id: dto.agentId },
        select: { userId: true },
      });
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { orderNumber: true, address: { select: { city: true, pincode: true } } },
      });
      if (agent?.userId && order) {
        await this.notifications.notify(agent.userId, {
          type: NotificationType.DELIVERY,
          title: 'New Delivery Assigned',
          body: `Order ${order.orderNumber} to ${order.address?.city ?? ''} ${order.address?.pincode ?? ''} has been assigned to you.`,
          data: { orderId },
        });
      }
    }

    return updated;
  }

  // ─── Delivery Agent: My Orders ─────────────────────────────────────────────

  async agentListOrders(agentId: string, dto: QueryOrdersDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    // Find delivery agent record by userId
    const agent = await this.prisma.deliveryAgent.findUnique({ where: { userId: agentId } });
    if (!agent) throw new ForbiddenException('Delivery agent profile not found');

    const where: Prisma.DeliveryWhereInput = { agentId: agent.id };
    if (dto.status) {
      // Map order status filter to delivery status where applicable
      where.order = { status: dto.status };
    }

    const [deliveries, total] = await this.prisma.$transaction([
      this.prisma.delivery.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              total: true,
              address: { select: { name: true, line1: true, city: true, pincode: true, phone: true } },
              items: { select: { name: true, quantity: true, image: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { order: { createdAt: 'desc' } },
      }),
      this.prisma.delivery.count({ where }),
    ]);

    return { deliveries, pagination: { page, limit, total } };
  }

  // ─── Delivery Agent: Update Delivery Status ────────────────────────────────

  async agentUpdateDeliveryStatus(
    agentUserId: string,
    orderId: string,
    dto: UpdateDeliveryStatusDto,
  ) {
    const agent = await this.prisma.deliveryAgent.findUnique({ where: { userId: agentUserId } });
    if (!agent) throw new ForbiddenException('Delivery agent profile not found');

    const delivery = await this.prisma.delivery.findUnique({ where: { orderId } });
    if (!delivery) throw new NotFoundException('Delivery not found');

    if (delivery.agentId !== agent.id) {
      throw new ForbiddenException('This delivery is not assigned to you');
    }

    const allowed = DELIVERY_AGENT_TRANSITIONS[delivery.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition delivery from "${delivery.status}" to "${dto.status}". ` +
        `Allowed: ${allowed.length ? allowed.join(', ') : 'none'}`,
      );
    }

    if (dto.status === DeliveryStatus.FAILED && !dto.failureReason) {
      throw new BadRequestException('failureReason is required when status is FAILED');
    }

    const isDelivered = dto.status === DeliveryStatus.DELIVERED;

    await this.prisma.$transaction(async (tx) => {
      await tx.delivery.update({
        where: { orderId },
        data: {
          status: dto.status,
          ...(isDelivered && { deliveredAt: new Date(), otpVerified: true }),
          ...(dto.failureReason && { failureReason: dto.failureReason }),
        },
      });

      if (isDelivered) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.DELIVERED },
        });
      }
    });

    this.gateway.emitDeliveryEvent(WsEvents.DELIVERY_STATUS_CHANGED, { orderId, status: dto.status });
    this.logger.log(`Delivery for order ${orderId} status → ${dto.status} by agent ${agentUserId}`);

    return { message: `Delivery status updated to ${dto.status}` };
  }

  // ─── Internal: Called by PaymentsService after successful payment ──────────

  async confirmPayment(orderId: string, razorpayPayId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED },
      });
      await tx.payment.update({
        where: { orderId },
        data: { razorpayPayId, status: 'SUCCESS', paidAt: new Date() },
      });
    });

    this.emitOrderEvent(WsEvents.ORDER_PAYMENT_CONFIRMED, { orderId });
    this.logger.log(`Payment confirmed for order ${orderId}. RzpPayId: ${razorpayPayId}`);
  }

  // ─── Internal: Called by PaymentsService for refunds ──────────────────────

  async markRefunded(orderId: string, refundId: string, refundAmount: number): Promise<void> {
    // Fetch original payment amount to determine full vs partial refund
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      select: { amount: true },
    });
    if (!payment) throw new NotFoundException('Payment record not found');

    const isPartial = refundAmount < Number(payment.amount);

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.REFUNDED },
      }),
      this.prisma.payment.update({
        where: { orderId },
        data: {
          status: isPartial ? 'PARTIAL_REFUND' : 'REFUNDED',
          refundId,
          refundAmount: new Prisma.Decimal(refundAmount),
          refundedAt: new Date(),
        },
      }),
    ]);

    this.logger.log(`Order ${orderId} marked refunded. RefundId: ${refundId}, Amount: ₹${refundAmount}`);
  }

  // ─── WebSocket event emission ─────────────────────────────────────────────

  private emitOrderEvent(event: string, payload: Record<string, unknown>): void {
    // Resolve storeId if not already in the payload — needed to reach the store admin room
    const resolvedPayload = payload as {
      orderId: string;
      storeId?: string;
      userId?:  string;
      [key: string]: unknown;
    };

    if (!resolvedPayload.storeId) {
      // Look up storeId asynchronously (fire-and-forget): gateway handles null gracefully
      this.prisma.order
        .findUnique({ where: { id: resolvedPayload.orderId }, select: { storeId: true, userId: true } })
        .then((o) => {
          if (o) {
            this.gateway.emitOrderEvent(event, {
              ...resolvedPayload,
              storeId: o.storeId,
              userId:  resolvedPayload.userId ?? o.userId,
            });
          }
        })
        .catch((e) => this.logger.warn(`emitOrderEvent lookup failed: ${(e as Error).message}`));
      return;
    }

    this.gateway.emitOrderEvent(event, resolvedPayload);
  }
}
