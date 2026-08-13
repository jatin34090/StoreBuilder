import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Plan, StoreRole, StoreStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { getTemplate } from './industry-templates';

export interface ProvisionStoreInput {
  name: string;
  slug: string;
  businessName?: string;
  industry?: string;
  description?: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  logoUrl?: string;
  plan?: Plan;
  ownerUserId: string;
}

export interface ProvisionedStore {
  id: string;
  name: string;
  slug: string;
  status: StoreStatus;
  plan: Plan;
}

const DEFAULT_PLAN_LIMITS: Record<Plan, {
  maxProducts: number; maxOrders: number | null; maxStorageGB: number;
  maxStaff: number; maxApiPerDay: number; maxApiPerMonth: number;
}> = {
  FREE:         { maxProducts: 50,    maxOrders: 100,   maxStorageGB: 1,   maxStaff: 2,  maxApiPerDay: 1000,   maxApiPerMonth: 20000 },
  STARTER:      { maxProducts: 500,   maxOrders: 1000,  maxStorageGB: 10,  maxStaff: 5,  maxApiPerDay: 5000,   maxApiPerMonth: 100000 },
  PROFESSIONAL: { maxProducts: 5000,  maxOrders: 10000, maxStorageGB: 100, maxStaff: 20, maxApiPerDay: 20000,  maxApiPerMonth: 500000 },
  ENTERPRISE:   { maxProducts: -1,    maxOrders: null,  maxStorageGB: 500, maxStaff: -1, maxApiPerDay: 100000, maxApiPerMonth: 2000000 },
};

@Injectable()
export class StoreProvisioningService {
  private readonly logger = new Logger(StoreProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  async provision(input: ProvisionStoreInput): Promise<ProvisionedStore> {
    const slug = input.slug.toLowerCase().trim();

    // Pre-flight checks outside the transaction (cheaper)
    const [slugTaken, ownerExists] = await Promise.all([
      this.prisma.store.findUnique({ where: { slug }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: input.ownerUserId }, select: { id: true } }),
    ]);

    if (slugTaken) {
      throw new ConflictException(
        `Store URL '${slug}' is already taken. Try '${slug}-store' or '${slug}-shop'.`,
      );
    }
    if (!ownerExists) {
      throw new BadRequestException('Owner user not found');
    }

    const plan = input.plan ?? Plan.FREE;
    const template = getTemplate(input.industry ?? 'GENERAL');

    // Build default StoreSetting key-value pairs
    const defaultSettings = this.buildDefaultSettings(input, template);

    // Build default navigation JSON
    const navItems = JSON.stringify(
      template.navItems.map((label, i) => ({
        id: `nav-${i}`,
        label,
        href: label === 'Home' ? '/' : `/${label.toLowerCase().replace(/\s+/g, '-')}`,
        order: i,
      })),
    );

    // Everything in one transaction — partial stores are never acceptable
    const store = await this.prisma.$transaction(async (tx) => {
      // 1. Create the store
      const created = await tx.store.create({
        data: {
          name:         input.name.trim(),
          slug,
          plan,
          status:       StoreStatus.SETUP,
          isActive:     true,
          businessName: input.businessName?.trim() ?? null,
          industry:     input.industry ?? null,
          description:  input.description?.trim() ?? null,
          contactEmail: input.contactEmail ?? null,
          phone:        input.phone ?? null,
          address:      input.address ?? null,
          country:      input.country ?? 'IN',
          currency:     input.currency ?? 'INR',
          timezone:     input.timezone ?? 'Asia/Kolkata',
          logoUrl:      input.logoUrl ?? null,
        },
      });

      // 2. Owner membership
      await tx.storeUser.create({
        data: { storeId: created.id, userId: input.ownerUserId, role: StoreRole.OWNER },
      });

      // 3. Subscription (FREE plan — no Razorpay needed)
      await tx.storeSubscription.create({
        data: {
          storeId:           created.id,
          plan,
          status:            'ACTIVE',
          razorpaySubId:     null,
          razorpayCustomerId: null,
          razorpayPlanId:    null,
          currentPeriodStart: new Date(),
          currentPeriodEnd:   null,
        },
      });

      // 4. Usage counters
      await tx.storeQuotaUsage.create({
        data: {
          storeId:      created.id,
          productCount: 0,
          orderCount:   0,
          storageBytes: BigInt(0),
        },
      });

      // 5. Default theme + settings (all as StoreSetting rows)
      if (defaultSettings.length > 0) {
        await tx.storeSetting.createMany({
          data: defaultSettings.map(([key, value]) => ({
            storeId: created.id,
            key,
            value,
          })),
          skipDuplicates: true,
        });
      }

      // 6. Navigation
      await tx.storeSetting.create({
        data: { storeId: created.id, key: 'nav.items', value: navItems },
      });

      // 7. Onboarding state
      await tx.onboardingState.create({
        data: {
          storeId:      created.id,
          businessInfo: !!(input.businessName || input.description),
          storeUrl:     true, // slug was chosen during creation
        },
      });

      // 8. Seed plan limits if missing
      await tx.planLimit.upsert({
        where:  { plan },
        update: {},
        create: { plan, ...DEFAULT_PLAN_LIMITS[plan] },
      });

      return created;
    });

    // 9. Industry categories (outside transaction — non-critical, can be added later)
    if (template.categories.length > 0) {
      await this.seedCategories(store.id, template.categories);
    }

    this.tenant.invalidateStoreCache(store.id, store.slug);
    this.logger.log(
      `Store provisioned: ${store.slug} (${store.id}) | owner: ${input.ownerUserId} | plan: ${plan} | industry: ${input.industry ?? 'GENERAL'}`,
    );

    return {
      id:     store.id,
      name:   store.name,
      slug:   store.slug,
      status: store.status,
      plan:   store.plan,
    };
  }

  private buildDefaultSettings(
    input: ProvisionStoreInput,
    template: ReturnType<typeof getTemplate>,
  ): [string, string][] {
    const name = input.name.trim();
    return [
      ['site.brandName',      name],
      ['site.tagline',        `Welcome to ${name}`],
      ['site.contactEmail',   input.contactEmail ?? ''],
      ['site.phone',          input.phone ?? ''],
      ['site.currency',       input.currency ?? 'INR'],
      ['site.timezone',       input.timezone ?? 'Asia/Kolkata'],
      ['site.country',        input.country ?? 'IN'],
      ['site.status',         'active'],
      ['site.maintenance',    'false'],
      ['seo.title',           name],
      ['seo.description',     input.description ?? `Shop at ${name}`],
      ['theme.primary',       template.themeColor],
      ['theme.background',    '#FFFFFF'],
      ['theme.border',        '#E5E7EB'],
      ['theme.radius',        '0.5rem'],
      ['theme.darkMode',      'false'],
      ['layout.productColumns', '4'],
      ['layout.heroStyle',    'banner'],
      ['layout.cardStyle',    'classic'],
    ];
  }

  private async seedCategories(storeId: string, categoryNames: string[]): Promise<void> {
    try {
      await this.prisma.category.createMany({
        data: categoryNames.map((name, i) => ({
          storeId,
          name,
          slug:      name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          sortOrder: i,
          isActive:  true,
        })),
        skipDuplicates: true,
      });
    } catch (err) {
      // Non-fatal — store is already provisioned; owner can create categories manually
      this.logger.warn(`Category seeding failed for store ${storeId}: ${(err as Error).message}`);
    }
  }

  // Returns onboarding state + percentage for a given store
  async getOnboardingState(storeId: string) {
    const state = await this.prisma.onboardingState.findUnique({ where: { storeId } });
    if (!state) return null;

    const steps = [
      { key: 'businessInfo', label: 'Business Information', done: state.businessInfo },
      { key: 'storeUrl',     label: 'Store URL',            done: state.storeUrl },
      { key: 'theme',        label: 'Theme',                done: state.theme },
      { key: 'firstProduct', label: 'First Product',        done: state.firstProduct },
      { key: 'payment',      label: 'Payment',              done: state.payment },
      { key: 'shipping',     label: 'Shipping',             done: state.shipping },
      { key: 'launched',     label: 'Launch',               done: state.launched },
    ];

    const doneCount = steps.filter((s) => s.done).length;
    const pct = Math.round((doneCount / steps.length) * 100);

    return { steps, percent: pct, completedAt: state.completedAt };
  }

  async markStep(storeId: string, step: string, done: boolean): Promise<void> {
    const validSteps = [
      'businessInfo', 'storeUrl', 'theme',
      'firstProduct', 'payment', 'shipping', 'launched',
    ] as const;

    if (!validSteps.includes(step as typeof validSteps[number])) {
      throw new BadRequestException(`Unknown onboarding step: ${step}`);
    }

    await this.prisma.onboardingState.upsert({
      where:  { storeId },
      update: { [step]: done },
      create: { storeId, [step]: done },
    });

    // If launched → flip store status to ACTIVE
    if (step === 'launched' && done) {
      await this.prisma.store.update({
        where: { id: storeId },
        data:  { status: StoreStatus.ACTIVE },
      });
      this.tenant.invalidateStoreCache(storeId);
    }
  }
}
