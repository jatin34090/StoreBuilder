import { Plan } from '@prisma/client';

// Unlimited decision: null for all unlimited fields (standardized in Phase 17).
// -1 sentinel is no longer used; all guards check `=== null`.

export interface PlanLimits {
  maxProducts:    number | null; // null = unlimited
  maxOrders:      number | null; // null = unlimited (monthly)
  maxStorageGB:   number;
  maxStaff:       number | null; // null = unlimited
  maxDomains:     number | null; // null = unlimited
  maxApiPerDay:   number;
  maxApiPerMonth: number;
}

export const DEFAULT_PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.FREE]: {
    maxProducts:    25,
    maxOrders:      50,
    maxStorageGB:   1,
    maxStaff:       1,
    maxDomains:     1,
    maxApiPerDay:   100,
    maxApiPerMonth: 1000,
  },
  [Plan.STARTER]: {
    maxProducts:    500,
    maxOrders:      1000,
    maxStorageGB:   5,
    maxStaff:       3,
    maxDomains:     2,
    maxApiPerDay:   1000,
    maxApiPerMonth: 25000,
  },
  [Plan.PROFESSIONAL]: {
    // Legacy plan — existing stores migrated to GROWTH in Phase 17 migration.
    // Kept here so adminUpdatePlanLimit create-path has a fallback.
    maxProducts:    5000,
    maxOrders:      10000,
    maxStorageGB:   25,
    maxStaff:       10,
    maxDomains:     5,
    maxApiPerDay:   10000,
    maxApiPerMonth: 250000,
  },
  [Plan.GROWTH]: {
    maxProducts:    5000,
    maxOrders:      10000,
    maxStorageGB:   25,
    maxStaff:       10,
    maxDomains:     5,
    maxApiPerDay:   10000,
    maxApiPerMonth: 250000,
  },
  [Plan.BUSINESS]: {
    maxProducts:    null,
    maxOrders:      50000,
    maxStorageGB:   100,
    maxStaff:       30,
    maxDomains:     10,
    maxApiPerDay:   50000,
    maxApiPerMonth: 1000000,
  },
  [Plan.ENTERPRISE]: {
    maxProducts:    null,
    maxOrders:      null,
    maxStorageGB:   1000,
    maxStaff:       null,
    maxDomains:     null,
    maxApiPerDay:   1000000,
    maxApiPerMonth: 10000000,
  },
};

// Core features are available on every plan.
// advanced_reports and bulk_import are available from GROWTH upward.
export const ALL_PLAN_FEATURES = [
  'analytics',
  'coupons',
  'staff_management',
  'advanced_theme',
  'custom_pages',
  'shipping_integrations',
  'payment_integrations',
  'custom_domain',
  'api_access',
  'advanced_reports',
  'bulk_import',
] as const;

export type PlanFeature = typeof ALL_PLAN_FEATURES[number];

const CORE_FEATURES: PlanFeature[] = [
  'analytics', 'coupons', 'staff_management', 'advanced_theme', 'custom_pages',
  'shipping_integrations', 'payment_integrations', 'custom_domain', 'api_access',
];

const ALL_FEATURES: PlanFeature[] = [...CORE_FEATURES, 'advanced_reports', 'bulk_import'];

export const DEFAULT_PLAN_DISPLAY: Record<Plan, {
  name: string;
  description: string;
  priceMonthly: number; // paise (₹1 = 100 paise)
  priceYearly: number;  // paise
  trialDays: number;
  features: PlanFeature[];
  sortOrder: number;
}> = {
  [Plan.FREE]: {
    name:         'Free',
    description:  'Launch your store',
    priceMonthly: 0,
    priceYearly:  0,
    trialDays:    0,
    features:     CORE_FEATURES,
    sortOrder:    0,
  },
  [Plan.STARTER]: {
    name:         'Starter',
    description:  'Grow your business',
    priceMonthly: 49900,   // ₹499
    priceYearly:  499000,  // ₹4,990 (~2 months free)
    trialDays:    14,
    features:     CORE_FEATURES,
    sortOrder:    1,
  },
  [Plan.PROFESSIONAL]: {
    // Legacy display — not shown to new users (isActive=false in PlanLimit)
    name:         'Professional',
    description:  'Legacy plan (migrated to Growth)',
    priceMonthly: 299900,
    priceYearly:  299900,
    trialDays:    21,
    features:     ALL_FEATURES,
    sortOrder:    99,
  },
  [Plan.GROWTH]: {
    name:         'Growth',
    description:  'Scale your sales',
    priceMonthly: 149900,  // ₹1,499
    priceYearly:  1499000, // ₹14,990 (~2 months free)
    trialDays:    21,
    features:     ALL_FEATURES,
    sortOrder:    2,
  },
  [Plan.BUSINESS]: {
    name:         'Business',
    description:  'Run high-volume commerce',
    priceMonthly: 399900,  // ₹3,999
    priceYearly:  3999000, // ₹39,990 (~2 months free)
    trialDays:    30,
    features:     ALL_FEATURES,
    sortOrder:    3,
  },
  [Plan.ENTERPRISE]: {
    name:         'Enterprise',
    description:  'Built around your business',
    priceMonthly: 0,  // custom pricing — shown as "Contact Sales" in UI
    priceYearly:  0,
    trialDays:    30,
    features:     ALL_FEATURES,
    sortOrder:    4,
  },
};
