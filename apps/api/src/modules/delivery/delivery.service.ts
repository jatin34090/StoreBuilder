import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma, DeliveryStatus, DeliveryType, Role, NotificationType, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateAgentDto } from './dto/create-agent.dto';
import type { UpdateAgentDto } from './dto/update-agent.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';
import type { QueryDeliveriesDto } from './dto/query-deliveries.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 10;
const MAX_LOCATION_LOG_POINTS = 50;

// ─── Delivery status state machine (agent-driven) ─────────────────────────────

const AGENT_TRANSITIONS: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  [DeliveryStatus.ASSIGNED]:         [DeliveryStatus.PICKED_UP],
  [DeliveryStatus.PICKED_UP]:        [DeliveryStatus.IN_TRANSIT],
  [DeliveryStatus.IN_TRANSIT]:       [DeliveryStatus.OUT_FOR_DELIVERY],
  [DeliveryStatus.OUT_FOR_DELIVERY]: [DeliveryStatus.FAILED],
  // DELIVERED is terminal — reached only via OTP verification
};

// ─── Shared select shapes ─────────────────────────────────────────────────────

const DELIVERY_DETAIL_SELECT = {
  id:            true,
  orderId:       true,
  type:          true,
  status:        true,
  provider:      true,
  awbCode:       true,
  trackingUrl:   true,
  otpVerified:   true,
  estimatedAt:   true,
  deliveredAt:   true,
  failureReason: true,
  locationLog:   true,
  agent: {
    select: {
      id:          true,
      vehicleType: true,
      isOnline:    true,
      currentLat:  true,
      currentLng:  true,
      rating:      true,
      user: { select: { id: true, name: true, phone: true, avatar: true } },
    },
  },
  order: {
    select: {
      id:          true,
      orderNumber: true,
      status:      true,
      total:       true,
      address: {
        select: { name: true, phone: true, line1: true, line2: true, city: true, state: true, pincode: true },
      },
      items: { select: { name: true, quantity: true, image: true, sku: true } },
      user:  { select: { id: true, name: true, phone: true, email: true } },
    },
  },
} as const;

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Admin: Agent Management ───────────────────────────────────────────────

  async createAgent(dto: CreateAgentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, name: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.deliveryAgent.findUnique({
      where: { userId: dto.userId },
    });
    if (existing) throw new ConflictException('User already has a delivery agent profile');

    // Promote user role to DELIVERY_AGENT if not already
    const [agent] = await this.prisma.$transaction([
      this.prisma.deliveryAgent.create({
        data: {
          userId:      dto.userId,
          vehicleType: dto.vehicleType,
          zones:       dto.zones,
        },
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      }),
      ...(user.role !== Role.DELIVERY_AGENT
        ? [this.prisma.user.update({ where: { id: dto.userId }, data: { role: Role.DELIVERY_AGENT } })]
        : []),
    ]);

    this.logger.log(`Delivery agent created for user ${dto.userId} (${user.name})`);
    return agent;
  }

  async adminListAgents(query: QueryDeliveriesDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where: Prisma.DeliveryAgentWhereInput = {};
    if (query.search) {
      where.user = {
        OR: [
          { name:  { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [agents, total] = await this.prisma.$transaction([
      this.prisma.deliveryAgent.findMany({
        where,
        select: {
          id:          true,
          vehicleType: true,
          zones:       true,
          isOnline:    true,
          currentLat:  true,
          currentLng:  true,
          rating:      true,
          user: { select: { id: true, name: true, email: true, phone: true, avatar: true, isBlocked: true } },
          _count: { select: { deliveries: true } },
        },
        skip,
        take: limit,
        orderBy: { user: { name: 'asc' } },
      }),
      this.prisma.deliveryAgent.count({ where }),
    ]);

    return { agents, pagination: { page, limit, total } };
  }

  async adminGetAgent(agentId: string) {
    const agent = await this.prisma.deliveryAgent.findUnique({
      where: { id: agentId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, avatar: true, createdAt: true } },
        deliveries: {
          select: { id: true, status: true, orderId: true, deliveredAt: true },
          orderBy: { order: { createdAt: 'desc' } },
          take: 10,
        },
        _count: { select: { deliveries: true } },
      },
    });
    if (!agent) throw new NotFoundException('Delivery agent not found');
    return agent;
  }

  async adminUpdateAgent(agentId: string, dto: UpdateAgentDto) {
    const agent = await this.prisma.deliveryAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Delivery agent not found');

    return this.prisma.deliveryAgent.update({
      where: { id: agentId },
      data: {
        ...(dto.vehicleType !== undefined && { vehicleType: dto.vehicleType }),
        ...(dto.zones       !== undefined && { zones: dto.zones }),
      },
      include: { user: { select: { id: true, name: true, phone: true } } },
    });
  }

  async adminDeleteAgent(agentId: string) {
    const agent = await this.prisma.deliveryAgent.findUnique({
      where: { id: agentId },
      select: { userId: true, deliveries: { where: { status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED] } }, take: 1 } },
    });
    if (!agent) throw new NotFoundException('Delivery agent not found');

    if (agent.deliveries.length > 0) {
      throw new BadRequestException('Cannot remove agent with active deliveries in progress');
    }

    await this.prisma.$transaction([
      this.prisma.deliveryAgent.delete({ where: { id: agentId } }),
      this.prisma.user.update({ where: { id: agent.userId }, data: { role: Role.CUSTOMER } }),
    ]);

    return { message: 'Delivery agent removed and user role reset to CUSTOMER' };
  }

  // ─── Admin: Delivery Management ───────────────────────────────────────────

  async adminListDeliveries(query: QueryDeliveriesDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where: Prisma.DeliveryWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.type)   where.type   = query.type;
    if (query.search) {
      where.order = {
        OR: [
          { orderNumber: { contains: query.search, mode: 'insensitive' } },
          { user: { name:  { contains: query.search, mode: 'insensitive' } } },
          { user: { phone: { contains: query.search } } },
        ],
      };
    }

    const [deliveries, total] = await this.prisma.$transaction([
      this.prisma.delivery.findMany({
        where,
        select: {
          id:            true,
          orderId:       true,
          type:          true,
          status:        true,
          provider:      true,
          awbCode:       true,
          trackingUrl:   true,
          estimatedAt:   true,
          deliveredAt:   true,
          failureReason: true,
          otpVerified:   true,
          agent: {
            select: {
              id:   true,
              user: { select: { name: true, phone: true } },
            },
          },
          order: {
            select: {
              orderNumber: true,
              total:       true,
              user:        { select: { name: true, phone: true } },
              address:     { select: { city: true, pincode: true } },
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

  async adminGetDelivery(orderId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { orderId },
      select: DELIVERY_DETAIL_SELECT,
    });
    if (!delivery) throw new NotFoundException('Delivery not found for this order');
    return delivery;
  }

  async adminRegenerateOtp(orderId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { orderId },
      select: {
        id:     true,
        status: true,
        type:   true,
        order:  { select: { userId: true, orderNumber: true } },
      },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');

    if (delivery.type === DeliveryType.THIRD_PARTY) {
      throw new BadRequestException('OTP is only applicable for SELF deliveries');
    }
    if (delivery.status === DeliveryStatus.DELIVERED) {
      throw new BadRequestException('Cannot regenerate OTP for a delivered order');
    }

    const { otp, hash } = await this.generateOtpHash();
    await this.prisma.delivery.update({
      where: { orderId },
      data: { otpHash: hash, otpVerified: false },
    });

    // Notify customer with new OTP
    await this.notifications.notify(delivery.order.userId, {
      type:  NotificationType.DELIVERY,
      title: 'Delivery OTP Updated',
      body:  `Your updated delivery OTP for order ${delivery.order.orderNumber} is: ${otp}. Share only with the delivery agent.`,
      data:  { orderId, otp },
    });

    this.logger.log(`OTP regenerated for order ${orderId} by admin`);
    return { message: 'OTP regenerated and sent to customer' };
  }

  // ─── Agent: Profile ───────────────────────────────────────────────────────

  async getMyProfile(userId: string) {
    const agent = await this.prisma.deliveryAgent.findUnique({
      where: { userId },
      include: {
        user:       { select: { id: true, name: true, email: true, phone: true, avatar: true } },
        _count:     { select: { deliveries: true } },
      },
    });
    if (!agent) throw new NotFoundException('Delivery agent profile not found');
    return agent;
  }

  async updateMyProfile(userId: string, dto: UpdateAgentDto) {
    const agent = await this.prisma.deliveryAgent.findUnique({ where: { userId } });
    if (!agent) throw new NotFoundException('Delivery agent profile not found');

    return this.prisma.deliveryAgent.update({
      where: { userId },
      data: {
        ...(dto.vehicleType !== undefined && { vehicleType: dto.vehicleType }),
        ...(dto.zones       !== undefined && { zones: dto.zones }),
      },
    });
  }

  async toggleOnline(userId: string, isOnline: boolean) {
    const agent = await this.prisma.deliveryAgent.findUnique({ where: { userId } });
    if (!agent) throw new NotFoundException('Delivery agent profile not found');

    await this.prisma.deliveryAgent.update({
      where: { userId },
      data: { isOnline },
    });

    return { isOnline, message: `You are now ${isOnline ? 'online' : 'offline'}` };
  }

  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const agent = await this.prisma.deliveryAgent.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) throw new NotFoundException('Delivery agent profile not found');

    // locationLog lives on Delivery, not DeliveryAgent
    const activeDelivery = await this.prisma.delivery.findFirst({
      where: {
        agentId: agent.id,
        status:  { in: [DeliveryStatus.PICKED_UP, DeliveryStatus.IN_TRANSIT, DeliveryStatus.OUT_FOR_DELIVERY] },
      },
      select: { orderId: true, locationLog: true },
    });

    const point = { lat: dto.lat, lng: dto.lng, timestamp: new Date().toISOString() };

    // Update agent's current position (fast lookup for admin map view)
    await this.prisma.deliveryAgent.update({
      where: { userId },
      data: { currentLat: dto.lat, currentLng: dto.lng },
    });

    // Append to active delivery's locationLog (capped at MAX_LOCATION_LOG_POINTS)
    if (activeDelivery) {
      const existing = (activeDelivery.locationLog as Array<Record<string, unknown>>) ?? [];
      const updated  = [...existing, point].slice(-MAX_LOCATION_LOG_POINTS);
      await this.prisma.delivery.update({
        where: { orderId: activeDelivery.orderId },
        data:  { locationLog: updated as any },
      });

      // Phase 2: emit real-time GPS event via Socket.IO gateway
      this.emitLocationEvent(activeDelivery.orderId, dto.lat, dto.lng);
    }

    return { lat: dto.lat, lng: dto.lng, updatedAt: point.timestamp };
  }

  // ─── Agent: Delivery Operations ───────────────────────────────────────────

  async agentListDeliveries(userId: string, query: QueryDeliveriesDto) {
    const agent = await this.prisma.deliveryAgent.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) throw new ForbiddenException('Delivery agent profile not found');

    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where: Prisma.DeliveryWhereInput = { agentId: agent.id };
    if (query.status) where.status = query.status;

    const [deliveries, total] = await this.prisma.$transaction([
      this.prisma.delivery.findMany({
        where,
        select: {
          id:            true,
          orderId:       true,
          type:          true,
          status:        true,
          otpVerified:   true,
          estimatedAt:   true,
          deliveredAt:   true,
          failureReason: true,
          order: {
            select: {
              id:          true,
              orderNumber: true,
              status:      true,
              total:       true,
              address: {
                select: { name: true, phone: true, line1: true, line2: true, city: true, pincode: true },
              },
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

  async agentGetDelivery(userId: string, orderId: string) {
    const agent = await this.prisma.deliveryAgent.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) throw new ForbiddenException('Delivery agent profile not found');

    const delivery = await this.prisma.delivery.findUnique({
      where: { orderId },
      select: {
        id:            true,
        orderId:       true,
        agentId:       true,
        type:          true,
        status:        true,
        otpVerified:   true,
        estimatedAt:   true,
        deliveredAt:   true,
        failureReason: true,
        order: {
          select: {
            id:          true,
            orderNumber: true,
            status:      true,
            total:       true,
            subtotal:    true,
            notes:       true,
            address: {
              select: { name: true, phone: true, line1: true, line2: true, city: true, state: true, pincode: true },
            },
            items: { select: { name: true, sku: true, quantity: true, price: true, image: true } },
            payment: { select: { method: true, status: true } },
          },
        },
      },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.agentId !== agent.id) {
      throw new ForbiddenException('This delivery is not assigned to you');
    }
    return delivery;
  }

  async agentUpdateStatus(
    userId: string,
    orderId: string,
    status: DeliveryStatus,
    failureReason?: string,
  ) {
    const agent = await this.prisma.deliveryAgent.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) throw new ForbiddenException('Delivery agent profile not found');

    const delivery = await this.prisma.delivery.findUnique({
      where: { orderId },
      select: {
        agentId:  true,
        status:   true,
        type:     true,
        order:    { select: { userId: true, orderNumber: true } },
      },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.agentId !== agent.id) {
      throw new ForbiddenException('This delivery is not assigned to you');
    }

    const allowed = AGENT_TRANSITIONS[delivery.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition delivery from "${delivery.status}" to "${status}". ` +
        `Allowed: ${allowed.length ? allowed.join(', ') : 'none (use verify-otp to mark DELIVERED)'}`,
      );
    }

    if (status === DeliveryStatus.FAILED) {
      if (!failureReason) {
        throw new BadRequestException('failureReason is required when status is FAILED');
      }
      await this.prisma.delivery.update({
        where: { orderId },
        data: { status, failureReason },
      });

      this.emitDeliveryEvent('delivery:failed', { orderId, agentId: agent.id });
      this.logger.log(`Delivery for order ${orderId} marked FAILED. Reason: ${failureReason}`);
      return { message: 'Delivery marked as failed' };
    }

    // When transitioning to OUT_FOR_DELIVERY: auto-generate and send OTP to customer
    if (status === DeliveryStatus.OUT_FOR_DELIVERY && delivery.type === DeliveryType.SELF) {
      const { otp, hash } = await this.generateOtpHash();

      await this.prisma.delivery.update({
        where: { orderId },
        data: { status, otpHash: hash },
      });

      await this.notifications.notify(delivery.order.userId, {
        type:  NotificationType.DELIVERY,
        title: 'Your Delivery is Here!',
        body:  `Order ${delivery.order.orderNumber} is out for delivery. Your OTP is: ${otp}. Share only with the agent.`,
        data:  { orderId, otp },
      });

      this.logger.log(`OTP generated for order ${orderId} — delivery OUT_FOR_DELIVERY`);
    } else {
      await this.prisma.delivery.update({
        where: { orderId },
        data: { status },
      });
    }

    this.emitDeliveryEvent('delivery:status_changed', { orderId, status, agentId: agent.id });
    this.logger.log(`Delivery for order ${orderId} status → ${status} by agent ${userId}`);

    return { message: `Delivery status updated to ${status}` };
  }

  async agentVerifyOtp(userId: string, orderId: string, dto: VerifyOtpDto) {
    const agent = await this.prisma.deliveryAgent.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) throw new ForbiddenException('Delivery agent profile not found');

    const delivery = await this.prisma.delivery.findUnique({
      where: { orderId },
      select: {
        agentId:    true,
        status:     true,
        otpHash:    true,
        otpVerified: true,
        order:      { select: { id: true, userId: true, orderNumber: true } },
      },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.agentId !== agent.id) {
      throw new ForbiddenException('This delivery is not assigned to you');
    }
    if (delivery.status !== DeliveryStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException('OTP can only be verified when delivery is OUT_FOR_DELIVERY');
    }
    if (delivery.otpVerified) {
      throw new BadRequestException('OTP has already been verified for this delivery');
    }
    if (!delivery.otpHash) {
      throw new BadRequestException('No OTP has been generated for this delivery');
    }

    const isValid = await bcrypt.compare(dto.otp, delivery.otpHash);
    if (!isValid) throw new BadRequestException('Invalid OTP. Please ask the customer to share the correct OTP.');

    // Mark delivery delivered and update order status atomically
    await this.prisma.$transaction([
      this.prisma.delivery.update({
        where: { orderId },
        data: {
          status:      DeliveryStatus.DELIVERED,
          otpVerified: true,
          deliveredAt: new Date(),
        },
      }),
      this.prisma.order.update({
        where: { id: delivery.order.id },
        data:  { status: OrderStatus.DELIVERED },
      }),
    ]);

    // Notify customer
    await this.notifications.notifyOrderStatusUpdated(
      delivery.order.userId,
      delivery.order.id,
      delivery.order.orderNumber,
      OrderStatus.DELIVERED,
    );

    this.emitDeliveryEvent('delivery:delivered', { orderId, agentId: agent.id });
    this.logger.log(`Order ${delivery.order.orderNumber} delivered via OTP by agent ${userId}`);

    return { message: 'Delivery confirmed successfully. Order marked as delivered.' };
  }

  // ─── Customer: Track Delivery ─────────────────────────────────────────────

  async trackDelivery(userId: string, orderId: string) {
    // Verify order belongs to this customer
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const delivery = await this.prisma.delivery.findUnique({
      where: { orderId },
      select: {
        id:            true,
        type:          true,
        status:        true,
        provider:      true,
        awbCode:       true,
        trackingUrl:   true,
        estimatedAt:   true,
        deliveredAt:   true,
        failureReason: true,
        // Return only last 10 location points to customer
        locationLog:   true,
        agent: {
          select: {
            vehicleType: true,
            currentLat:  true,
            currentLng:  true,
            rating:      true,
            user:        { select: { name: true, phone: true, avatar: true } },
          },
        },
      },
    });
    if (!delivery) throw new NotFoundException('No delivery record found for this order');

    // Trim locationLog to last 10 points for customer view
    const rawLog = (delivery.locationLog as Array<Record<string, unknown>>) ?? [];
    return {
      ...delivery,
      locationLog: rawLog.slice(-10),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async generateOtpHash(): Promise<{ otp: string; hash: string }> {
    const otp  = crypto.randomInt(100_000, 999_999).toString();
    const hash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    return { otp, hash };
  }

  // ─── Phase 2: WebSocket / Queue Placeholders ──────────────────────────────

  private emitDeliveryEvent(event: string, payload: Record<string, unknown>): void {
    // TODO (Phase 2): emit via Socket.IO gateway
    // this.deliveryGateway.emit(event, payload)
    this.logger.debug(`[EVENT] ${event} ${JSON.stringify(payload)}`);
  }

  private emitLocationEvent(orderId: string, lat: number, lng: number): void {
    // TODO (Phase 2): emit 'delivery:location' to the order's room via Socket.IO
    // this.deliveryGateway.emitToOrder(orderId, 'delivery:location', { lat, lng })
    this.logger.debug(`[GPS] order=${orderId} lat=${lat} lng=${lng}`);
  }
}
