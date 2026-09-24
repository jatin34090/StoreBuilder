import { Injectable, NotFoundException, ForbiddenException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../notifications/redis.service';
import type { Store, StoreRole } from '@prisma/client';

const STORE_CACHE_TTL = 300; // 5 min

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ─── Store resolution ─────────────────────────────────────────────────────

  private async redisSafeGet(key: string): Promise<string | null> {
    try { return await this.redis.get(key); } catch { return null; }
  }

  private async redisSafeSet(key: string, ttl: number, value: string): Promise<void> {
    try { await this.redis.setEx(key, ttl, value); } catch { /* non-fatal */ }
  }

  async resolveBySlug(slug: string): Promise<Store | null> {
    const cacheKey = `store:slug:${slug}`;
    const cached = await this.redisSafeGet(cacheKey);
    if (cached) return JSON.parse(cached) as Store;

    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (store) await this.redisSafeSet(cacheKey, STORE_CACHE_TTL, JSON.stringify(store));
    return store;
  }

  async resolveByDomain(domain: string): Promise<Store | null> {
    const normalized = domain.toLowerCase().replace(/\.$/, '');
    const cacheKey = `store:domain:${normalized}`;
    const cached = await this.redisSafeGet(cacheKey);
    if (cached) return JSON.parse(cached) as Store;

    // Look up via StoreDomain table (ACTIVE records only) — Phase 12 path
    const storeDomain = await this.prisma.storeDomain.findFirst({
      where: { normalizedDomain: normalized, status: 'ACTIVE' },
      select: { storeId: true },
    });
    if (storeDomain) {
      const store = await this.resolveById(storeDomain.storeId);
      if (store) await this.redisSafeSet(cacheKey, STORE_CACHE_TTL, JSON.stringify(store));
      return store;
    }

    // Fallback: legacy Store.customDomain field (backward compat for existing records)
    const store = await this.prisma.store.findFirst({
      where: { customDomain: normalized },
    });
    if (store) await this.redisSafeSet(cacheKey, STORE_CACHE_TTL, JSON.stringify(store));
    return store;
  }

  async resolveById(id: string): Promise<Store | null> {
    const cacheKey = `store:id:${id}`;
    const cached = await this.redisSafeGet(cacheKey);
    if (cached) return JSON.parse(cached) as Store;

    const store = await this.prisma.store.findUnique({ where: { id } });
    if (store) await this.redisSafeSet(cacheKey, STORE_CACHE_TTL, JSON.stringify(store));
    return store;
  }

  async getOrThrow(storeId: string): Promise<Store> {
    const store = await this.resolveById(storeId);
    if (!store) throw new NotFoundException('Store not found');
    if (!store.isActive) throw new ForbiddenException('Store is inactive');
    return store;
  }

  // ─── User → Store membership ──────────────────────────────────────────────

  async getUserStoreRole(userId: string, storeId: string): Promise<StoreRole | null> {
    const cacheKey = `store:${storeId}:user:${userId}:role`;
    const cached = await this.redisSafeGet(cacheKey);
    if (cached) return cached as StoreRole;

    const membership = await this.prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
      select: { role: true },
    });

    if (membership) await this.redisSafeSet(cacheKey, STORE_CACHE_TTL, membership.role);
    return membership?.role ?? null;
  }

  async assertUserBelongsToStore(userId: string, storeId: string): Promise<StoreRole> {
    const role = await this.getUserStoreRole(userId, storeId);
    if (!role) throw new ForbiddenException('You do not have access to this store');
    return role;
  }

  // ─── Quota enforcement ───────────────────────────────────────────────────

  private quotaExceeded(resource: string, current: number | string, max: number | string): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'QuotaExceeded',
        message: `Your plan limit for ${resource} has been reached (${current}/${max}). Please upgrade your plan.`,
        resource,
        current,
        max,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  async checkProductQuota(storeId: string): Promise<void> {
    const [quota, limit] = await Promise.all([
      this.prisma.storeQuotaUsage.findUnique({ where: { storeId } }),
      this.getStorePlanLimit(storeId),
    ]);
    // null = unlimited; skip check only when limit is null
    if (quota && limit && limit.maxProducts !== null && quota.productCount >= limit.maxProducts) {
      this.quotaExceeded('products', quota.productCount, limit.maxProducts);
    }
  }

  // Orders are tracked with a monthly counter (orderCountThisMonth).
  // The lifetime total (orderCount) accumulates indefinitely and is only for analytics.
  // Soft limit policy: existing orders are never cancelled; only new order creation is blocked.
  async checkOrderQuota(storeId: string): Promise<void> {
    const limit = await this.getStorePlanLimit(storeId);
    if (!limit || limit.maxOrders === null) return; // null = unlimited

    const quota = await this.prisma.storeQuotaUsage.findUnique({ where: { storeId } });
    if (quota && quota.orderCountThisMonth >= limit.maxOrders) {
      this.quotaExceeded('orders (this month)', quota.orderCountThisMonth, limit.maxOrders);
    }
  }

  async checkStorageQuota(storeId: string, incomingBytes: number): Promise<void> {
    const limit = await this.getStorePlanLimit(storeId);
    if (!limit) return;

    const maxBytes = BigInt(limit.maxStorageGB) * BigInt(1024 ** 3);
    const quota = await this.prisma.storeQuotaUsage.findUnique({ where: { storeId } });
    if (quota && quota.storageBytes + BigInt(incomingBytes) > maxBytes) {
      this.quotaExceeded('storage', `${quota.storageBytes}B`, `${limit.maxStorageGB}GB`);
    }
  }

  // Staff quota counts only ACTIVE members — PENDING invitations and INACTIVE
  // accounts do not consume a staff slot.
  async checkStaffQuota(storeId: string): Promise<void> {
    const limit = await this.getStorePlanLimit(storeId);
    if (!limit || limit.maxStaff === null) return; // null = unlimited

    const current = await this.prisma.storeUser.count({
      where: { storeId, status: 'ACTIVE' },
    });
    if (current >= limit.maxStaff) {
      this.quotaExceeded('staff', current, limit.maxStaff);
    }
  }

  async checkDomainQuota(storeId: string): Promise<void> {
    const limit = await this.getStorePlanLimit(storeId);
    if (!limit || limit.maxDomains === null) return; // null = unlimited

    const current = await this.prisma.storeDomain.count({
      where: { storeId, status: { not: 'DISABLED' } },
    });
    if (current >= limit.maxDomains) {
      this.quotaExceeded('custom domains', current, limit.maxDomains);
    }
  }

  async incrementProductCount(storeId: string, delta = 1): Promise<void> {
    await this.prisma.storeQuotaUsage.upsert({
      where: { storeId },
      create: { storeId, productCount: delta, updatedAt: new Date() },
      update: { productCount: { increment: delta }, updatedAt: new Date() },
    });
  }

  async incrementOrderCount(storeId: string): Promise<void> {
    await this.prisma.storeQuotaUsage.upsert({
      where: { storeId },
      create: { storeId, orderCount: 1, orderCountThisMonth: 1, updatedAt: new Date() },
      update: {
        orderCount:          { increment: 1 },
        orderCountThisMonth: { increment: 1 },
        updatedAt:           new Date(),
      },
    });
  }

  async incrementStorageBytes(storeId: string, bytes: number): Promise<void> {
    await this.prisma.storeQuotaUsage.upsert({
      where: { storeId },
      create: { storeId, storageBytes: bytes, updatedAt: new Date() },
      update: { storageBytes: { increment: bytes }, updatedAt: new Date() },
    });
  }

  // Resets the monthly order counter for all stores at the start of a new calendar month.
  // Called by BillingCronService on the 1st of each month.
  async resetMonthlyOrderCounts(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.storeQuotaUsage.updateMany({
      data: {
        orderCountThisMonth: 0,
        lastMonthReset: now,
        updatedAt: now,
      },
    });
    this.logger.log(`Monthly order counters reset for ${result.count} stores`);
    return result.count;
  }

  // ─── Per-tenant rate limiting ─────────────────────────────────────────────

  async checkAndIncrementApiRate(
    storeId: string,
    limit: number,
    windowSec = 60,
    category = 'default',
  ): Promise<boolean> {
    // Per-category key: exhausting one category doesn't block another
    const bucket = Math.floor(Date.now() / (windowSec * 1000));
    const key = `ratelimit:store:${storeId}:${category}:${bucket}`;
    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, windowSec);
      return count <= limit;
    } catch {
      // Redis unavailable — fail open so API stays functional
      this.logger.warn(`Redis unavailable for rate-limit check (store=${storeId}), failing open`);
      return true;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getStorePlanLimit(storeId: string) {
    const store = await this.resolveById(storeId);
    if (!store) return null;
    return this.prisma.planLimit.findUnique({ where: { plan: store.plan } });
  }

  invalidateStoreCache(storeId: string, slug?: string, customDomain?: string): void {
    void this.redis.del(`store:id:${storeId}`);
    if (slug) void this.redis.del(`store:slug:${slug}`);
    if (customDomain) void this.redis.del(`store:domain:${customDomain}`);
  }
}
