import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, Plan, StoreRole, StoreStatus, StoreUserStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { EventsGateway, WsEvents } from '../events/events.gateway';
import type { CreateStoreDto } from './dto/create-store.dto';
import type { UpdateStoreDto } from './dto/update-store.dto';
import type { QueryStoresDto } from './dto/query-stores.dto';
import type { UpsertSettingDto } from './dto/upsert-setting.dto';
import { DEFAULT_PLAN_LIMITS, DEFAULT_PLAN_DISPLAY } from '../../common/constants/plan-config';

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
    const display = DEFAULT_PLAN_DISPLAY[plan];
    await this.prisma.planLimit.upsert({
      where:  { plan },
      update: {},
      create: {
        plan,
        ...DEFAULT_PLAN_LIMITS[plan],
        displayName:  display.name,
        description:  display.description,
        priceMonthly: display.priceMonthly,
        priceYearly:  display.priceYearly,
        trialDays:    display.trialDays,
        sortOrder:    display.sortOrder,
        features:     display.features as unknown as object[],
        isActive:     true,
      },
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

    if (dto.slug && dto.slug !== store.slug) {
      const slugExists = await this.prisma.store.findUnique({ where: { slug: dto.slug } });
      if (slugExists) throw new ConflictException(`Slug '${dto.slug}' is already taken`);
    }

    const updated = await this.prisma.store.update({
      where: { id },
      data: {
        ...(dto.name         !== undefined && { name:         dto.name.trim() }),
        ...(dto.slug         !== undefined && { slug:         dto.slug.toLowerCase().trim() }),
        ...(dto.businessName !== undefined && { businessName: dto.businessName }),
        ...(dto.industry     !== undefined && { industry:     dto.industry }),
        ...(dto.description  !== undefined && { description:  dto.description }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
        ...(dto.phone        !== undefined && { phone:        dto.phone }),
        ...(dto.address      !== undefined && { address:      dto.address }),
        ...(dto.country      !== undefined && { country:      dto.country }),
        ...(dto.currency     !== undefined && { currency:     dto.currency }),
        ...(dto.timezone     !== undefined && { timezone:     dto.timezone }),
        ...(dto.plan         !== undefined && { plan:         dto.plan }),
        ...(dto.customDomain !== undefined && { customDomain: dto.customDomain }),
        ...(dto.logoUrl      !== undefined && { logoUrl:      dto.logoUrl }),
        ...(dto.faviconUrl   !== undefined && { faviconUrl:   dto.faviconUrl }),
        ...(dto.isActive     !== undefined && { isActive:     dto.isActive }),
      },
    });

    // If slug changed, invalidate old slug cache too
    this.tenant.invalidateStoreCache(id, store.slug);
    if (dto.slug && dto.slug !== store.slug) this.tenant.invalidateStoreCache(id, dto.slug);
    this.logger.log(`Store updated: ${store.slug}`);
    return updated;
  }

  async launch(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      select: { id: true, slug: true, status: true, isActive: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.status === StoreStatus.SUSPENDED) {
      throw new BadRequestException('Store is suspended by the platform. Contact support to reinstate.');
    }
    if (store.status === StoreStatus.ACTIVE) {
      return { success: true, message: 'Store is already active', slug: store.slug };
    }

    await this.prisma.store.update({
      where: { id },
      data: { status: StoreStatus.ACTIVE, isActive: true },
    });

    await this.prisma.onboardingState.update({
      where: { storeId: id },
      data: { launched: true, completedAt: new Date() },
    }).catch(() => {});

    this.tenant.invalidateStoreCache(id, store.slug);
    this.logger.log(`Store launched: ${store.slug}`);
    return { success: true, message: 'Store launched successfully', slug: store.slug };
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

  async removeMember(storeId: string, userId: string, actorUserId: string) {
    const member = await this.prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === StoreRole.OWNER) throw new BadRequestException('Cannot remove the store owner');
    if (userId === actorUserId) throw new BadRequestException('You cannot remove yourself');

    await this.prisma.storeUser.update({
      where: { storeId_userId: { storeId, userId } },
      data: { status: StoreUserStatus.INACTIVE },
    });
    await this.logAudit(storeId, actorUserId, 'MEMBER_DEACTIVATED', userId, {});
    return { message: 'Member deactivated' };
  }

  async updateMemberRoleWithAudit(storeId: string, userId: string, role: StoreRole, actorUserId: string) {
    const member = await this.prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found in this store');
    if (member.role === StoreRole.OWNER) throw new BadRequestException('Cannot change the role of the store owner');
    if (userId === actorUserId) throw new BadRequestException('Cannot change your own role');
    if (role === StoreRole.OWNER) throw new BadRequestException('Cannot promote to OWNER via role change — use ownership transfer');

    const updated = await this.prisma.storeUser.update({
      where: { storeId_userId: { storeId, userId } },
      data: { role },
    });
    await this.logAudit(storeId, actorUserId, 'ROLE_CHANGED', userId, { oldRole: member.role, newRole: role });
    return updated;
  }

  // ─── Staff Invitation ─────────────────────────────────────────────────────

  async inviteStaff(storeId: string, actorUserId: string, email: string, role: 'ADMIN' | 'MANAGER' | 'STAFF', name?: string) {
    // Check staff quota
    await this.tenant.checkStaffQuota(storeId);

    email = email.toLowerCase().trim();

    // Check if user already exists on platform
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      // Check if already a member
      const existingMembership = await this.prisma.storeUser.findUnique({
        where: { storeId_userId: { storeId, userId: existingUser.id } },
      });
      if (existingMembership && existingMembership.status === StoreUserStatus.ACTIVE) {
        throw new ConflictException('This user is already an active member of this store');
      }
      if (existingMembership) {
        // Reactivate deactivated membership
        const updated = await this.prisma.storeUser.update({
          where: { storeId_userId: { storeId, userId: existingUser.id } },
          data: { role: role as StoreRole, status: StoreUserStatus.ACTIVE, joinedAt: new Date() },
          include: { user: { select: { id: true, name: true, email: true } } },
        });
        await this.logAudit(storeId, actorUserId, 'MEMBER_REACTIVATED', existingUser.id, { role });
        return { ...updated, invitationToken: null };
      }
      // Existing user with no membership — add directly as ACTIVE
      const membership = await this.prisma.storeUser.create({
        data: {
          storeId, userId: existingUser.id,
          role: role as StoreRole, status: StoreUserStatus.ACTIVE,
          invitedByUserId: actorUserId, invitedAt: new Date(), joinedAt: new Date(),
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      await this.logAudit(storeId, actorUserId, 'MEMBER_ADDED', existingUser.id, { role });
      return { ...membership, invitationToken: null };
    }

    // New user — create a pending invitation
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Check for an existing pending invite to this email in this store
    const pendingInvite = await this.prisma.storeUser.findFirst({
      where: { storeId, invitationEmail: email, status: StoreUserStatus.PENDING },
    });
    if (pendingInvite) {
      // Refresh the token
      await this.prisma.storeUser.update({
        where: { id: pendingInvite.id },
        data: { invitationToken: token, invitationExpires: expires, role: role as StoreRole },
      });
      this.logger.log(`Invitation refreshed for ${email} → store ${storeId} | token: ${token}`);
      return { invitationToken: token, email, role, message: 'Invitation refreshed' };
    }

    // Create a placeholder storeUser with no userId (userId defaults to a placeholder for now)
    // We use a temporary user record tied to the invitation
    const placeholderUser = await this.prisma.user.create({
      data: {
        name: name ?? email.split('@')[0],
        email,
        role: 'ADMIN',
        isVerified: false,
      },
    });

    await this.prisma.storeUser.create({
      data: {
        storeId,
        userId: placeholderUser.id,
        role: role as StoreRole,
        status: StoreUserStatus.PENDING,
        invitationEmail: email,
        invitationToken: token,
        invitationExpires: expires,
        invitedByUserId: actorUserId,
        invitedAt: new Date(),
      },
    });

    await this.logAudit(storeId, actorUserId, 'INVITE_SENT', placeholderUser.id, { email, role });
    this.logger.log(`Invitation sent to ${email} for store ${storeId} | token: ${token}`);

    // In production, send an email here. In dev, we return the token.
    return { invitationToken: token, email, role, message: 'Invitation sent' };
  }

  async getInvitationInfo(token: string) {
    const membership = await this.prisma.storeUser.findUnique({
      where: { invitationToken: token },
      include: { store: { select: { id: true, name: true, slug: true, logoUrl: true } } },
    });
    if (!membership) throw new NotFoundException('Invalid invitation token');
    if (membership.status !== StoreUserStatus.PENDING) throw new BadRequestException('This invitation has already been used');
    if (membership.invitationExpires && membership.invitationExpires < new Date()) {
      throw new BadRequestException('This invitation has expired');
    }
    return {
      store: membership.store,
      email: membership.invitationEmail,
      role: membership.role,
      expiresAt: membership.invitationExpires,
    };
  }

  async acceptInvitation(token: string, password: string) {
    const membership = await this.prisma.storeUser.findUnique({
      where: { invitationToken: token },
      include: { user: true, store: { select: { id: true, name: true, slug: true } } },
    });

    if (!membership) throw new NotFoundException('Invalid or expired invitation token');
    if (membership.status !== StoreUserStatus.PENDING) throw new BadRequestException('This invitation has already been used');
    if (membership.invitationExpires && membership.invitationExpires < new Date()) {
      throw new BadRequestException('This invitation has expired');
    }

    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);

    // Activate the user account and membership
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: membership.userId },
        data: { passwordHash, isVerified: true },
      }),
      this.prisma.storeUser.update({
        where: { id: membership.id },
        data: {
          status: StoreUserStatus.ACTIVE,
          invitationToken: null,
          invitationExpires: null,
          joinedAt: new Date(),
        },
      }),
    ]);

    await this.logAudit(membership.storeId, membership.userId, 'INVITE_ACCEPTED', membership.userId, {});

    return {
      message: 'Invitation accepted. You can now log in.',
      store: membership.store,
      email: membership.invitationEmail,
    };
  }

  async resendInvitation(storeId: string, userId: string, actorUserId: string) {
    const member = await this.prisma.storeUser.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!member || member.status !== StoreUserStatus.PENDING) {
      throw new BadRequestException('No pending invitation found for this user');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.storeUser.update({
      where: { id: member.id },
      data: { invitationToken: token, invitationExpires: expires },
    });

    this.logger.log(`Invitation resent to ${member.invitationEmail} | token: ${token}`);
    return { invitationToken: token, message: 'Invitation resent' };
  }

  // ─── Admin Me endpoint ────────────────────────────────────────────────────

  async getAdminMe(userId: string, storeId: string) {
    const [user, membership, store] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, phone: true, avatar: true, role: true },
      }),
      this.prisma.storeUser.findUnique({
        where: { storeId_userId: { storeId, userId } },
        select: { role: true, status: true, joinedAt: true, createdAt: true },
      }),
      this.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, slug: true, status: true, plan: true, businessName: true, logoUrl: true },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!store) throw new NotFoundException('Store not found');

    const { getPermissionsForRole } = await import('../../common/permissions/permissions');
    const storeRole = membership?.role ?? 'STAFF';
    const permissions = getPermissionsForRole(storeRole);

    return { user, store, role: storeRole, permissions, membership };
  }

  // ─── Audit Log ────────────────────────────────────────────────────────────

  async getAuditLog(storeId: string, limit = 50) {
    return this.prisma.storeAuditLog.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async logAudit(storeId: string, actorUserId: string, action: string, targetUserId?: string, metadata?: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta: any = metadata ?? null;
    await this.prisma.storeAuditLog.create({
      data: { id: crypto.randomUUID(), storeId, actorUserId, action, targetUserId, metadata: meta },
    }).catch(() => {}); // never block on audit log failure
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
