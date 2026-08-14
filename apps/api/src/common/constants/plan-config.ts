import { Plan } from '@prisma/client';

export interface PlanLimits {
  maxProducts:    number;   // -1 = unlimited
  maxOrders:      number | null; // null = unlimited
  maxStorageGB:   number;
  maxStaff:       number;   // -1 = unlimited
  maxApiPerDay:   number;
  maxApiPerMonth: number;
}

export const DEFAULT_PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.FREE]: {
    maxProducts:    50,
    maxOrders:      100,
    maxStorageGB:   1,
    maxStaff:       2,
    maxApiPerDay:   1000,
    maxApiPerMonth: 20000,
  },
  [Plan.STARTER]: {
    maxProducts:    500,
    maxOrders:      1000,
    maxStorageGB:   10,
    maxStaff:       5,
    maxApiPerDay:   5000,
    maxApiPerMonth: 100000,
  },
  [Plan.PROFESSIONAL]: {
    maxProducts:    5000,
    maxOrders:      10000,
    maxStorageGB:   100,
    maxStaff:       20,
    maxApiPerDay:   20000,
    maxApiPerMonth: 500000,
  },
  [Plan.ENTERPRISE]: {
    maxProducts:    -1,
    maxOrders:      null,
    maxStorageGB:   500,
    maxStaff:       -1,
    maxApiPerDay:   100000,
    maxApiPerMonth: 2000000,
  },
};

export const ALL_PLAN_FEATURES = [
  'analytics',
  'coupons',
  'staff_management',
  'advanced_theme',
  'custom_pages',
  'advanced_reports',
  'bulk_import',
  'shipping_integrations',
  'payment_integrations',
  'custom_domain',
  'api_access',
] as const;

export type PlanFeature = typeof ALL_PLAN_FEATURES[number];

export const DEFAULT_PLAN_DISPLAY: Record<Plan, {
  name: string;
  description: string;
  priceMonthly: number; // paise
  priceYearly: number;  // paise
  trialDays: number;
  features: PlanFeature[];
  sortOrder: number;
}> = {
  [Plan.FREE]: {
    name:         'Free',
    description:  'Get started at no cost. Perfect for exploring the platform.',
    priceMonthly: 0,
    priceYearly:  0,
    trialDays:    0,
    features:     ['analytics', 'coupons'],
    sortOrder:    0,
  },
  [Plan.STARTER]: {
    name:         'Starter',
    description:  'For growing businesses ready to sell online.',
    priceMonthly: 99900,  // ₹999
    priceYearly:  99900,
    trialDays:    14,
    features:     ['analytics', 'coupons', 'staff_management', 'advanced_theme', 'custom_pages'],
    sortOrder:    1,
  },
  [Plan.PROFESSIONAL]: {
    name:         'Professional',
    description:  'Serious sellers who need more power and automation.',
    priceMonthly: 299900, // ₹2,999
    priceYearly:  299900,
    trialDays:    14,
    features:     [
      'analytics', 'coupons', 'staff_management', 'advanced_theme', 'custom_pages',
      'advanced_reports', 'bulk_import', 'shipping_integrations', 'payment_integrations',
    ],
    sortOrder:    2,
  },
  [Plan.ENTERPRISE]: {
    name:         'Enterprise',
    description:  'Custom limits and dedicated support for large operations.',
    priceMonthly: 999900, // ₹9,999
    priceYearly:  999900,
    trialDays:    30,
    features:     [
      'analytics', 'coupons', 'staff_management', 'advanced_theme', 'custom_pages',
      'advanced_reports', 'bulk_import', 'shipping_integrations', 'payment_integrations',
      'custom_domain', 'api_access',
    ],
    sortOrder:    3,
  },
};
