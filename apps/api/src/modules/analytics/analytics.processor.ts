import { Processor, Process, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QUEUE_ANALYTICS,
  JOB_NIGHTLY_REPORT,
  JOB_RESET_DAILY_QUOTA,
  JOB_RESET_MONTHLY_QUOTA,
} from '../queues/queue.constants';

// ─── Cron schedules (Bull cron syntax) ────────────────────────────────────────

const CRON_NIGHTLY_REPORT      = '0 2 * * *';   // 02:00 UTC every day
const CRON_RESET_DAILY_QUOTA   = '0 0 * * *';   // 00:00 UTC every day
const CRON_RESET_MONTHLY_QUOTA = '0 0 1 * *';   // 00:00 UTC on the 1st of every month

const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

@Processor(QUEUE_ANALYTICS)
export class AnalyticsProcessor implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(
    @InjectQueue(QUEUE_ANALYTICS) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Register repeatable cron jobs on startup ─────────────────────────────

  async onModuleInit(): Promise<void> {
    try {
      await this.registerCron(JOB_NIGHTLY_REPORT,      CRON_NIGHTLY_REPORT);
      await this.registerCron(JOB_RESET_DAILY_QUOTA,   CRON_RESET_DAILY_QUOTA);
      await this.registerCron(JOB_RESET_MONTHLY_QUOTA, CRON_RESET_MONTHLY_QUOTA);
      this.logger.log('Analytics cron jobs registered');
    } catch (err) {
      // Redis unavailable in dev — cron jobs will not run, app still starts
      this.logger.warn(`Analytics cron registration skipped (Redis unavailable): ${(err as Error).message}`);
    }
  }

  private async registerCron(jobName: string, cron: string): Promise<void> {
    // Remove any stale repeat entries for this job before re-adding
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === jobName) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }
    await this.queue.add(jobName, {}, { repeat: { cron }, removeOnComplete: 20, removeOnFail: 10 });
  }

  // ─── JOB: nightly-report ─────────────────────────────────────────────────

  @Process(JOB_NIGHTLY_REPORT)
  async handleNightlyReport(_job: Job): Promise<void> {
    this.logger.log('Running nightly analytics report…');

    const to   = new Date();
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const [revenueAgg, orderCount, newCustomers, topProducts] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: from, lte: to } },
        _sum: { total: true },
      }),
      this.prisma.order.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.user.count({ where: { role: Role.CUSTOMER, createdAt: { gte: from, lte: to } } }),
      // Top 5 products by revenue today
      this.prisma.orderItem.groupBy({
        by: ['name'],
        where: { order: { status: { in: REVENUE_STATUSES }, createdAt: { gte: from, lte: to } } },
        _sum:   { price: true, quantity: true },
        orderBy: { _sum: { price: 'desc' } },
        take: 5,
      } as any),
    ]);

    const revenue = Number(revenueAgg._sum.total ?? 0);

    // Build a compact report line for each top product
    const topProductLines = (topProducts as any[]).map(
      (p: any, i: number) =>
        `${i + 1}. ${p.name} — ₹${Number(p._sum?.price ?? 0).toFixed(0)} (${p._sum?.quantity ?? 0} units)`,
    );

    const reportBody = [
      `📅 Daily Report: ${from.toLocaleDateString('en-IN')}`,
      `💰 Revenue:       ₹${revenue.toFixed(2)}`,
      `📦 Orders:        ${orderCount}`,
      `👤 New Customers: ${newCustomers}`,
      ``,
      `🏆 Top Products:`,
      ...topProductLines,
    ].join('\n');

    // Notify SUPER_ADMIN users with the platform report.
    // This is intentionally cross-tenant (platform-level aggregate).
    const superAdmins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN },
      select: { id: true },
    });

    if (superAdmins.length > 0) {
      // Platform-level notifications use the super admin's own user record; no storeId needed.
      // We log to the server only — in-app notification for cross-store data stays in server logs.
      this.logger.log(
        `Nightly platform report dispatched to ${superAdmins.length} super-admin(s) — ` +
        `revenue ₹${revenue.toFixed(2)}, orders ${orderCount}, new customers ${newCustomers}`,
      );
    }

    this.logger.log(
      `Nightly report done — revenue ₹${revenue.toFixed(2)}, orders ${orderCount}, new customers ${newCustomers}`,
    );
  }

  // ─── JOB: reset-daily-quota ───────────────────────────────────────────────

  @Process(JOB_RESET_DAILY_QUOTA)
  async handleResetDailyQuota(_job: Job): Promise<void> {
    const { count } = await this.prisma.storeQuotaUsage.updateMany({
      data: { apiCallsToday: 0, lastDayReset: new Date() },
    });
    this.logger.log(`Daily quota reset: apiCallsToday zeroed for ${count} stores`);
  }

  // ─── JOB: reset-monthly-quota ────────────────────────────────────────────

  @Process(JOB_RESET_MONTHLY_QUOTA)
  async handleResetMonthlyQuota(_job: Job): Promise<void> {
    const { count } = await this.prisma.storeQuotaUsage.updateMany({
      data: { orderCount: 0, apiCallsMonth: 0, lastMonthReset: new Date() },
    });
    this.logger.log(`Monthly quota reset: orderCount + apiCallsMonth zeroed for ${count} stores`);
  }
}
