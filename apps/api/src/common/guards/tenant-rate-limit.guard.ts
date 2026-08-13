import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Plan } from '@prisma/client';
import { TenantService } from '../../modules/tenant/tenant.service';

export const SKIP_TENANT_RATE_LIMIT = 'skipTenantRateLimit';

/**
 * Rate limits per plan (requests per 60 s window per store).
 * Override per-route with @SetMetadata('tenantRateLimit', { limit, windowSec })
 */
export const PLAN_API_LIMITS: Record<Plan, number> = {
  [Plan.FREE]:         100,
  [Plan.STARTER]:      500,
  [Plan.PROFESSIONAL]: 2000,
  [Plan.ENTERPRISE]:   10000,
};

/**
 * Endpoint category multipliers applied on top of the plan base limit.
 * Categories for expensive operations get tighter per-60s sub-budgets.
 *
 * Apply with @SetMetadata('rateCategory', 'file_upload') (or any key below).
 */
export type RateCategoryKey =
  | 'public_storefront'
  | 'auth'
  | 'admin_api'
  | 'order_api'
  | 'checkout'
  | 'file_upload'
  | 'analytics'
  | 'search';

const CATEGORY_MULTIPLIERS: Record<RateCategoryKey, number> = {
  public_storefront: 1.0,
  search:            0.5,
  admin_api:         0.5,
  order_api:         0.3,
  analytics:         0.2,
  auth:              0.1,
  checkout:          0.2,
  file_upload:       0.05,
};

@Injectable()
export class TenantRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(TenantRateLimitGuard.name);

  constructor(
    private tenantService: TenantService,
    private reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.get<boolean>(SKIP_TENANT_RATE_LIMIT, ctx.getHandler())) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: { role?: string; storeId?: string } }>();
    const storeId = req.storeId;
    if (!storeId) return true; // no tenant context — skip

    // Store ownership check: ADMIN users may only access their own store context.
    // SUPER_ADMIN is exempt. Unauthenticated requests fall through to JWT guard.
    const user = req.user;
    if (user && user.role === 'ADMIN' && user.storeId && user.storeId !== storeId) {
      throw new HttpException(
        { message: 'You are not authorized to access this store.', storeId },
        HttpStatus.FORBIDDEN,
      );
    }

    // Allow explicit per-route override (legacy / special cases)
    const explicit = this.reflector.get<{ limit: number; windowSec: number } | undefined>(
      'tenantRateLimit',
      ctx.getHandler(),
    );

    let limit: number;
    let windowSec = 60;

    if (explicit) {
      limit     = explicit.limit;
      windowSec = explicit.windowSec;
    } else {
      // Derive plan-based limit
      const store = req.store as { plan?: Plan } | undefined;
      const plan  = store?.plan ?? Plan.FREE;
      const base  = PLAN_API_LIMITS[plan];

      // Apply category multiplier if decorator is present
      const category = this.reflector.get<RateCategoryKey>('rateCategory', ctx.getHandler());
      const mult      = category ? (CATEGORY_MULTIPLIERS[category] ?? 1.0) : 1.0;

      limit = Math.max(1, Math.floor(base * mult));
    }

    const allowed = await this.tenantService.checkAndIncrementApiRate(storeId, limit, windowSec);

    if (!allowed) {
      this.logger.warn(
        `Rate limit exceeded — store=${storeId} limit=${limit}/${windowSec}s path=${req.method} ${req.path}`,
      );
      throw new HttpException(
        { message: 'Too many requests. Please slow down or upgrade your plan.', storeId },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
