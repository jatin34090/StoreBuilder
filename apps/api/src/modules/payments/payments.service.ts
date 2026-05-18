import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import type { VerifyPaymentDto } from './dto/verify-payment.dto';
import type { RefundDto } from './dto/refund.dto';

// ─── Webhook event shapes (Razorpay payload structure) ────────────────────────

interface RzpPaymentEntity {
  id: string;
  order_id: string;
  amount: number; // paise
  status: string;
  error_code?: string;
  error_description?: string;
}

interface RzpRefundEntity {
  id: string;
  payment_id: string;
  amount: number; // paise
}

interface RzpWebhookEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: { entity: RzpPaymentEntity };
    refund?: { entity: RzpRefundEntity };
  };
}

// ─── Webhook events we handle ─────────────────────────────────────────────────

const HANDLED_EVENTS = new Set([
  'payment.captured',
  'payment.failed',
  'refund.created',
  'refund.processed',
]);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => OrdersService)) private readonly orders: OrdersService,
  ) {
    this.keyId = this.configService.getOrThrow('RAZORPAY_KEY_ID');
    this.keySecret = this.configService.getOrThrow('RAZORPAY_KEY_SECRET');
    this.webhookSecret = this.configService.getOrThrow('RAZORPAY_WEBHOOK_SECRET');

    this.razorpay = new Razorpay({
      key_id: this.keyId,
      key_secret: this.keySecret,
    });
  }

  // ─── Public API: used by OrdersService ────────────────────────────────────

  /** Creates a Razorpay order and returns its ID. Called by OrdersService.placeOrder(). */
  async createRazorpayOrder(totalRupees: number, receipt: string): Promise<string> {
    try {
      const rzpOrder = await this.razorpay.orders.create({
        amount: Math.round(totalRupees * 100), // paise
        currency: 'INR',
        receipt,
        payment_capture: true,
      });
      return rzpOrder.id;
    } catch (error) {
      this.logger.error('Razorpay order creation failed', error);
      throw new BadRequestException('Payment gateway error. Please try again.');
    }
  }

  /** Returns the Razorpay public key for client-side checkout. */
  getRazorpayKeyId(): string {
    return this.keyId;
  }

  // ─── Customer: Verify Payment ──────────────────────────────────────────────

  /**
   * Called by client after completing Razorpay checkout.
   * Validates ownership, verifies HMAC, then calls OrdersService.confirmPayment().
   */
  async verifyPayment(userId: string, dto: VerifyPaymentDto): Promise<void> {
    // 1. Verify ownership: the razorpayOrderId must belong to this user's order
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: dto.orderId, razorpayOrderId: dto.razorpayOrderId },
      select: { id: true, status: true, orderId: true, order: { select: { userId: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found for the given order');
    }
    if (payment.order.userId !== userId) {
      throw new ForbiddenException('This order does not belong to you');
    }

    // 2. Idempotency: skip if already confirmed
    if (payment.status === PaymentStatus.SUCCESS) {
      this.logger.warn(`Duplicate verify attempt for order ${dto.orderId} — already SUCCESS`);
      return;
    }
    if (payment.status === PaymentStatus.FAILED) {
      throw new BadRequestException('This payment has already been recorded as failed');
    }

    // 3. Verify HMAC-SHA256 signature
    if (!this.verifyPaymentSignature(dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature)) {
      this.logger.warn(
        `Invalid payment signature for order ${dto.orderId}. ` +
        `rzpOrderId=${dto.razorpayOrderId} rzpPayId=${dto.razorpayPaymentId}`,
      );
      // Mark payment as failed in DB so it isn't retried
      await this.prisma.payment.update({
        where: { orderId: dto.orderId },
        data: { status: PaymentStatus.FAILED },
      });
      throw new UnauthorizedException('Payment signature verification failed');
    }

    // 4. Confirm with OrdersService (updates order status + payment record)
    await this.orders.confirmPayment(dto.orderId, dto.razorpayPaymentId);
    this.logger.log(`Payment verified for order ${dto.orderId}. PayId: ${dto.razorpayPaymentId}`);
  }

  // ─── Webhook Handler ───────────────────────────────────────────────────────

  /**
   * Processes Razorpay webhook events server-to-server.
   * Always returns without throwing — non-200 responses cause Razorpay to retry.
   * Raw body is required for HMAC verification (must pass req.rawBody from controller).
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    // 1. Verify webhook authenticity
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Razorpay webhook: invalid signature — discarding');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let event: RzpWebhookEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as RzpWebhookEvent;
    } catch {
      this.logger.error('Razorpay webhook: failed to parse body');
      return;
    }

    if (!HANDLED_EVENTS.has(event.event)) {
      this.logger.debug(`Razorpay webhook: ignoring unhandled event "${event.event}"`);
      return;
    }

    this.logger.log(`Razorpay webhook received: ${event.event}`);

    try {
      switch (event.event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(event);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(event);
          break;
        case 'refund.created':
        case 'refund.processed':
          await this.handleRefundEvent(event);
          break;
      }
    } catch (error) {
      // Log but don't rethrow — Razorpay must receive a 200 or it retries
      this.logger.error(`Webhook handler error for event "${event.event}"`, error);
    }
  }

  // ─── Admin: Get Payment Status ─────────────────────────────────────────────

  async getPaymentByOrder(orderId: string, requestingUserId: string, isAdmin: boolean) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: { order: { select: { userId: true, orderNumber: true } } },
    });
    if (!payment) throw new NotFoundException('Payment record not found');

    if (!isAdmin && payment.order.userId !== requestingUserId) {
      throw new ForbiddenException('You do not have access to this payment record');
    }

    return payment;
  }

  // ─── Admin: Initiate Refund ────────────────────────────────────────────────

  async initiateRefund(orderId: string, dto: RefundDto): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      select: { id: true, status: true, razorpayPayId: true, amount: true, refundId: true },
    });
    if (!payment) throw new NotFoundException('Payment record not found');

    // COD orders: no Razorpay payment to refund — mark directly
    if (!payment.razorpayPayId) {
      throw new BadRequestException('COD orders do not have a Razorpay payment to refund. Process manually.');
    }

    if (payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('This payment has already been fully refunded');
    }
    if (payment.status !== PaymentStatus.SUCCESS && payment.status !== PaymentStatus.PARTIAL_REFUND) {
      throw new BadRequestException(`Cannot refund a payment with status "${payment.status}"`);
    }

    // Duplicate protection: if a refundId is already recorded and no new amount differs, skip
    if (payment.refundId && !dto.amount) {
      throw new BadRequestException('A full refund has already been initiated for this payment');
    }

    const fullAmount = Number(payment.amount);
    const refundAmount = dto.amount ?? fullAmount;

    if (refundAmount > fullAmount) {
      throw new BadRequestException(
        `Refund amount (₹${refundAmount}) exceeds original payment (₹${fullAmount})`,
      );
    }

    // Call Razorpay refund API
    let refund: { id: string; amount: number };
    try {
      refund = await this.razorpay.payments.refund(payment.razorpayPayId, {
        amount: Math.round(refundAmount * 100), // paise
        speed: dto.speed ?? 'optimum',
        notes: { reason: dto.reason ?? 'Admin-initiated refund' },
      });
    } catch (error) {
      this.logger.error(`Razorpay refund failed for order ${orderId}`, error);
      throw new BadRequestException('Refund request to Razorpay failed. Please try again.');
    }

    // Persist refund and update order status
    await this.orders.markRefunded(orderId, refund.id, refundAmount);

    this.logger.log(
      `Refund initiated for order ${orderId}. RefundId: ${refund.id}, Amount: ₹${refundAmount}`,
    );
  }

  // ─── Private: Webhook Event Handlers ─────────────────────────────────────

  private async handlePaymentCaptured(event: RzpWebhookEvent): Promise<void> {
    const paymentEntity = event.payload.payment?.entity;
    if (!paymentEntity) return;

    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPayId = paymentEntity.id;

    // Find our internal payment record
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId },
      select: { status: true, orderId: true },
    });

    if (!payment) {
      this.logger.warn(`Webhook payment.captured: no payment found for rzpOrderId=${razorpayOrderId}`);
      return;
    }

    // Idempotency: already confirmed — skip
    if (payment.status === PaymentStatus.SUCCESS) {
      this.logger.debug(`Webhook payment.captured: order ${payment.orderId} already CONFIRMED — skipping`);
      return;
    }

    await this.orders.confirmPayment(payment.orderId, razorpayPayId);
    this.logger.log(`Webhook: payment.captured confirmed order ${payment.orderId}`);
  }

  private async handlePaymentFailed(event: RzpWebhookEvent): Promise<void> {
    const paymentEntity = event.payload.payment?.entity;
    if (!paymentEntity) return;

    const payment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId: paymentEntity.order_id },
      select: { status: true, orderId: true },
    });

    if (!payment || payment.status !== PaymentStatus.PENDING) return;

    await this.prisma.payment.update({
      where: { orderId: payment.orderId },
      data: { status: PaymentStatus.FAILED },
    });

    this.logger.warn(
      `Webhook: payment.failed for order ${payment.orderId}. ` +
      `Reason: ${paymentEntity.error_code} — ${paymentEntity.error_description}`,
    );
  }

  private async handleRefundEvent(event: RzpWebhookEvent): Promise<void> {
    const refundEntity = event.payload.refund?.entity;
    if (!refundEntity) return;

    // Find payment by razorpayPayId
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayPayId: refundEntity.payment_id },
      select: { status: true, orderId: true, refundId: true, amount: true },
    });

    if (!payment) {
      this.logger.warn(`Webhook refund: no payment found for rzpPayId=${refundEntity.payment_id}`);
      return;
    }

    // Idempotency: if refundId already matches, skip
    if (payment.refundId === refundEntity.id) {
      this.logger.debug(`Webhook refund: refund ${refundEntity.id} already recorded — skipping`);
      return;
    }

    const refundAmountRupees = refundEntity.amount / 100;
    await this.orders.markRefunded(payment.orderId, refundEntity.id, refundAmountRupees);

    this.logger.log(
      `Webhook: ${event.event} processed for order ${payment.orderId}. ` +
      `RefundId: ${refundEntity.id}, Amount: ₹${refundAmountRupees}`,
    );
  }

  // ─── Private: HMAC Verification ───────────────────────────────────────────

  /**
   * Verifies Razorpay payment signature.
   * Spec: HMAC-SHA256(razorpayOrderId + "|" + razorpayPaymentId, KEY_SECRET)
   */
  private verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
  ): boolean {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');
    // Use timingSafeEqual to prevent timing attacks
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }

  /**
   * Verifies Razorpay webhook signature.
   * Spec: HMAC-SHA256(rawBody, WEBHOOK_SECRET)
   * Requires raw (unparsed) request body — set rawBody:true in NestFactory.create().
   */
  private verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    try {
      const signatureBuf = Buffer.from(signature, 'hex');
      if (expectedBuf.length !== signatureBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    } catch {
      return false;
    }
  }
}
