import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, SubscriptionStatus, Plan, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AnalyticsQueryDto } from './dto/analytics-query.dto';

const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

// Approximate monthly pricing per plan (for MRR estimation) — mirror Razorpay plan amounts
const PLAN_MONTHLY_PRICE: Record<Plan, number> = {
  [Plan.FREE]:         0,
  [Plan.STARTER]:      999,
  [Plan.PROFESSIONAL]: 2999,
  [Plan.ENTERPRISE]:   9999,
};

interface DateRange { from: Date; to: Date }

@Injectable()
export class SuperAdminAnalyticsService {
  private readonly logger = new Logger(SuperAdminAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private resolveDateRange(dto: AnalyticsQueryDto): DateRange {
    const to   = dto.to   ? new Date(dto.to)   : new Date();
    const from = dto.from ? new Date(dto.from)  : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    to.setHours(23, 59, 59, 999);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  private growthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return parseFloat((((current - previous) / previous) * 100).toFixed(2));
  }

  // ─── 1. Platform Overview KPIs ────────────────────────────────────────────

  async getPlatformOverview(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const periodMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodMs);
    const prevTo   = new Date(from.getTime() - 1);

    const [
      totalStores,
      activeStores,
      newStores,
      prevNewStores,
      totalRevenue,
      prevTotalRevenue,
      totalOrders,
      prevTotalOrders,
      totalCustomers,
      subsByStatus,
      subsByPlan,
    ] = await this.prisma.$transaction([
      this.prisma.store.count(),
      this.prisma.store.count({ where: { isActive: true } }),
      // Stores created in this period
      this.prisma.store.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.store.count({ where: { createdAt: { gte: prevFrom, lte: prevTo } } }),
      // Platform-wide revenue (all stores)
      this.prisma.order.aggregate({
        where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: from, lte: to } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: prevFrom, lte: prevTo } },
        _sum: { total: true },
      }),
      this.prisma.order.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.order.count({ where: { createdAt: { gte: prevFrom, lte: prevTo } } }),
      // Total unique customers across all stores
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      // Subscription status breakdown
      this.prisma.storeSubscription.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      // Active subscriptions by plan
      this.prisma.storeSubscription.groupBy({
        by: ['plan'],
        where: { status: SubscriptionStatus.ACTIVE },
        _count: { _all: true },
        orderBy: { plan: 'asc' },
      }),
    ]);

    // Estimate MRR from active subscriptions
    type GroupCount = { _count: { _all: number } };
    const mrr = (subsByPlan as unknown as (typeof subsByPlan[0] & GroupCount)[]).reduce((acc, g) => {
      return acc + g._count._all * (PLAN_MONTHLY_PRICE[g.plan] ?? 0);
    }, 0);

    const revenue     = Number(totalRevenue._sum.total     ?? 0);
    const prevRevenue = Number(prevTotalRevenue._sum.total ?? 0);

    return {
      period: { from, to },
      stores: {
        total:   totalStores,
        active:  activeStores,
        inactive: totalStores - activeStores,
        newInPeriod: newStores,
        newGrowth:   this.growthRate(newStores, prevNewStores),
      },
      revenue: {
        total:  revenue,
        growth: this.growthRate(revenue, prevRevenue),
      },
      orders: {
        total:  totalOrders,
        growth: this.growthRate(totalOrders, prevTotalOrders),
      },
      customers: { total: totalCustomers },
      mrr,
      subscriptions: {
        byStatus: Object.fromEntries(
          (subsByStatus as unknown as (typeof subsByStatus[0] & GroupCount)[])
            .map((g) => [g.status, g._count._all]),
        ),
        byPlan: Object.fromEntries(
          (subsByPlan as unknown as (typeof subsByPlan[0] & GroupCount)[])
            .map((g) => [g.plan, g._count._all]),
        ),
        activeTotal: (subsByPlan as unknown as (typeof subsByPlan[0] & GroupCount)[])
          .reduce((acc, g) => acc + g._count._all, 0),
      },
    };
  }

  // ─── 2. Top Stores by Revenue ─────────────────────────────────────────────

  async getTopStores(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const limit = dto.limit ?? 10;

    const rows = await this.prisma.$queryRaw<Array<{
      storeId:    string;
      storeName:  string;
      storeSlug:  string;
      plan:       string;
      revenue:    number;
      orderCount: bigint;
    }>>(
      Prisma.sql`
        SELECT
          s.id        AS "storeId",
          s.name      AS "storeName",
          s.slug      AS "storeSlug",
          s.plan::text AS plan,
          COALESCE(SUM(o.total), 0)::float AS revenue,
          COUNT(o.id)::bigint              AS "orderCount"
        FROM "Store" s
        LEFT JOIN "Order" o
          ON o."storeId" = s.id
         AND o."createdAt" >= ${from}
         AND o."createdAt" <= ${to}
         AND o.status::text = ANY(${REVENUE_STATUSES}::text[])
        GROUP BY s.id, s.name, s.slug, s.plan
        ORDER BY revenue DESC
        LIMIT ${limit}
      `,
    );

    return {
      period: { from, to },
      stores: rows.map((r) => ({
        storeId:    r.storeId,
        storeName:  r.storeName,
        storeSlug:  r.storeSlug,
        plan:       r.plan,
        revenue:    Number(r.revenue),
        orderCount: Number(r.orderCount),
      })),
    };
  }

  // ─── 3. Subscription Metrics & Churn ──────────────────────────────────────

  async getSubscriptionMetrics(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);

    const [
      allSubs,
      cancelledInPeriod,
      activatedInPeriod,
      planCounts,
    ] = await this.prisma.$transaction([
      // All subscriptions snapshot
      this.prisma.storeSubscription.findMany({
        select: {
          plan:             true,
          status:           true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: true,
          store: { select: { id: true, name: true, slug: true } },
        },
      }),
      // Cancelled in period (subscription.updatedAt approximation)
      this.prisma.storeSubscription.count({
        where: { status: SubscriptionStatus.CANCELLED, updatedAt: { gte: from, lte: to } },
      }),
      // Activated in period
      this.prisma.storeSubscription.count({
        where: { status: SubscriptionStatus.ACTIVE, updatedAt: { gte: from, lte: to } },
      }),
      // All plans (free included) distribution at store level
      this.prisma.store.groupBy({
        by: ['plan'],
        _count: { _all: true },
        orderBy: { plan: 'asc' },
      }),
    ]);

    const activeCount    = allSubs.filter((s) => s.status === SubscriptionStatus.ACTIVE).length;
    const scheduledChurn = allSubs.filter((s) => s.cancelAtPeriodEnd).length;

    // MRR breakdown by plan
    const mrrByPlan = allSubs
      .filter((s) => s.status === SubscriptionStatus.ACTIVE)
      .reduce<Record<string, number>>((acc, s) => {
        const price = PLAN_MONTHLY_PRICE[s.plan] ?? 0;
        acc[s.plan] = (acc[s.plan] ?? 0) + price;
        return acc;
      }, {});

    const totalMrr = Object.values(mrrByPlan).reduce((a, b) => a + b, 0);

    const churnRate = activeCount + cancelledInPeriod > 0
      ? parseFloat(((cancelledInPeriod / (activeCount + cancelledInPeriod)) * 100).toFixed(2))
      : 0;

    return {
      period: { from, to },
      mrr: {
        total: totalMrr,
        byPlan: mrrByPlan,
      },
      subscriptions: {
        active:        activeCount,
        scheduledChurn,
        cancelledInPeriod,
        activatedInPeriod,
        churnRate,
      },
      planDistribution: Object.fromEntries(
        (planCounts as unknown as (typeof planCounts[0] & { _count: { _all: number } })[])
          .map((g) => [g.plan, g._count._all]),
      ),
    };
  }

  // ─── 4. API Usage by Store ────────────────────────────────────────────────

  async getApiUsageByStore(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const limit = dto.limit ?? 20;

    const rows = await this.prisma.$queryRaw<Array<{
      storeId:    string;
      storeName:  string;
      storeSlug:  string;
      plan:       string;
      totalCalls: bigint;
      errorCalls: bigint;
      avgDuration: number;
      p95Duration: number;
    }>>(
      Prisma.sql`
        SELECT
          s.id          AS "storeId",
          s.name        AS "storeName",
          s.slug        AS "storeSlug",
          s.plan::text  AS plan,
          COUNT(l.id)::bigint                        AS "totalCalls",
          COUNT(l.id) FILTER (WHERE l."statusCode" >= 400)::bigint AS "errorCalls",
          COALESCE(AVG(l."durationMs"), 0)::float    AS "avgDuration",
          COALESCE(
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY l."durationMs"), 0
          )::float                                   AS "p95Duration"
        FROM "Store" s
        LEFT JOIN "TenantApiLog" l
          ON l."storeId" = s.id
         AND l."createdAt" >= ${from}
         AND l."createdAt" <= ${to}
        GROUP BY s.id, s.name, s.slug, s.plan
        ORDER BY "totalCalls" DESC
        LIMIT ${limit}
      `,
    );

    return {
      period: { from, to },
      stores: rows.map((r) => ({
        storeId:     r.storeId,
        storeName:   r.storeName,
        storeSlug:   r.storeSlug,
        plan:        r.plan,
        totalCalls:  Number(r.totalCalls),
        errorCalls:  Number(r.errorCalls),
        errorRate:   Number(r.totalCalls) > 0
          ? parseFloat(((Number(r.errorCalls) / Number(r.totalCalls)) * 100).toFixed(2))
          : 0,
        avgDurationMs: parseFloat(Number(r.avgDuration).toFixed(2)),
        p95DurationMs: parseFloat(Number(r.p95Duration).toFixed(2)),
      })),
    };
  }

  // ─── 5. New Stores Trend ──────────────────────────────────────────────────

  async getNewStoresTrend(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const granularity  = dto.granularity ?? 'day';

    const rows = await this.prisma.$queryRaw<Array<{ bucket: Date; newStores: bigint }>>(
      Prisma.sql`
        SELECT
          DATE_TRUNC(${granularity}, "createdAt" AT TIME ZONE 'UTC') AS bucket,
          COUNT(*)::bigint AS "newStores"
        FROM "Store"
        WHERE "createdAt" >= ${from}
          AND "createdAt" <= ${to}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    );

    return {
      granularity,
      period: { from, to },
      data: rows.map((r) => ({
        bucket:    r.bucket,
        newStores: Number(r.newStores),
      })),
    };
  }

  // ─── 6. Revenue by Store (table) ──────────────────────────────────────────

  async getRevenueByStore(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const limit = dto.limit ?? 50;

    const rows = await this.prisma.$queryRaw<Array<{
      storeId:        string;
      storeName:      string;
      storeSlug:      string;
      plan:           string;
      isActive:       boolean;
      revenue:        number;
      orderCount:     bigint;
      avgOrderValue:  number;
      customerCount:  bigint;
    }>>(
      Prisma.sql`
        SELECT
          s.id          AS "storeId",
          s.name        AS "storeName",
          s.slug        AS "storeSlug",
          s.plan::text  AS plan,
          s."isActive"  AS "isActive",
          COALESCE(SUM(o.total), 0)::float               AS revenue,
          COUNT(DISTINCT o.id)::bigint                   AS "orderCount",
          COALESCE(AVG(o.total), 0)::float               AS "avgOrderValue",
          COUNT(DISTINCT o."userId")::bigint             AS "customerCount"
        FROM "Store" s
        LEFT JOIN "Order" o
          ON o."storeId" = s.id
         AND o."createdAt" >= ${from}
         AND o."createdAt" <= ${to}
         AND o.status::text = ANY(${REVENUE_STATUSES}::text[])
        GROUP BY s.id, s.name, s.slug, s.plan, s."isActive"
        ORDER BY revenue DESC
        LIMIT ${limit}
      `,
    );

    const totalRevenue = rows.reduce((acc, r) => acc + Number(r.revenue), 0);

    return {
      period: { from, to },
      totalRevenue,
      stores: rows.map((r) => ({
        storeId:       r.storeId,
        storeName:     r.storeName,
        storeSlug:     r.storeSlug,
        plan:          r.plan,
        isActive:      r.isActive,
        revenue:       Number(r.revenue),
        revenueShare:  totalRevenue > 0
          ? parseFloat(((Number(r.revenue) / totalRevenue) * 100).toFixed(2))
          : 0,
        orderCount:    Number(r.orderCount),
        avgOrderValue: parseFloat(Number(r.avgOrderValue).toFixed(2)),
        customerCount: Number(r.customerCount),
      })),
    };
  }
}
