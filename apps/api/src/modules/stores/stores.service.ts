import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, Plan, StoreRole, StoreStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { EventsGateway, WsEvents } from '../events/events.gateway';
import type { CreateStoreDto } from './dto/create-store.dto';
import type { UpdateStoreDto } from './dto/update-store.dto';
import type { QueryStoresDto } from './dto/query-stores.dto';
import type { UpsertSettingDto } from './dto/upsert-setting.dto';

// ─── Default plan limits (mirrors PlanLimit seed in migration) ────────────────

const PLAN_DEFAULTS: Record<Plan, { plan: Plan; maxProducts: number; maxOrders: number | null; maxStorageGB: number; maxStaff: number; maxApiPerDay: number; maxApiPerMonth: number }> = {
  [Plan.FREE]:         { plan: Plan.FREE,         maxProducts: 50,    maxOrders: 100,    maxStorageGB: 1,   maxStaff: 2,  maxApiPerDay: 1000,  maxApiPerMonth: 20000 },
  [Plan.STARTER]:      { plan: Plan.STARTER,      maxProducts: 500,   maxOrders: 1000,   maxStorageGB: 10,  maxStaff: 5,  maxApiPerDay: 5000,  maxApiPerMonth: 100000 },
  [Plan.PROFESSIONAL]: { plan: Plan.PROFESSIONAL, maxProducts: 5000,  maxOrders: 10000,  maxStorageGB: 100, maxStaff: 20, maxApiPerDay: 20000, maxApiPerMonth: 500000 },
  [Plan.ENTERPRISE]:   { plan: Plan.ENTERPRISE,   maxProducts: -1,    maxOrders: null,   maxStorageGB: 500, maxStaff: -1, maxApiPerDay: 100000, maxApiPerMonth: 2000000 },
};

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly gateway: EventsGateway,
  ) {}

  // ─── Super Admin: CRUD ────────────────────────────────────────────────────

  async create(dto: CreateStoreDto) {
    const slugExists = await this.prisma.store.findUnique({ where: { slug: dto.slug } });
    if (slugExists) throw new ConflictException(`Slug '${dto.slug}' is already taken`);

    if (dto.customDomain) {
      const domainExists = await this.prisma.store.findUnique({ where: { customDomain: dto.customDomain } });
      if (domainExists) throw new ConflictException(`Domain '${dto.customDomain}' is already registered`);
    }

    const plan = dto.plan ?? Plan.FREE;

    const store = await this.prisma.store.create({
      data: {
        name:         dto.name.trim(),
        slug:         dto.slug.toLowerCase().trim(),
        plan,
        customDomain: dto.customDomain ?? null,
        logoUrl:      dto.logoUrl ?? null,
        isActive:     true,
        quota: {
          create: {
            productCount:   0,
            orderCount:     0,
            storageBytes:   BigInt(0),
            apiCallsToday:  0,
          },
        },
      },
      include: { quota: true },
    });

    // If an ownerUserId is provided, create the StoreUser membership
    if (dto.ownerUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.ownerUserId } });
      if (!user) throw new NotFoundException('Owner user not found');

      await this.prisma.storeUser.create({
        data: { storeId: store.id, userId: dto.ownerUserId, role: StoreRole.OWNER },
      });
    }

    // Seed default plan limits row if not already present
    await this.prisma.planLimit.upsert({
      where:  { plan },
      update: {},
      create: PLAN_DEFAULTS[plan],
    });

    this.logger.log(`Store created: ${store.slug} (${store.id}) — plan: ${plan}`);
    this.tenant.invalidateStoreCache(store.id, store.slug);
    this.gateway.emitPlatformEvent(WsEvents.STORE_CREATED, { storeId: store.id, slug: store.slug, plan });
    return store;
  }

  async findAll(dto: QueryStoresDto) {
    const page  = dto.page  ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);
    const skip  = (page - 1) * limit;

    const where: Prisma.StoreWhereInput = {};
    if (dto.plan     !== undefined) where.plan     = dto.plan;
    if (dto.isActive !== undefined) where.isActive = dto.isActive;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { slug: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [stores, total] = await this.prisma.$transaction([
      this.prisma.store.findMany({
        where,
        select: {
          id:           true,
          name:         true,
          slug:         true,
          plan:         true,
          status:       true,
          isActive:     true,
          customDomain: true,
          logoUrl:      true,
          businessName: true,
          industry:     true,
          currency:     true,
          country:      true,
          createdAt:    true,
          quota:        { select: { productCount: true, orderCount: true, storageBytes: true, apiCallsToday: true } },
          _count:       { select: { users: true, products: true, orders: true } },
        },
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.store.count({ where }),
    ]);

    return { stores, pagination: { page, limit, total } };
  }

  async findOne(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        quota:    true,
        settings: true,
        users: {
          include: { user: { select: { id: true, name: true, email: true, phone: true, role: true } } },
        },
        _count: { select: { products: true, orders: true, coupons: true } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async update(id: string, dto: UpdateStoreDto) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');

    if (dto.customDomain && dto.customDomain !== store.customDomain) {
      const exists = await this.prisma.store.findUnique({ where: { customDomain: dto.customDomain } });
      if (exists) throw new ConflictException(`Domain '${dto.customDomain}' is already registered`);
    }

    const updated = await this.prisma.store.update({
      where: { id },
      data: {
        ...(dto.name         !== undefined && { name:         dto.name.trim() }),
        ...(dto.plan         !== undefined && { plan:         dto.plan }),
        ...(dto.customDomain !== undefined && { customDomain: dto.customDomain }),
        ...(dto.logoUrl      !== undefined && { logoUrl:      dto.logoUrl }),
        ...(dto.faviconUrl   !== undefined && { faviconUrl:   dto.faviconUrl }),
        ...(dto.isActive     !== undefined && { isActive:     dto.isActive }),
      },
    });

    this.tenant.invalidateStoreCache(id, store.slug);
    this.logger.log(`Store updated: ${store.slug}`);
    return updated;
  }

  async suspend(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');
    if (!store.isActive) throw new BadRequestException('Store is already suspended');

    await this.prisma.store.update({ where: { id }, data: { isActive: false, status: StoreStatus.SUSPENDED } });
    this.tenant.invalidateStoreCache(id, store.slug);
    this.logger.log(`Store suspended: ${store.slug}`);
    this.gateway.emitPlatformEvent(WsEvents.STORE_SUSPENDED, { storeId: id, slug: store.slug });
    return { message: 'Store suspended' };
  }

  async reinstate(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');
    if (store.isActive) throw new BadRequestException('Store is already active');

    await this.prisma.store.update({ where: { id }, data: { isActive: true, status: StoreStatus.ACTIVE } });
    this.tenant.invalidateStoreCache(id, store.slug);
    this.logger.log(`Store reinstated: ${store.slug}`);
    this.gateway.emitPlatformEvent(WsEvents.STORE_REINSTATED, { storeId: id, slug: store.slug });
    return { message: 'Store reinstated' };
  }

  // ─── Super Admin: Usage & Analytics ──────────────────────────────────────

  async getUsage(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { quota: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    const limits = await this.prisma.planLimit.findUnique({ where: { plan: store.plan } });

    const [orderCountThisMonth, totalRevenue] = await this.prisma.$transaction([
      this.prisma.order.count({
        where: {
          storeId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      this.prisma.order.aggregate({
        where: { storeId },
        _sum: { total: true },
      }),
    ]);

    const quota = store.quota
      ? { ...store.quota, storageBytes: Number(store.quota.storageBytes) }
      : null;

    return {
      store:    { id: store.id, name: store.name, slug: store.slug, plan: store.plan, isActive: store.isActive },
      quota,
      limits,
      computed: {
        orderCountThisMonth,
        totalRevenue: Number(totalRevenue._sum.total ?? 0),
      },
    };
  }

  async getPlatformOverview() {
    const [totalStores, storesByPlan, totalRevenue, activeStores] = await this.prisma.$transaction([
      this.prisma.store.count(),
      this.prisma.store.groupBy({ by: ['plan'], _count: { _all: true }, orderBy: { plan: 'asc' } }),
      this.prisma.order.aggregate({ _sum: { total: true } }),
      this.prisma.store.count({ where: { isActive: true } }),
    ]);

    const recentLogs = await this.prisma.tenantApiLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { storeId: true, path: true, method: true, statusCode: true, durationMs: true, createdAt: true },
    });

    return {
      totalStores,
      activeStores,
      storesByPlan: Object.fromEntries(storesByPlan.map((g) => [g.plan, (g._count as { _all: number })._all])),
      totalRevenue: Number(totalRevenue._sum.total ?? 0),
      recentApiLogs: recentLogs,
    };
  }

  // ─── Store Owner: Settings ────────────────────────────────────────────────

  async getSettings(storeId: string) {
    const settings = await this.prisma.storeSetting.findMany({ where: { storeId } });
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }

  async upsertSetting(storeId: string, dto: UpsertSettingDto) {
    return this.prisma.storeSetting.upsert({
      where:  { storeId_key: { storeId, key: dto.key } },
      update: { value: dto.value },
      create: { storeId, key: dto.key, value: dto.value },
    });
  }

  async deleteSetting(storeId: string, key: string) {
    const existing = await this.prisma.storeSetting.findUnique({
      where: { storeId_key: { storeId, key } },
    });
    if (!existing) throw new NotFoundException(`Setting '${key}' not found`);
    await this.prisma.storeSetting.delete({ where: { storeId_key: { storeId, key } } });
    return { message: `Setting '${key}' deleted` };
  }

  // ─── Store Owner: Team Members ────────────────────────────────────────────

  async listMembers(storeId: string) {
    return this.prisma.storeUser.findMany({
      where: { storeId },
      include: { user: { select: { id: true, name: true, email: true, phone: true, avatar: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(storeId: string, userId: string, role: StoreRole) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (existing) throw new ConflictException('User is already a member of this store');

    // Enforce staff count quota before adding
    await this.tenant.checkStaffQuota(storeId);

    return this.prisma.storeUser.create({
      data: { storeId, userId, role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async updateMemberRole(storeId: string, userId: string, role: StoreRole) {
    const member = await this.prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found in this store');
    if (member.role === StoreRole.OWNER && role !== StoreRole.OWNER) {
      throw new BadRequestException('Cannot change the role of the store owner');
    }

    return this.prisma.storeUser.update({
      where: { storeId_userId: { storeId, userId } },
      data:  { role },
    });
  }

  async removeMember(storeId: string, userId: string) {
    const member = await this.prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === StoreRole.OWNER) throw new BadRequestException('Cannot remove the store owner');

    await this.prisma.storeUser.delete({ where: { storeId_userId: { storeId, userId } } });
    return { message: 'Member removed' };
  }

  // ─── Public: check slug availability ─────────────────────────────────────

  async checkSlug(slug: string): Promise<{ available: boolean; slug: string }> {
    const normalized = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    const exists = await this.prisma.store.findFirst({ where: { slug: normalized } });
    return { available: !exists, slug: normalized };
  }

  // ─── Public: resolve store by slug or custom domain ──────────────────────

  async resolvePublic(slug?: string, domain?: string) {
    if (!slug && !domain) {
      throw new BadRequestException('Provide slug or domain query param');
    }

    const store = await this.prisma.store.findFirst({
      where: slug ? { slug } : { customDomain: domain },
      select: {
        id:           true,
        name:         true,
        slug:         true,
        plan:         true,
        logoUrl:      true,
        faviconUrl:   true,
        customDomain: true,
        isActive:     true,
      },
    });

    if (!store) throw new NotFoundException('Store not found');
    return store;
  }
}
