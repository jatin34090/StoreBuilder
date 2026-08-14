import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../modules/notifications/redis.service';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';
import type { PlanFeature } from '../constants/plan-config';

const PLAN_FEATURE_CACHE_TTL = 120; // 2 min — short enough to react to plan changes

@Injectable()
export class FeatureGuard implements CanActivate {
  private readonly logger = new Logger(FeatureGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PlanFeature>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const user = req.user;
    if (!user) return false;

    // SUPER_ADMIN bypasses feature gates
    if (user.role === 'SUPER_ADMIN') return true;

    const storeId = user.storeId as string | undefined;
    if (!storeId) {
      throw new ForbiddenException('No store context found');
    }

    const features = await this.getPlanFeatures(storeId);

    if (!features.includes(required)) {
      throw new ForbiddenException(
        `Feature "${required}" is not available on your current plan. Please upgrade.`,
      );
    }
    return true;
  }

  private async getPlanFeatures(storeId: string): Promise<string[]> {
    const cacheKey = `store:${storeId}:plan:features`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached) as string[]; } catch { /* fall through */ }
    }

    // Read store → plan → features from DB
    const store = await this.prisma.store.findUnique({
      where:  { id: storeId },
      select: { plan: true },
    });
    if (!store) return [];

    const planLimit = await this.prisma.planLimit.findUnique({
      where:  { plan: store.plan },
      select: { features: true },
    });

    const features: string[] = Array.isArray(planLimit?.features)
      ? (planLimit!.features as string[])
      : [];

    await this.redis.setEx(cacheKey, PLAN_FEATURE_CACHE_TTL, JSON.stringify(features));
    return features;
  }
}
