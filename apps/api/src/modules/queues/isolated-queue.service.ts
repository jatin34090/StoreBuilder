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

export type IsolatedQueueName = 'notifications' | 'analytics';

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
   * Add a job to the appropriate shared queue with plan-aware priority and
   * per-store rate limiting so FREE-plan stores cannot starve paid stores.
   *
   * Returns the created job, or null if the store's rate limit is exceeded.
   */
  async add<T = unknown>(
    storeId: string,
    queue: IsolatedQueueName,
    jobName: string,
    data: T,
    opts: Omit<JobOptions, 'priority'> = {},
  ) {
    const plan = await this.getStorePlan(storeId);
    const allowed = await this.checkRateLimit(storeId, plan);

    if (!allowed) {
      this.logger.warn(
        `Queue rate limit exceeded — store=${storeId} plan=${plan} queue=${queue} job=${jobName}`,
      );
      return null;
    }

    const priority = PLAN_PRIORITY[plan];
    const targetQueue = this.resolveQueue(queue);

    return targetQueue.add(jobName, data, { ...opts, priority });
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
      // Redis down — allow the job (fail open)
      return true;
    }
  }

  /** Invalidate cached plan for a store (call after plan upgrade/downgrade) */
  invalidatePlanCache(storeId: string): void {
    this.planCache.delete(storeId);
  }
}
