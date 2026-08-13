import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Plan, SubscriptionStatus } from '@prisma/client';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import type { CreateSubscriptionDto } from './dto/create-subscription.dto';

// ─── Razorpay subscription webhook payload shapes ─────────────────────────────

interface RzpSubscriptionEntity {
  id: string;
  plan_id: string;
  customer_id?: string;
  status: string;
  current_start?: number; // unix timestamp
  current_end?: number;
  charge_at?: number;
  cancel_at_cycle_end?: number; // 0 | 1
}

interface RzpSubscriptionWebhookEvent {
  event: string;
  payload: {
    subscription?: { entity: RzpSubscriptionEntity };
    payment?: { entity: { id: string; subscription_id?: string } };
  };
}

// Map Razorpay subscription status strings → our enum
const STATUS_MAP: Record<string, SubscriptionStatus> = {
  created:       SubscriptionStatus.CREATED,
  authenticated: SubscriptionStatus.AUTHENTICATED,
  active:        SubscriptionStatus.ACTIVE,
  paused:        SubscriptionStatus.PAUSED,
  cancelled:     SubscriptionStatus.CANCELLED,
  completed:     SubscriptionStatus.COMPLETED,
  expired:       SubscriptionStatus.EXPIRED,
};

const HANDLED_EVENTS = new Set([
  'subscription.activated',
  'subscription.charged',
  'subscription.cancelled',
  'subscription.completed',
  'subscription.paused',
  'subscription.resumed',
  'subscription.pending',
]);

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly razorpay: Razorpay;
  private readonly webhookSecret: string;

  // Razorpay plan IDs are pre-created in the Razorpay dashboard; read from env
  private readonly planIds: Record<Plan, string | undefined>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tenant: TenantService,
  ) {
    this.razorpay = new Razorpay({
      key_id:     this.config.getOrThrow('RAZORPAY_KEY_ID'),
      key_secret: this.config.getOrThrow('RAZORPAY_KEY_SECRET'),
    });
    this.webhookSecret = this.config.getOrThrow('RAZORPAY_WEBHOOK_SECRET');

    this.planIds = {
      [Plan.FREE]:         undefined, // FREE has no paid subscription
      [Plan.STARTER]:      this.config.get('RAZORPAY_PLAN_ID_STARTER'),
      [Plan.PROFESSIONAL]: this.config.get('RAZORPAY_PLAN_ID_PROFESSIONAL'),
      [Plan.ENTERPRISE]:   this.config.get('RAZORPAY_PLAN_ID_ENTERPRISE'),
    };
  }

  // ─── Store Owner: Create / upgrade subscription ───────────────────────────

  async createSubscription(storeId: string, dto: CreateSubscriptionDto) {
    if (dto.plan === Plan.FREE) {
      throw new BadRequestException('FREE plan does not require a subscription. Downgrade by cancelling your current plan.');
    }

    const razorpayPlanId = this.planIds[dto.plan];
    if (!razorpayPlanId) {
      throw new BadRequestException(`Razorpay plan ID for plan "${dto.plan}" is not configured. Contact support.`);
    }

    const store = await this.tenant.getOrThrow(storeId);

    // If there's already an active subscription, cancel it first (plan change)
    const existing = await this.prisma.storeSubscription.findUnique({ where: { storeId } });
    if (existing && existing.status === SubscriptionStatus.ACTIVE) {
      throw new ConflictException(
        'You already have an active subscription. Cancel it first or contact support to change plans.',
      );
    }

    // Create Razorpay subscription
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rzpSub: any;
    try {
      rzpSub = await (this.razorpay.subscriptions as any).create({
        plan_id:        razorpayPlanId,
        total_count:    12, // 12 billing cycles (1 year); renews via webhook
        quantity:       1,
        customer_notify: 1,
        notes: {
          storeId,
          storeSlug: store.slug,
          plan:      dto.plan,
        },
      });
    } catch (error) {
      this.logger.error('Razorpay subscription creation failed', error);
      throw new BadRequestException('Payment gateway error. Please try again.');
    }

    // Upsert subscription record
    const sub = await this.prisma.storeSubscription.upsert({
      where:  { storeId },
      create: {
        storeId,
        razorpaySubId:     rzpSub.id,
        razorpayCustomerId: rzpSub.customer_id ?? null,
        razorpayPlanId,
        plan:   dto.plan,
        status: SubscriptionStatus.CREATED,
      },
      update: {
        razorpaySubId:     rzpSub.id,
        razorpayCustomerId: rzpSub.customer_id ?? null,
        razorpayPlanId,
        plan:              dto.plan,
        status:            SubscriptionStatus.CREATED,
        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd:   null,
      },
    });

    this.logger.log(`Subscription created for store ${store.slug}: ${rzpSub.id} — plan ${dto.plan}`);

    return {
      subscriptionId: sub.razorpaySubId,
      shortUrl:       rzpSub.short_url,    // Razorpay-hosted checkout page
      razorpayKeyId:  this.config.get('RAZORPAY_KEY_ID'),
      plan:           dto.plan,
      status:         sub.status,
    };
  }

  // ─── Store Owner: Cancel subscription at period end ───────────────────────

  async cancelSubscription(storeId: string) {
    const sub = await this.prisma.storeSubscription.findUnique({ where: { storeId } });
    if (!sub) throw new NotFoundException('No active subscription found for this store');
    if (sub.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }
    if (sub.cancelAtPeriodEnd) {
      throw new BadRequestException('Subscription is already scheduled for cancellation at period end');
    }

    try {
      // cancel_at_cycle_end = 1 → cancel at end of current billing cycle
      await (this.razorpay.subscriptions as any).cancel(sub.razorpaySubId, { cancel_at_cycle_end: 1 });
    } catch (error) {
      this.logger.error(`Razorpay subscription cancel failed for store ${storeId}`, error);
      throw new BadRequestException('Failed to cancel subscription. Please try again.');
    }

    await this.prisma.storeSubscription.update({
      where: { storeId },
      data:  { cancelAtPeriodEnd: true },
    });

    this.logger.log(`Subscription set to cancel at period end for store ${storeId}`);
    return {
      message: 'Subscription will be cancelled at the end of the current billing period',
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  // ─── Store Owner: Get subscription status + quota ─────────────────────────

  async getStatus(storeId: string) {
    const [sub, quota, store] = await Promise.all([
      this.prisma.storeSubscription.findUnique({ where: { storeId } }),
      this.prisma.storeQuotaUsage.findUnique({ where: { storeId } }),
      this.tenant.getOrThrow(storeId),
    ]);

    const limits = await this.prisma.planLimit.findUnique({ where: { plan: store.plan } });

    return {
      plan:         store.plan,
      subscription: sub ?? null,
      quota:        quota ?? null,
      limits:       limits ?? null,
    };
  }

  // ─── Webhook: Razorpay subscription events ────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (!this.verifySignature(rawBody, signature)) {
      this.logger.warn('Billing webhook: invalid signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let event: RzpSubscriptionWebhookEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as RzpSubscriptionWebhookEvent;
    } catch {
      this.logger.error('Billing webhook: failed to parse body');
      return;
    }

    if (!HANDLED_EVENTS.has(event.event)) {
      this.logger.debug(`Billing webhook: ignoring event "${event.event}"`);
      return;
    }

    this.logger.log(`Billing webhook received: ${event.event}`);

    try {
      await this.processEvent(event);
    } catch (error) {
      // Log but never rethrow — Razorpay must get 200 or it retries indefinitely
      this.logger.error(`Billing webhook handler error for "${event.event}"`, error);
    }
  }

  // ─── Private: event dispatch ──────────────────────────────────────────────

  private async processEvent(event: RzpSubscriptionWebhookEvent): Promise<void> {
    const subEntity = event.payload.subscription?.entity;
    if (!subEntity) return;

    const sub = await this.prisma.storeSubscription.findUnique({
      where: { razorpaySubId: subEntity.id },
    });

    if (!sub) {
      this.logger.warn(`Billing webhook: no subscription record for rzpSubId=${subEntity.id}`);
      return;
    }

    const newStatus = STATUS_MAP[subEntity.status] ?? sub.status;

    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.resumed': {
        // Update period dates and activate the plan
        const periodStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : null;
        const periodEnd   = subEntity.current_end   ? new Date(subEntity.current_end   * 1000) : null;
        const chargeAt    = subEntity.charge_at     ? new Date(subEntity.charge_at     * 1000) : null;

        await this.prisma.storeSubscription.update({
          where: { razorpaySubId: subEntity.id },
          data: {
            status:             newStatus === sub.status ? SubscriptionStatus.ACTIVE : newStatus,
            currentPeriodStart: periodStart,
            currentPeriodEnd:   periodEnd,
            chargeAt,
            cancelAtPeriodEnd:  subEntity.cancel_at_cycle_end === 1,
          },
        });

        // Upgrade the store's plan in the Store table
        await this.prisma.store.update({
          where: { id: sub.storeId },
          data:  { plan: sub.plan },
        });

        // Invalidate store cache so new plan limits apply immediately
        const store = await this.prisma.store.findUnique({ where: { id: sub.storeId } });
        if (store) this.tenant.invalidateStoreCache(sub.storeId, store.slug);

        this.logger.log(
          `Subscription ${event.event}: store ${sub.storeId} plan=${sub.plan} period=${periodStart?.toISOString()} → ${periodEnd?.toISOString()}`,
        );
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.expired': {
        await this.prisma.storeSubscription.update({
          where: { razorpaySubId: subEntity.id },
          data:  { status: newStatus },
        });

        // Downgrade store to FREE when subscription ends
        await this.prisma.store.update({
          where: { id: sub.storeId },
          data:  { plan: Plan.FREE },
        });

        const store = await this.prisma.store.findUnique({ where: { id: sub.storeId } });
        if (store) this.tenant.invalidateStoreCache(sub.storeId, store.slug);

        this.logger.log(`Subscription ${event.event}: store ${sub.storeId} downgraded to FREE`);
        break;
      }

      case 'subscription.paused': {
        await this.prisma.storeSubscription.update({
          where: { razorpaySubId: subEntity.id },
          data:  { status: SubscriptionStatus.PAUSED },
        });
        this.logger.log(`Subscription paused: store ${sub.storeId}`);
        break;
      }
    }
  }

  // ─── Private: HMAC verification ──────────────────────────────────────────

  private verifySignature(rawBody: Buffer, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    try {
      const expectedBuf  = Buffer.from(expected, 'hex');
      const signatureBuf = Buffer.from(signature, 'hex');
      if (expectedBuf.length !== signatureBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    } catch {
      return false;
    }
  }
}
