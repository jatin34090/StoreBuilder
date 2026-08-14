import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Plan, SubscriptionStatus, InvoiceStatus } from '@prisma/client';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { RedisService } from '../notifications/redis.service';
import { DEFAULT_PLAN_LIMITS, DEFAULT_PLAN_DISPLAY } from '../../common/constants/plan-config';
import type { CreateSubscriptionDto } from './dto/create-subscription.dto';

// ─── Razorpay webhook payload shapes ─────────────────────────────────────────

interface RzpSubscriptionEntity {
  id: string;
  plan_id: string;
  customer_id?: string;
  status: string;
  current_start?: number;
  current_end?: number;
  charge_at?: number;
  cancel_at_cycle_end?: number;
}

interface RzpPaymentEntity {
  id: string;
  subscription_id?: string;
  amount?: number;
  invoice_id?: string;
}

interface RzpWebhookEvent {
  event: string;
  payload: {
    subscription?: { entity: RzpSubscriptionEntity };
    payment?: { entity: RzpPaymentEntity };
  };
}

// Map Razorpay status strings → our enum
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
  'subscription.expired',
]);

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly razorpay: Razorpay;
  private readonly webhookSecret: string;
  private readonly planIds: Record<Plan, string | undefined>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tenant: TenantService,
    private readonly redis: RedisService,
  ) {
    this.razorpay = new Razorpay({
      key_id:     this.config.getOrThrow('RAZORPAY_KEY_ID'),
      key_secret: this.config.getOrThrow('RAZORPAY_KEY_SECRET'),
    });
    this.webhookSecret = this.config.getOrThrow('RAZORPAY_WEBHOOK_SECRET');

    this.planIds = {
      [Plan.FREE]:         undefined,
      [Plan.STARTER]:      this.config.get('RAZORPAY_PLAN_ID_STARTER'),
      [Plan.PROFESSIONAL]: this.config.get('RAZORPAY_PLAN_ID_PROFESSIONAL'),
      [Plan.ENTERPRISE]:   this.config.get('RAZORPAY_PLAN_ID_ENTERPRISE'),
    };
  }

  // ─── Public: list all active plans ───────────────────────────────────────

  async listPlans() {
    const plans = await this.prisma.planLimit.findMany({
      where:   { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map((p) => ({
      plan:         p.plan,
      name:         p.displayName,
      description:  p.description,
      priceMonthly: p.priceMonthly,  // paise
      priceYearly:  p.priceYearly,
      currency:     p.currency,
      trialDays:    p.trialDays,
      features:     p.features as string[],
      limits: {
        maxProducts:    p.maxProducts,
        maxStaff:       p.maxStaff,
        maxStorageGB:   p.maxStorageGB,
        maxOrders:      p.maxOrders,
        maxApiPerDay:   p.maxApiPerDay,
        maxApiPerMonth: p.maxApiPerMonth,
      },
    }));
  }

  // ─── Store Owner: full billing status + usage + plans ────────────────────

  async getStatus(storeId: string) {
    const [sub, quota, store, allPlans] = await Promise.all([
      this.prisma.storeSubscription.findUnique({ where: { storeId } }),
      this.prisma.storeQuotaUsage.findUnique({ where: { storeId } }),
      this.tenant.getOrThrow(storeId),
      this.listPlans(),
    ]);

    const limits = await this.prisma.planLimit.findUnique({ where: { plan: store.plan } });

    const usage = quota ? {
      products:    { used: quota.productCount,  max: limits?.maxProducts ?? 0 },
      staff:       { used: await this.prisma.storeUser.count({ where: { storeId, status: 'ACTIVE' } }), max: limits?.maxStaff ?? 0 },
      storageGB:   { used: Number(quota.storageBytes) / (1024 ** 3), maxGB: limits?.maxStorageGB ?? 0 },
      ordersMonth: { used: quota.orderCount,    max: limits?.maxOrders ?? null },
      apiToday:    { used: quota.apiCallsToday, max: limits?.maxApiPerDay ?? 0 },
    } : null;

    return {
      plan:         store.plan,
      subscription: sub ?? null,
      usage,
      limits:       limits ?? null,
      plans:        allPlans,
    };
  }

  // ─── Store Owner: get invoices (billing history) ──────────────────────────

  async getInvoices(storeId: string) {
    return this.prisma.invoice.findMany({
      where:   { storeId },
      orderBy: { issuedAt: 'desc' },
      take:    50,
    });
  }

  // ─── Store Owner: create/upgrade subscription ─────────────────────────────

  async createSubscription(storeId: string, dto: CreateSubscriptionDto) {
    if (dto.plan === Plan.FREE) {
      throw new BadRequestException(
        'FREE plan does not require a subscription. Cancel your current plan to downgrade.',
      );
    }

    const razorpayPlanId = this.planIds[dto.plan];
    if (!razorpayPlanId) {
      throw new BadRequestException(
        `Razorpay plan ID for "${dto.plan}" is not configured. Contact support.`,
      );
    }

    const store = await this.tenant.getOrThrow(storeId);

    const existing = await this.prisma.storeSubscription.findUnique({ where: { storeId } });
    if (existing && existing.status === SubscriptionStatus.ACTIVE && !existing.cancelAtPeriodEnd) {
      throw new ConflictException(
        'You already have an active subscription. Cancel it first or contact support.',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rzpSub: any;
    try {
      rzpSub = await (this.razorpay.subscriptions as any).create({
        plan_id:         razorpayPlanId,
        total_count:     12,
        quantity:        1,
        customer_notify: 1,
        notes:           { storeId, storeSlug: store.slug, plan: dto.plan },
      });
    } catch (error) {
      this.logger.error('Razorpay subscription creation failed', error);
      throw new BadRequestException('Payment gateway error. Please try again.');
    }

    const sub = await this.prisma.storeSubscription.upsert({
      where:  { storeId },
      create: {
        storeId,
        razorpaySubId:      rzpSub.id,
        razorpayCustomerId: rzpSub.customer_id ?? null,
        razorpayPlanId,
        plan:               dto.plan,
        status:             SubscriptionStatus.CREATED,
      },
      update: {
        razorpaySubId:      rzpSub.id,
        razorpayCustomerId: rzpSub.customer_id ?? null,
        razorpayPlanId,
        plan:               dto.plan,
        status:             SubscriptionStatus.CREATED,
        cancelAtPeriodEnd:  false,
        cancelledAt:        null,
        currentPeriodStart: null,
        currentPeriodEnd:   null,
        trialStart:         null,
        trialEnd:           null,
      },
    });

    await this.logBillingAudit(storeId, null, 'subscription.checkout_initiated', null, {
      plan: dto.plan, razorpaySubId: rzpSub.id,
    });

    this.logger.log(`Subscription created for ${store.slug}: ${rzpSub.id} plan=${dto.plan}`);

    return {
      subscriptionId: sub.razorpaySubId,
      shortUrl:       rzpSub.short_url,
      razorpayKeyId:  this.config.get('RAZORPAY_KEY_ID'),
      plan:           dto.plan,
      status:         sub.status,
    };
  }

  // ─── Store Owner: cancel at period end ───────────────────────────────────

  async cancelSubscription(storeId: string) {
    const sub = await this.prisma.storeSubscription.findUnique({ where: { storeId } });
    if (!sub) throw new NotFoundException('No subscription found');
    if (sub.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }
    if (sub.cancelAtPeriodEnd) {
      throw new BadRequestException('Already scheduled for cancellation at period end');
    }

    // FREE plan has no Razorpay subscription
    if (sub.razorpaySubId) {
      try {
        await (this.razorpay.subscriptions as any).cancel(sub.razorpaySubId, { cancel_at_cycle_end: 1 });
      } catch (error) {
        this.logger.error(`Razorpay cancel failed for ${storeId}`, error);
        throw new BadRequestException('Failed to cancel. Please try again.');
      }
    }

    await this.prisma.storeSubscription.update({
      where: { storeId },
      data:  { cancelAtPeriodEnd: true, cancelledAt: new Date() },
    });

    await this.logBillingAudit(storeId, null, 'subscription.cancel_scheduled', { plan: sub.plan }, {
      periodEnd: sub.currentPeriodEnd,
    });

    return {
      message:          'Subscription will be cancelled at the end of the current billing period',
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  // ─── Store Owner: reactivate cancelled subscription ───────────────────────

  async reactivateSubscription(storeId: string) {
    const sub = await this.prisma.storeSubscription.findUnique({ where: { storeId } });
    if (!sub) throw new NotFoundException('No subscription found');
    if (!sub.cancelAtPeriodEnd) {
      throw new BadRequestException('Subscription is not scheduled for cancellation');
    }

    if (sub.razorpaySubId) {
      try {
        // Razorpay doesn't have a "un-cancel" endpoint; create a fresh subscription
        // instead — handled by client calling createSubscription again
        throw new BadRequestException(
          'To reactivate, please start a new subscription from the Plans page.',
        );
      } catch (error) {
        throw error;
      }
    }

    // For FREE/trial subs we can simply clear the flag
    await this.prisma.storeSubscription.update({
      where: { storeId },
      data:  { cancelAtPeriodEnd: false, cancelledAt: null },
    });

    return { message: 'Subscription reactivated' };
  }

  // ─── Called by StoreProvisioningService when a store is created ───────────

  async initStoreSubscription(storeId: string, plan: Plan): Promise<void> {
    const planConfig = await this.prisma.planLimit.findUnique({ where: { plan } });
    const trialDays = planConfig?.trialDays ?? 0;

    const now = new Date();
    const trialEnd = trialDays > 0
      ? new Date(now.getTime() + trialDays * 86400 * 1000)
      : null;

    const status = trialDays > 0 ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE;

    await this.prisma.storeSubscription.upsert({
      where:  { storeId },
      create: {
        storeId,
        plan,
        status,
        razorpaySubId:      null,
        razorpayCustomerId: null,
        razorpayPlanId:     null,
        currentPeriodStart: now,
        currentPeriodEnd:   trialEnd,
        trialStart:         trialDays > 0 ? now : null,
        trialEnd:           trialEnd,
      },
      update: {},
    });

    if (trialDays > 0) {
      await this.logBillingAudit(storeId, null, 'trial.started', null, {
        plan, trialDays, trialEnd,
      });
    }
  }

  // ─── Cron: expire trials ──────────────────────────────────────────────────

  async expireTrials(): Promise<void> {
    const now = new Date();
    const expiredTrials = await this.prisma.storeSubscription.findMany({
      where: {
        status:  SubscriptionStatus.TRIALING,
        trialEnd: { lte: now },
      },
      include: { store: { select: { id: true, slug: true, plan: true } } },
    });

    for (const sub of expiredTrials) {
      try {
        await this.prisma.$transaction([
          this.prisma.storeSubscription.update({
            where: { id: sub.id },
            data:  { status: SubscriptionStatus.EXPIRED },
          }),
          this.prisma.store.update({
            where: { id: sub.storeId },
            data:  { plan: Plan.FREE },
          }),
        ]);
        this.tenant.invalidateStoreCache(sub.storeId, sub.store.slug);
        await this.invalidatePlanFeatureCache(sub.storeId);
        await this.logBillingAudit(sub.storeId, null, 'trial.expired', { plan: sub.store.plan }, { downgraded: true });
        this.logger.log(`Trial expired for store ${sub.store.slug} → downgraded to FREE`);
      } catch (error) {
        this.logger.error(`Trial expiry failed for store ${sub.storeId}`, error);
      }
    }
  }

  // ─── Cron: mark past-due / expire subscriptions ──────────────────────────

  async checkSubscriptionHealth(): Promise<void> {
    const now = new Date();

    // Subscriptions where period ended but still ACTIVE (Razorpay should send webhook; this is a safety net)
    const overdue = await this.prisma.storeSubscription.findMany({
      where: {
        status:          SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { lte: now },
        razorpaySubId:   { not: null }, // only paid subscriptions; FREE never expires
      },
    });

    for (const sub of overdue) {
      await this.prisma.storeSubscription.update({
        where: { id: sub.id },
        data:  { status: SubscriptionStatus.PAST_DUE },
      });
      await this.logBillingAudit(sub.storeId, null, 'subscription.past_due', null, { razorpaySubId: sub.razorpaySubId });
      this.logger.warn(`Store ${sub.storeId} marked PAST_DUE`);
    }
  }

  // ─── Webhook: Razorpay events ─────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (!this.verifySignature(rawBody, signature)) {
      this.logger.warn('Billing webhook: invalid signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let event: RzpWebhookEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as RzpWebhookEvent;
    } catch {
      this.logger.error('Billing webhook: failed to parse body');
      return;
    }

    if (!HANDLED_EVENTS.has(event.event)) {
      this.logger.debug(`Billing webhook: ignoring "${event.event}"`);
      return;
    }

    // Idempotency key: provider + event-type + subscription ID
    const subId  = event.payload.subscription?.entity?.id ?? '';
    const payId  = event.payload.payment?.entity?.id ?? '';
    const eventId = `${event.event}:${subId || payId}`;

    const alreadyProcessed = await this.markWebhookProcessed('razorpay', eventId, event.event, event);
    if (alreadyProcessed) {
      this.logger.debug(`Billing webhook duplicate ignored: ${eventId}`);
      return;
    }

    this.logger.log(`Billing webhook: ${event.event}`);

    try {
      await this.processEvent(event);
    } catch (error) {
      this.logger.error(`Billing webhook handler error for "${event.event}"`, error);
      // Never rethrow — Razorpay must get 200 or it retries
    }
  }

  // ─── Private: idempotency check + record ─────────────────────────────────

  private async markWebhookProcessed(
    provider: string,
    eventId: string,
    eventType: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any,
  ): Promise<boolean> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          id: crypto.randomUUID(),
          provider,
          eventId,
          eventType,
          payload: payload as object,
        },
      });
      return false; // first time — proceed
    } catch {
      return true; // unique constraint hit → already processed
    }
  }

  // ─── Private: event dispatch ──────────────────────────────────────────────

  private async processEvent(event: RzpWebhookEvent): Promise<void> {
    const subEntity = event.payload.subscription?.entity;
    if (!subEntity) return;

    const sub = await this.prisma.storeSubscription.findUnique({
      where: { razorpaySubId: subEntity.id },
    });
    if (!sub) {
      this.logger.warn(`No subscription for rzpSubId=${subEntity.id}`);
      return;
    }

    const newStatus = STATUS_MAP[subEntity.status] ?? sub.status;

    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.resumed': {
        const periodStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : null;
        const periodEnd   = subEntity.current_end   ? new Date(subEntity.current_end   * 1000) : null;
        const chargeAt    = subEntity.charge_at     ? new Date(subEntity.charge_at     * 1000) : null;

        await this.prisma.storeSubscription.update({
          where: { razorpaySubId: subEntity.id },
          data: {
            status:             SubscriptionStatus.ACTIVE,
            currentPeriodStart: periodStart,
            currentPeriodEnd:   periodEnd,
            chargeAt,
            cancelAtPeriodEnd:  subEntity.cancel_at_cycle_end === 1,
          },
        });

        await this.prisma.store.update({
          where: { id: sub.storeId },
          data:  { plan: sub.plan },
        });

        // Create invoice on each charge
        if (event.event === 'subscription.charged') {
          const payEntity = event.payload.payment?.entity;
          await this.createInvoice({
            storeId:           sub.storeId,
            subscriptionId:    sub.id,
            plan:              sub.plan,
            amountPaise:       payEntity?.amount ?? 0,
            periodStart:       periodStart,
            periodEnd:         periodEnd,
            providerInvoiceId: payEntity?.invoice_id ?? undefined,
          });
        }

        const store = await this.prisma.store.findUnique({ where: { id: sub.storeId } });
        if (store) {
          this.tenant.invalidateStoreCache(sub.storeId, store.slug);
          await this.invalidatePlanFeatureCache(sub.storeId);
        }

        await this.logBillingAudit(sub.storeId, null, `subscription.${event.event.split('.')[1]}`, { status: sub.status }, { plan: sub.plan, newStatus: 'ACTIVE' });
        this.logger.log(`${event.event}: store=${sub.storeId} plan=${sub.plan}`);
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.expired': {
        await this.prisma.storeSubscription.update({
          where: { razorpaySubId: subEntity.id },
          data:  { status: newStatus },
        });

        await this.prisma.store.update({
          where: { id: sub.storeId },
          data:  { plan: Plan.FREE },
        });

        const store = await this.prisma.store.findUnique({ where: { id: sub.storeId } });
        if (store) {
          this.tenant.invalidateStoreCache(sub.storeId, store.slug);
          await this.invalidatePlanFeatureCache(sub.storeId);
        }

        await this.logBillingAudit(sub.storeId, null, `subscription.${event.event.split('.')[1]}`, { plan: sub.plan }, { newPlan: 'FREE' });
        this.logger.log(`${event.event}: store=${sub.storeId} downgraded to FREE`);
        break;
      }

      case 'subscription.paused': {
        await this.prisma.storeSubscription.update({
          where: { razorpaySubId: subEntity.id },
          data:  { status: SubscriptionStatus.PAUSED },
        });
        await this.logBillingAudit(sub.storeId, null, 'subscription.paused', null, null);
        break;
      }
    }
  }

  // ─── Super Admin: list all subscriptions ─────────────────────────────────

  async adminListSubscriptions(filters?: { status?: SubscriptionStatus; plan?: Plan }) {
    return this.prisma.storeSubscription.findMany({
      where:   filters ?? {},
      include: { store: { select: { id: true, name: true, slug: true } } },
      orderBy: { updatedAt: 'desc' },
      take:    200,
    });
  }

  // ─── Super Admin: manually change store plan ──────────────────────────────

  async adminChangePlan(
    storeId: string,
    newPlan: Plan,
    actorId: string,
    reason?: string,
  ): Promise<void> {
    const store = await this.tenant.getOrThrow(storeId);
    const oldPlan = store.plan;

    await this.prisma.$transaction([
      this.prisma.store.update({ where: { id: storeId }, data: { plan: newPlan } }),
      this.prisma.storeSubscription.update({
        where: { storeId },
        data:  { plan: newPlan, status: SubscriptionStatus.ACTIVE },
      }),
    ]);

    // Ensure PlanLimit row exists for the new plan
    const display = DEFAULT_PLAN_DISPLAY[newPlan];
    await this.prisma.planLimit.upsert({
      where:  { plan: newPlan },
      create: {
        plan: newPlan,
        ...DEFAULT_PLAN_LIMITS[newPlan],
        displayName:  display.name,
        description:  display.description,
        priceMonthly: display.priceMonthly,
        priceYearly:  display.priceYearly,
        trialDays:    display.trialDays,
        sortOrder:    display.sortOrder,
        features:     display.features as unknown as object[],
        isActive:     true,
      },
      update: {},
    });

    this.tenant.invalidateStoreCache(storeId, store.slug);
    await this.invalidatePlanFeatureCache(storeId);

    await this.logBillingAudit(storeId, actorId, 'plan.admin_changed', { plan: oldPlan }, { plan: newPlan, reason });
    this.logger.log(`Super Admin ${actorId} changed store ${storeId}: ${oldPlan} → ${newPlan}`);
  }

  // ─── Super Admin: extend trial ────────────────────────────────────────────

  async adminExtendTrial(storeId: string, extraDays: number, actorId: string): Promise<void> {
    const sub = await this.prisma.storeSubscription.findUnique({ where: { storeId } });
    if (!sub) throw new NotFoundException('No subscription found');

    const baseDate = sub.trialEnd ?? new Date();
    const newTrialEnd = new Date(baseDate.getTime() + extraDays * 86400 * 1000);

    await this.prisma.storeSubscription.update({
      where: { storeId },
      data:  { trialEnd: newTrialEnd, currentPeriodEnd: newTrialEnd, status: SubscriptionStatus.TRIALING },
    });

    await this.logBillingAudit(storeId, actorId, 'trial.extended', { trialEnd: sub.trialEnd }, { newTrialEnd, extraDays });
  }

  // ─── Super Admin: billing dashboard ──────────────────────────────────────

  async adminGetDashboard() {
    const [byPlan, byStatus, recentInvoices] = await Promise.all([
      this.prisma.store.groupBy({ by: ['plan'], _count: { id: true } }),
      this.prisma.storeSubscription.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.invoice.findMany({
        where:   { status: InvoiceStatus.PAID },
        orderBy: { paidAt: 'desc' },
        take:    20,
        include: { store: { select: { name: true, slug: true } } },
      }),
    ]);

    const mrrPaise = await this.prisma.invoice.aggregate({
      _sum:   { amount: true },
      where:  { status: InvoiceStatus.PAID, issuedAt: { gte: new Date(Date.now() - 30 * 86400 * 1000) } },
    });

    return {
      planDistribution: byPlan.map((r) => ({ plan: r.plan, stores: r._count.id })),
      subscriptionStatus: byStatus.map((r) => ({ status: r.status, count: r._count.id })),
      mrrPaise:       mrrPaise._sum.amount ?? 0,
      recentInvoices,
    };
  }

  // ─── Super Admin: manage plan limits ─────────────────────────────────────

  async adminGetPlanLimits() {
    return this.prisma.planLimit.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async adminUpdatePlanLimit(
    plan: Plan,
    actorId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updates: Record<string, any>,
  ) {
    const before = await this.prisma.planLimit.findUnique({ where: { plan } });

    const d = DEFAULT_PLAN_DISPLAY[plan];
    const updated = await this.prisma.planLimit.upsert({
      where:  { plan },
      create: {
        plan,
        ...DEFAULT_PLAN_LIMITS[plan],
        displayName:  d.name,
        description:  d.description,
        priceMonthly: d.priceMonthly,
        priceYearly:  d.priceYearly,
        trialDays:    d.trialDays,
        sortOrder:    d.sortOrder,
        features:     d.features as unknown as object[],
        isActive:     true,
        ...updates,
      },
      update: updates,
    });

    // Invalidate plan feature caches for all stores on this plan
    await this.invalidatePlanFeatureCacheByPlan(plan);

    await this.logBillingAudit(null, actorId, 'plan.updated', before as object, updated as object);
    return updated;
  }

  // ─── Invoice helper ───────────────────────────────────────────────────────

  private async createInvoice(opts: {
    storeId:           string;
    subscriptionId?:   string;
    plan:              Plan;
    amountPaise:       number;
    periodStart?:      Date | null;
    periodEnd?:        Date | null;
    providerInvoiceId?: string;
  }) {
    const planLimit = await this.prisma.planLimit.findUnique({ where: { plan: opts.plan } });
    const taxRatePct = planLimit?.taxRatePct ?? 18;
    const baseAmount = Math.round(opts.amountPaise / (1 + taxRatePct / 100));
    const tax = opts.amountPaise - baseAmount;

    const invoiceNumber = await this.nextInvoiceNumber();

    await this.prisma.invoice.create({
      data: {
        id:                 crypto.randomUUID(),
        invoiceNumber,
        storeId:            opts.storeId,
        subscriptionId:     opts.subscriptionId ?? null,
        plan:               opts.plan,
        planSnapshot:       (planLimit ?? {}) as object,
        amount:             opts.amountPaise,
        tax,
        currency:           'INR',
        status:             InvoiceStatus.PAID,
        billingPeriodStart: opts.periodStart ?? null,
        billingPeriodEnd:   opts.periodEnd   ?? null,
        providerInvoiceId:  opts.providerInvoiceId ?? null,
        issuedAt:           new Date(),
        paidAt:             new Date(),
      },
    });
  }

  private async nextInvoiceNumber(): Promise<string> {
    const year  = new Date().getFullYear();
    const count = await this.prisma.invoice.count({
      where: { invoiceNumber: { startsWith: `INV-${year}-` } },
    });
    return `INV-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  // ─── Billing audit ────────────────────────────────────────────────────────

  async logBillingAudit(
    storeId: string | null,
    actorId: string | null,
    action: string,
    oldValue?: object | null,
    newValue?: object | null,
  ): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const old: any = oldValue ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nv: any = newValue ?? null;
      await this.prisma.billingAuditLog.create({
        data: {
          id:       crypto.randomUUID(),
          storeId:  storeId  ?? null,
          actorId:  actorId  ?? null,
          action,
          oldValue: old,
          newValue: nv,
        },
      });
    } catch {
      // audit log must never block the main flow
    }
  }

  // ─── Cache invalidation ───────────────────────────────────────────────────

  async invalidatePlanFeatureCache(storeId: string): Promise<void> {
    await this.redis.del(`store:${storeId}:plan:features`);
  }

  private async invalidatePlanFeatureCacheByPlan(plan: Plan): Promise<void> {
    // Find all stores on this plan and clear their feature caches
    const stores = await this.prisma.store.findMany({
      where:  { plan },
      select: { id: true },
    });
    for (const s of stores) {
      await this.redis.del(`store:${s.id}:plan:features`);
    }
  }

  // ─── HMAC verification ────────────────────────────────────────────────────

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
