import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { OrderStatus, Prisma } from '@prisma/client';
import { QUEUE_ANALYTICS, JOB_NIGHTLY_REPORT } from '../queues/queue.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../notifications/redis.service';
import type { AnalyticsQueryDto } from './dto/analytics-query.dto';

const OVERVIEW_CACHE_TTL_SEC = 300; // 5 minutes

const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

interface DateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_ANALYTICS) private readonly analyticsQueue: Queue,
    private readonly redis: RedisService,
  ) {}

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

  // ─── 1. Overview KPIs ─────────────────────────────────────────────────────

  async getOverview(storeId: string, dto: AnalyticsQueryDto) {
    // Cache with 5-min TTL per store+period — overview is expensive (8 DB queries)
    const cacheKey = `analytics:overview:${storeId}:${dto.from ?? 'default'}:${dto.to ?? 'default'}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* Redis unavailable — proceed without cache */ }

    const result = await this._computeOverview(storeId, dto);

    try {
      await this.redis.setEx(cacheKey, OVERVIEW_CACHE_TTL_SEC, JSON.stringify(result));
    } catch { /* ignore cache write failure */ }

    return result;
  }

  private async _computeOverview(storeId: string, dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const periodMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodMs);
    const prevTo   = new Date(from.getTime() - 1);

    const baseWhere = { storeId };

    // Use Promise.all — $transaction only accepts PrismaPromise[], not plain Promise
    const [
      revenueAgg,
      prevRevenueAgg,
      orderCount,
      prevOrderCount,
      newCustomers,
      prevNewCustomers,
      activeProducts,
      avgOrderAgg,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: { ...baseWhere, status: { in: REVENUE_STATUSES }, createdAt: { gte: from, lte: to } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { ...baseWhere, status: { in: REVENUE_STATUSES }, createdAt: { gte: prevFrom, lte: prevTo } },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: { ...baseWhere, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.order.count({
        where: { ...baseWhere, createdAt: { gte: prevFrom, lte: prevTo } },
      }),
      // Unique customers who placed orders with this store in the period
      this.prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`SELECT COUNT(DISTINCT "userId")::bigint AS count FROM "Order" WHERE "storeId" = ${storeId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}`,
      ).then((r) => Number(r[0]?.count ?? 0)),
      this.prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`SELECT COUNT(DISTINCT "userId")::bigint AS count FROM "Order" WHERE "storeId" = ${storeId} AND "createdAt" >= ${prevFrom} AND "createdAt" <= ${prevTo}`,
      ).then((r) => Number(r[0]?.count ?? 0)),
      this.prisma.product.count({ where: { storeId, isActive: true } }),
      this.prisma.order.aggregate({
        where: { ...baseWhere, status: { in: REVENUE_STATUSES }, createdAt: { gte: from, lte: to } },
        _avg: { total: true },
      }),
    ]);

    const revenue     = revenueAgg._sum.total     ?? 0;
    const prevRevenue = prevRevenueAgg._sum.total  ?? 0;

    return {
      period: { from, to },
      revenue: {
        total:  Number(revenue),
        growth: this.growthRate(Number(revenue), Number(prevRevenue)),
      },
      orders: {
        total:  orderCount,
        growth: this.growthRate(orderCount, prevOrderCount),
      },
      customers: {
        new:    newCustomers,
        growth: this.growthRate(newCustomers, prevNewCustomers),
      },
      products: {
        active: activeProducts,
      },
      avgOrderValue: Number(avgOrderAgg._avg.total ?? 0),
    };
  }

  // ─── 2. Sales Trend ───────────────────────────────────────────────────────

  async getSalesTrend(storeId: string, dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const granularity  = dto.granularity ?? 'day';

    const rows = await this.prisma.$queryRaw<
      Array<{ bucket: Date; revenue: number; orders: bigint }>
    >(
      Prisma.sql`
        SELECT
          DATE_TRUNC(${granularity}, "createdAt" AT TIME ZONE 'UTC') AS bucket,
          COALESCE(SUM(total), 0)::float                             AS revenue,
          COUNT(*)::bigint                                           AS orders
        FROM "Order"
        WHERE "storeId" = ${storeId}
          AND "createdAt" >= ${from}
          AND "createdAt" <= ${to}
          AND status::text = ANY(${REVENUE_STATUSES}::text[])
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    );

    return {
      granularity,
      period: { from, to },
      data: rows.map((r) => ({
        bucket:  r.bucket,
        revenue: Number(r.revenue),
        orders:  Number(r.orders),
      })),
    };
  }

  // ─── 3. Top Products ──────────────────────────────────────────────────────

  async getTopProducts(storeId: string, dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const limit = dto.limit ?? 10;

    const rows = await this.prisma.$queryRaw<
      Array<{
        productId:    string;
        name:         string;
        slug:         string;
        imageUrl:     string | null;
        totalRevenue: number;
        totalSold:    bigint;
        orderCount:   bigint;
      }>
    >(
      Prisma.sql`
        SELECT
          p.id                                AS "productId",
          p.name,
          p.slug,
          (SELECT url FROM "ProductImage" WHERE "productId" = p.id AND "isPrimary" = true LIMIT 1) AS "imageUrl",
          COALESCE(SUM(oi.price * oi.quantity), 0)::float AS "totalRevenue",
          COALESCE(SUM(oi.quantity), 0)::bigint           AS "totalSold",
          COUNT(DISTINCT oi."orderId")::bigint            AS "orderCount"
        FROM "OrderItem"    oi
        JOIN "ProductVariant" pv ON pv.id = oi."variantId"
        JOIN "Product"        p  ON p.id  = pv."productId"
        JOIN "Order"          o  ON o.id  = oi."orderId"
        WHERE o."storeId" = ${storeId}
          AND o."createdAt" >= ${from}
          AND o."createdAt" <= ${to}
          AND o.status::text = ANY(${REVENUE_STATUSES}::text[])
        GROUP BY p.id, p.name, p.slug
        ORDER BY "totalRevenue" DESC
        LIMIT ${limit}
      `,
    );

    return {
      period: { from, to },
      products: rows.map((r) => ({
        productId:    r.productId,
        name:         r.name,
        slug:         r.slug,
        imageUrl:     r.imageUrl,
        totalRevenue: Number(r.totalRevenue),
        totalSold:    Number(r.totalSold),
        orderCount:   Number(r.orderCount),
      })),
    };
  }

  // ─── 4. Order Status Distribution ─────────────────────────────────────────

  async getOrderStatusDistribution(storeId: string, dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);

    const groups = await this.prisma.order.groupBy({
      by: ['status'],
      where: { storeId, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    });

    const total = groups.reduce((acc, g) => acc + g._count._all, 0);

    return {
      period: { from, to },
      total,
      distribution: groups
        .sort((a, b) => b._count._all - a._count._all)
        .map((g) => ({
          status:     g.status,
          count:      g._count._all,
          percentage: total > 0 ? parseFloat(((g._count._all / total) * 100).toFixed(2)) : 0,
        })),
    };
  }

  // ─── 5. Payment Analytics ─────────────────────────────────────────────────

  async getPaymentAnalytics(storeId: string, dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);

    // Use subquery via raw SQL to avoid loading all order IDs into memory
    const [statusGroups, methodGroups, refundAgg] = await Promise.all([
      this.prisma.$queryRaw<Array<{ status: string; count: bigint; amount: number }>>(
        Prisma.sql`
          SELECT p.status, COUNT(*)::bigint AS count, COALESCE(SUM(p.amount), 0)::float AS amount
          FROM "Payment" p
          JOIN "Order" o ON o.id = p."orderId"
          WHERE o."storeId" = ${storeId} AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
          GROUP BY p.status
        `,
      ),
      this.prisma.$queryRaw<Array<{ method: string; count: bigint; amount: number }>>(
        Prisma.sql`
          SELECT p.method, COUNT(*)::bigint AS count, COALESCE(SUM(p.amount), 0)::float AS amount
          FROM "Payment" p
          JOIN "Order" o ON o.id = p."orderId"
          WHERE o."storeId" = ${storeId} AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
          GROUP BY p.method
        `,
      ),
      this.prisma.$queryRaw<[{ count: bigint; refund_amount: number }]>(
        Prisma.sql`
          SELECT COUNT(*)::bigint AS count, COALESCE(SUM(p."refundAmount"), 0)::float AS refund_amount
          FROM "Payment" p
          JOIN "Order" o ON o.id = p."orderId"
          WHERE o."storeId" = ${storeId} AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
            AND p.status = 'REFUNDED'
        `,
      ),
    ]);

    const totalPayments = statusGroups.reduce((acc, g) => acc + Number(g.count), 0);
    const successCount  = statusGroups.find((g) => g.status === 'SUCCESS')?.count ?? BigInt(0);
    const successRate   = totalPayments > 0
      ? parseFloat(((Number(successCount) / totalPayments) * 100).toFixed(2))
      : 0;

    const refund = refundAgg[0];
    return {
      period: { from, to },
      successRate,
      statusDistribution: statusGroups.map((g) => ({
        status: g.status,
        count:  Number(g.count),
        amount: Number(g.amount),
      })),
      methodDistribution: methodGroups.map((g) => ({
        method: g.method,
        count:  Number(g.count),
        amount: Number(g.amount),
      })),
      refunds: {
        count:  Number(refund?.count ?? 0),
        amount: Number(refund?.refund_amount ?? 0),
      },
    };
  }

  // ─── 6. Delivery Analytics ────────────────────────────────────────────────

  async getDeliveryAnalytics(storeId: string, dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);

    const deliveryGroups = await this.prisma.$queryRaw<
      Array<{ type: string; status: string; count: bigint }>
    >(
      Prisma.sql`
        SELECT d.type, d.status, COUNT(*)::bigint AS count
        FROM "Delivery" d
        JOIN "Order" o ON o.id = d."orderId"
        WHERE o."storeId" = ${storeId} AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
        GROUP BY d.type, d.status
      `,
    );

    if (deliveryGroups.length === 0) {
      return { period: { from, to }, total: 0, successRate: 0, avgDeliveryHours: null, distribution: [] };
    }

    const total     = deliveryGroups.reduce((acc, g) => acc + Number(g.count), 0);
    const delivered = deliveryGroups
      .filter((g) => g.status === 'DELIVERED')
      .reduce((acc, g) => acc + Number(g.count), 0);
    const successRate = total > 0 ? parseFloat(((delivered / total) * 100).toFixed(2)) : 0;

    return {
      period: { from, to },
      total,
      successRate,
      avgDeliveryHours: null,
      distribution: deliveryGroups.map((g) => ({
        type:   g.type,
        status: g.status,
        count:  Number(g.count),
      })),
    };
  }

  // ─── 7. Customer Growth ───────────────────────────────────────────────────

  async getCustomerGrowth(storeId: string, dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const granularity  = dto.granularity ?? 'day';

    // Customers scoped to this store = unique users who have ordered from this store
    const [growthRows, totalCustomers, verifiedCount] = await Promise.all([
      this.prisma.$queryRaw<Array<{ bucket: Date; newCustomers: bigint }>>(
        Prisma.sql`
          SELECT
            DATE_TRUNC(${granularity}, o."createdAt" AT TIME ZONE 'UTC') AS bucket,
            COUNT(DISTINCT o."userId")::bigint AS "newCustomers"
          FROM "Order" o
          WHERE o."storeId" = ${storeId}
            AND o."createdAt" >= ${from}
            AND o."createdAt" <= ${to}
          GROUP BY bucket
          ORDER BY bucket ASC
        `,
      ),
      // Total unique customers for this store (all time) — use COUNT DISTINCT
      this.prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`SELECT COUNT(DISTINCT "userId")::bigint AS count FROM "Order" WHERE "storeId" = ${storeId}`,
      ).then((rows) => Number(rows[0]?.count ?? 0)),
      // Verified customers (joined via User)
      this.prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`
          SELECT COUNT(DISTINCT o."userId")::bigint AS count
          FROM "Order" o
          JOIN "User" u ON u.id = o."userId"
          WHERE o."storeId" = ${storeId}
            AND u."isVerified" = true
        `,
      ).then((rows) => Number(rows[0]?.count ?? 0)),
    ]);

    return {
      granularity,
      period: { from, to },
      totals: {
        total:      totalCustomers,
        verified:   verifiedCount,
        unverified: totalCustomers - verifiedCount,
      },
      growth: growthRows.map((r) => ({
        bucket:       r.bucket,
        newCustomers: Number(r.newCustomers),
      })),
    };
  }

  // ─── 8. Low-Stock Summary ─────────────────────────────────────────────────

  async getLowStockSummary(storeId: string) {
    const LOW_STOCK_THRESHOLD = 5;

    const [outOfStock, lowStock] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where: { stock: 0, product: { storeId, isActive: true } },
        select: {
          id: true, sku: true, stock: true,
          product: { select: { id: true, name: true, slug: true, category: { select: { name: true } } } },
          size: true, color: true,
        },
        orderBy: { product: { name: 'asc' } },
      }),
      this.prisma.productVariant.findMany({
        where: { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD }, product: { storeId, isActive: true } },
        select: {
          id: true, sku: true, stock: true,
          product: { select: { id: true, name: true, slug: true, category: { select: { name: true } } } },
          size: true, color: true,
        },
        orderBy: { stock: 'asc' },
      }),
    ]);

    return {
      threshold: LOW_STOCK_THRESHOLD,
      outOfStock: { count: outOfStock.length, items: outOfStock },
      lowStock:   { count: lowStock.length,   items: lowStock   },
    };
  }

  // ─── BullMQ: Nightly Report Trigger ───────────────────────────────────────

  async generateNightlyReport(): Promise<void> {
    await this.analyticsQueue.add(
      JOB_NIGHTLY_REPORT,
      {},
      { attempts: 2, removeOnComplete: true },
    );
    this.logger.log('Nightly report job enqueued');
  }
}
