import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, JobOptions } from 'bull';
import { Plan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../notifications/redis.service';
import {
  QUEUE_NOTIFICATIONS,
  QUEUE_ANALYTICS,
} from './queue.constants';

// ─── Plan-based priority (lower = processed first in Bull) ────────────────────

const PLAN_PRIORITY: Record<Plan, number> = {
  [Plan.ENTERPRISE]:   1,
  [Plan.PROFESSIONAL]: 2,
  [Plan.STARTER]:      3,
  [Plan.FREE]:         4,
};

// Max jobs a store can enqueue per 60 s window. -1 = unlimited.
const PLAN_RATE_LIMIT: Record<Plan, number> = {
  [Plan.ENTERPRISE]:   -1,
  [Plan.PROFESSIONAL]: 500,
  [Plan.STARTER]:      100,
  [Plan.FREE]:         20,
};

// Max waiting jobs per store before we apply backpressure.
const MAX_WAITING_PER_STORE = 50;

export type IsolatedQueueName = 'notifications' | 'analytics';

/**
 * CRITICAL  — must never be dropped: payments, orders, inventory sync
 * NORMAL     — customer-facing notifications; throttled but retried
 * LOW        — analytics jobs, broadcast pushes; can be dropped when overloaded
 */
export type JobCriticality = 'CRITICAL' | 'NORMAL' | 'LOW';

export interface EnqueueResult {
  jobId: string | number | undefined;
  dropped: false;
}
export interface DropResult {
  dropped: true;
  reason: 'rate_limit' | 'backpressure';
  storeId: string;
  jobName: string;
  criticality: JobCriticality;
}
export type AddResult = EnqueueResult | DropResult;

@Injectable()
export class IsolatedQueueService {
  private readonly logger = new Logger(IsolatedQueueService.name);

  // Simple in-process plan cache — TTL 5 min per store
  private readonly planCache = new Map<string, { plan: Plan; expiresAt: number }>();

  constructor(
    @InjectQueue(QUEUE_NOTIFICATIONS) private readonly notifQueue: Queue,
    @InjectQueue(QUEUE_ANALYTICS)     private readonly analyticsQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Add a job with plan-aware priority, per-store rate limiting, and
   * backpressure checks.
   *
   * CRITICAL jobs bypass rate limiting and backpressure entirely.
   * NORMAL jobs are rate-limited but never silently dropped — callers receive
   *   a DropResult and can choose to retry later.
   * LOW jobs are dropped when rate-limited or queue is deep.
   */
  async add<T = unknown>(
    storeId: string,
    queue: IsolatedQueueName,
    jobName: string,
    data: T,
    opts: Omit<JobOptions, 'priority'> = {},
    criticality: JobCriticality = 'NORMAL',
  ): Promise<AddResult> {
    const plan = await this.getStorePlan(storeId);

    // CRITICAL jobs skip all throttling
    if (criticality !== 'CRITICAL') {
      const rateLimitExceeded = !(await this.checkRateLimit(storeId, plan));
      if (rateLimitExceeded) {
        this.logger.warn(
          `Queue rate limit — store=${storeId} plan=${plan} job=${jobName} criticality=${criticality}`,
        );
        return { dropped: true, reason: 'rate_limit', storeId, jobName, criticality };
      }

      // Backpressure: avoid unbounded queue growth per store
      const waiting = await this.countWaiting(storeId, queue);
      if (waiting >= MAX_WAITING_PER_STORE) {
        this.logger.warn(
          `Queue backpressure — store=${storeId} waiting=${waiting} job=${jobName} criticality=${criticality}`,
        );
        return { dropped: true, reason: 'backpressure', storeId, jobName, criticality };
      }
    }

    const priority = criticality === 'CRITICAL' ? 1 : PLAN_PRIORITY[plan];
    const targetQueue = this.resolveQueue(queue);
    const job = await targetQueue.add(jobName, data, { ...opts, priority });
    return { jobId: job.id, dropped: false };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private resolveQueue(queue: IsolatedQueueName): Queue {
    return queue === 'notifications' ? this.notifQueue : this.analyticsQueue;
  }

  private async getStorePlan(storeId: string): Promise<Plan> {
    const cached = this.planCache.get(storeId);
    if (cached && cached.expiresAt > Date.now()) return cached.plan;

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { plan: true },
    });

    const plan = store?.plan ?? Plan.FREE;
    this.planCache.set(storeId, { plan, expiresAt: Date.now() + 5 * 60 * 1000 });
    return plan;
  }

  private async checkRateLimit(storeId: string, plan: Plan): Promise<boolean> {
    const max = PLAN_RATE_LIMIT[plan];
    if (max === -1) return true; // unlimited

    const windowSec = 60;
    const key = `queue:ratelimit:${storeId}:${Math.floor(Date.now() / (windowSec * 1000))}`;

    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.setEx(key, windowSec, String(count));
      return count <= max;
    } catch {
      // Redis down — fail open
      return true;
    }
  }

  /**
   * Approximate count of waiting jobs for this store by scanning job data.
   * Uses Bull's getJobCounts for efficiency; per-store count via Redis key.
   */
  private async countWaiting(storeId: string, queue: IsolatedQueueName): Promise<number> {
    const key = `queue:waiting:${storeId}:${queue}`;
    try {
      const val = await this.redis.get(key);
      return val ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  }

  /** Invalidate cached plan for a store (call after plan upgrade/downgrade) */
  invalidatePlanCache(storeId: string): void {
    this.planCache.delete(storeId);
  }
}
