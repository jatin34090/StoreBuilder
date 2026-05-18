import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Role, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AnalyticsQueryDto } from './dto/analytics-query.dto';

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

  // ─── 1. Overview KPIs ─────────────────────────────────────────────────────

  async getOverview(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const periodMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodMs);
    const prevTo   = new Date(from.getTime() - 1);

    const [
      revenueAgg,
      prevRevenueAgg,
      orderCount,
      prevOrderCount,
      newCustomers,
      prevNewCustomers,
      activeProducts,
      avgOrderAgg,
    ] = await this.prisma.$transaction([
      // Current period revenue
      this.prisma.order.aggregate({
        where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: from, lte: to } },
        _sum: { total: true },
      }),
      // Previous period revenue
      this.prisma.order.aggregate({
        where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: prevFrom, lte: prevTo } },
        _sum: { total: true },
      }),
      // Current period order count
      this.prisma.order.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
      // Previous period order count
      this.prisma.order.count({
        where: { createdAt: { gte: prevFrom, lte: prevTo } },
      }),
      // New customers in period
      this.prisma.user.count({
        where: { role: Role.CUSTOMER, createdAt: { gte: from, lte: to } },
      }),
      // Previous period new customers
      this.prisma.user.count({
        where: { role: Role.CUSTOMER, createdAt: { gte: prevFrom, lte: prevTo } },
      }),
      // Active products
      this.prisma.product.count({ where: { isActive: true } }),
      // Average order value (current period, revenue statuses)
      this.prisma.order.aggregate({
        where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: from, lte: to } },
        _avg: { total: true },
      }),
    ]);

    const revenue     = revenueAgg._sum.total     ?? 0;
    const prevRevenue = prevRevenueAgg._sum.total  ?? 0;

    return {
      period: { from, to },
      revenue: {
        total:      Number(revenue),
        growth:     this.growthRate(Number(revenue), Number(prevRevenue)),
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

  async getSalesTrend(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const granularity  = dto.granularity ?? 'day';

    // DATE_TRUNC requires raw SQL — Prisma doesn't support it natively
    const rows = await this.prisma.$queryRaw<
      Array<{ bucket: Date; revenue: number; orders: bigint }>
    >(
      Prisma.sql`
        SELECT
          DATE_TRUNC(${granularity}, "createdAt" AT TIME ZONE 'UTC') AS bucket,
          COALESCE(SUM(total), 0)::float                             AS revenue,
          COUNT(*)::bigint                                           AS orders
        FROM "Order"
        WHERE "createdAt" >= ${from}
          AND "createdAt" <= ${to}
          AND status = ANY(${REVENUE_STATUSES}::text[])
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

  async getTopProducts(dto: AnalyticsQueryDto) {
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
        WHERE o."createdAt" >= ${from}
          AND o."createdAt" <= ${to}
          AND o.status = ANY(${REVENUE_STATUSES}::text[])
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

  async getOrderStatusDistribution(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);

    const groups = await this.prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: from, lte: to } },
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

  async getPaymentAnalytics(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);

    const [statusGroups, methodGroups, refundAgg] = await this.prisma.$transaction([
      // Payment status distribution
      this.prisma.payment.groupBy({
        by: ['status'],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
        _sum:   { amount: true },
      }),
      // Payment method distribution
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
        _sum:   { amount: true },
      }),
      // Refund totals
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.REFUNDED,
          createdAt: { gte: from, lte: to },
        },
        _sum:   { refundAmount: true },
        _count: { _all: true },
      }),
    ]);

    const totalPayments = statusGroups.reduce((acc, g) => acc + g._count._all, 0);
    const successCount  = statusGroups.find((g) => g.status === PaymentStatus.PAID)?._count._all ?? 0;
    const successRate   = totalPayments > 0
      ? parseFloat(((successCount / totalPayments) * 100).toFixed(2))
      : 0;

    return {
      period: { from, to },
      successRate,
      statusDistribution: statusGroups.map((g) => ({
        status:  g.status,
        count:   g._count._all,
        amount:  Number(g._sum.amount ?? 0),
      })),
      methodDistribution: methodGroups.map((g) => ({
        method: g.method,
        count:  g._count._all,
        amount: Number(g._sum.amount ?? 0),
      })),
      refunds: {
        count:  refundAgg._count._all,
        amount: Number(refundAgg._sum.refundAmount ?? 0),
      },
    };
  }

  // ─── 6. Delivery Analytics ────────────────────────────────────────────────

  async getDeliveryAnalytics(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);

    const [deliveryGroups, avgDeliveryRow] = await Promise.all([
      // Delivery type + status distribution (SELF vs THIRD_PARTY)
      this.prisma.delivery.groupBy({
        by: ['type', 'status'],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      // Avg delivery time from assignment to delivery (hours)
      this.prisma.$queryRaw<Array<{ avgHours: number }>>(
        Prisma.sql`
          SELECT
            AVG(
              EXTRACT(EPOCH FROM ("deliveredAt" - "assignedAt")) / 3600
            )::float AS "avgHours"
          FROM "Delivery"
          WHERE "deliveredAt" IS NOT NULL
            AND "assignedAt"  IS NOT NULL
            AND "createdAt" >= ${from}
            AND "createdAt" <= ${to}
        `,
      ),
    ]);

    const total   = deliveryGroups.reduce((acc, g) => acc + g._count._all, 0);
    const delivered = deliveryGroups
      .filter((g) => g.status === 'DELIVERED')
      .reduce((acc, g) => acc + g._count._all, 0);
    const successRate = total > 0
      ? parseFloat(((delivered / total) * 100).toFixed(2))
      : 0;

    return {
      period: { from, to },
      total,
      successRate,
      avgDeliveryHours: avgDeliveryRow[0]?.avgHours
        ? parseFloat(avgDeliveryRow[0].avgHours.toFixed(2))
        : null,
      distribution: deliveryGroups.map((g) => ({
        type:   g.type,
        status: g.status,
        count:  g._count._all,
      })),
    };
  }

  // ─── 7. Customer Growth ───────────────────────────────────────────────────

  async getCustomerGrowth(dto: AnalyticsQueryDto) {
    const { from, to } = this.resolveDateRange(dto);
    const granularity  = dto.granularity ?? 'day';

    const [growthRows, totalCustomers, verifiedCount] = await Promise.all([
      // New customers per time bucket
      this.prisma.$queryRaw<Array<{ bucket: Date; newCustomers: bigint }>>(
        Prisma.sql`
          SELECT
            DATE_TRUNC(${granularity}, "createdAt" AT TIME ZONE 'UTC') AS bucket,
            COUNT(*)::bigint AS "newCustomers"
          FROM "User"
          WHERE role = 'CUSTOMER'
            AND "createdAt" >= ${from}
            AND "createdAt" <= ${to}
          GROUP BY bucket
          ORDER BY bucket ASC
        `,
      ),
      // Total customers ever
      this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
      // Verified customers (isVerified flag)
      this.prisma.user.count({
        where: { role: Role.CUSTOMER, isVerified: true },
      }),
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

  async getLowStockSummary() {
    const LOW_STOCK_THRESHOLD = 5;

    const [outOfStock, lowStock] = await this.prisma.$transaction([
      // Completely out of stock
      this.prisma.productVariant.findMany({
        where: { stock: 0, product: { isActive: true } },
        select: {
          id:    true,
          sku:   true,
          stock: true,
          product: {
            select: {
              id:   true,
              name: true,
              slug: true,
              category: { select: { name: true } },
            },
          },
          attributes: true,
        },
        orderBy: { product: { name: 'asc' } },
      }),
      // Low stock (1–5)
      this.prisma.productVariant.findMany({
        where: {
          stock:   { gt: 0, lte: LOW_STOCK_THRESHOLD },
          product: { isActive: true },
        },
        select: {
          id:    true,
          sku:   true,
          stock: true,
          product: {
            select: {
              id:   true,
              name: true,
              slug: true,
              category: { select: { name: true } },
            },
          },
          attributes: true,
        },
        orderBy: { stock: 'asc' },
      }),
    ]);

    return {
      threshold: LOW_STOCK_THRESHOLD,
      outOfStock: {
        count: outOfStock.length,
        items: outOfStock,
      },
      lowStock: {
        count: lowStock.length,
        items: lowStock,
      },
    };
  }

  // ─── Phase 2: BullMQ Nightly Report Placeholder ───────────────────────────

  /**
   * Phase 2: Wire up as a BullMQ scheduled job.
   * Job name: 'analytics:nightly-report'
   * Schedule: '0 2 * * *' (02:00 UTC daily)
   * Processor: fetch 24h overview + top 10 products → email to all ADMINs via NotificationsService.sendEmail()
   */
  async generateNightlyReport(): Promise<void> {
    this.logger.log('[PLACEHOLDER] generateNightlyReport() — implement in Phase 2 with BullMQ');
  }
}
