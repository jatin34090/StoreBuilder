-- Phase 17: Usage-Based Pricing & Plan Architecture
-- Safe migration: adds new plans, migrates PROFESSIONAL→GROWTH, fixes unlimited sentinels

-- 1. Add new Plan enum values (PostgreSQL only allows ADD, not DROP/RENAME)
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'GROWTH';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'BUSINESS';

-- 2. Migrate PROFESSIONAL subscribers to GROWTH (preserve all data)
UPDATE "Store"             SET "plan" = 'GROWTH' WHERE "plan" = 'PROFESSIONAL';
UPDATE "StoreSubscription" SET "plan" = 'GROWTH' WHERE "plan" = 'PROFESSIONAL';
UPDATE "Invoice"           SET "plan" = 'GROWTH' WHERE "plan" = 'PROFESSIONAL';

-- 3. Standardize unlimited sentinel: make maxProducts and maxStaff nullable
ALTER TABLE "PlanLimit" ALTER COLUMN "maxProducts" DROP NOT NULL;
ALTER TABLE "PlanLimit" ALTER COLUMN "maxStaff"    DROP NOT NULL;

-- 4. Convert -1 unlimited sentinels to null
UPDATE "PlanLimit" SET "maxProducts" = NULL WHERE "maxProducts" = -1;
UPDATE "PlanLimit" SET "maxStaff"    = NULL WHERE "maxStaff"    = -1;

-- 5. Add maxDomains (null = unlimited)
ALTER TABLE "PlanLimit" ADD COLUMN IF NOT EXISTS "maxDomains" INTEGER;

-- 6. Add monthly order counter (reset by cron on 1st of each month)
ALTER TABLE "StoreQuotaUsage" ADD COLUMN IF NOT EXISTS "orderCountThisMonth" INTEGER NOT NULL DEFAULT 0;

-- 7. Upsert new plan limits ─────────────────────────────────────────────────
-- NOTE: priceMonthly in paise: ₹499=49900, ₹1499=149900, ₹3999=399900
-- All plans include ALL core features — limits differ, not features.

-- FREE plan (updated limits)
INSERT INTO "PlanLimit" (
  "plan","maxProducts","maxStaff","maxStorageGB","maxDomains",
  "maxApiPerDay","maxApiPerMonth","maxOrders",
  "priceMonthly","priceYearly","currency","displayName","description",
  "features","isActive","sortOrder","trialDays","taxRatePct","updatedAt"
) VALUES (
  'FREE', 25, 1, 1, 1,
  100, 1000, 50,
  0, 0, 'INR', 'Free', 'Launch your store',
  '["analytics","coupons","staff_management","advanced_theme","custom_pages","shipping_integrations","payment_integrations","custom_domain","api_access"]',
  true, 0, 0, 18, NOW()
)
ON CONFLICT ("plan") DO UPDATE SET
  "maxProducts"    = 25,
  "maxStaff"       = 1,
  "maxStorageGB"   = 1,
  "maxDomains"     = 1,
  "maxApiPerDay"   = 100,
  "maxApiPerMonth" = 1000,
  "maxOrders"      = 50,
  "priceMonthly"   = 0,
  "priceYearly"    = 0,
  "displayName"    = 'Free',
  "description"    = 'Launch your store',
  "features"       = '["analytics","coupons","staff_management","advanced_theme","custom_pages","shipping_integrations","payment_integrations","custom_domain","api_access"]',
  "isActive"       = true,
  "sortOrder"      = 0,
  "trialDays"      = 0,
  "updatedAt"      = NOW();

-- STARTER plan (updated limits and pricing)
INSERT INTO "PlanLimit" (
  "plan","maxProducts","maxStaff","maxStorageGB","maxDomains",
  "maxApiPerDay","maxApiPerMonth","maxOrders",
  "priceMonthly","priceYearly","currency","displayName","description",
  "features","isActive","sortOrder","trialDays","taxRatePct","updatedAt"
) VALUES (
  'STARTER', 500, 3, 5, 2,
  1000, 25000, 1000,
  49900, 499000, 'INR', 'Starter', 'Grow your business',
  '["analytics","coupons","staff_management","advanced_theme","custom_pages","shipping_integrations","payment_integrations","custom_domain","api_access"]',
  true, 1, 14, 18, NOW()
)
ON CONFLICT ("plan") DO UPDATE SET
  "maxProducts"    = 500,
  "maxStaff"       = 3,
  "maxStorageGB"   = 5,
  "maxDomains"     = 2,
  "maxApiPerDay"   = 1000,
  "maxApiPerMonth" = 25000,
  "maxOrders"      = 1000,
  "priceMonthly"   = 49900,
  "priceYearly"    = 499000,
  "displayName"    = 'Starter',
  "description"    = 'Grow your business',
  "features"       = '["analytics","coupons","staff_management","advanced_theme","custom_pages","shipping_integrations","payment_integrations","custom_domain","api_access"]',
  "isActive"       = true,
  "sortOrder"      = 1,
  "trialDays"      = 14,
  "updatedAt"      = NOW();

-- GROWTH plan (new — replaces PROFESSIONAL)
INSERT INTO "PlanLimit" (
  "plan","maxProducts","maxStaff","maxStorageGB","maxDomains",
  "maxApiPerDay","maxApiPerMonth","maxOrders",
  "priceMonthly","priceYearly","currency","displayName","description",
  "features","isActive","sortOrder","trialDays","taxRatePct","updatedAt"
) VALUES (
  'GROWTH', 5000, 10, 25, 5,
  10000, 250000, 10000,
  149900, 1499000, 'INR', 'Growth', 'Scale your sales',
  '["analytics","coupons","staff_management","advanced_theme","custom_pages","advanced_reports","bulk_import","shipping_integrations","payment_integrations","custom_domain","api_access"]',
  true, 2, 21, 18, NOW()
)
ON CONFLICT ("plan") DO NOTHING;

-- BUSINESS plan (new)
INSERT INTO "PlanLimit" (
  "plan","maxProducts","maxStaff","maxStorageGB","maxDomains",
  "maxApiPerDay","maxApiPerMonth","maxOrders",
  "priceMonthly","priceYearly","currency","displayName","description",
  "features","isActive","sortOrder","trialDays","taxRatePct","updatedAt"
) VALUES (
  'BUSINESS', NULL, 30, 100, 10,
  50000, 1000000, 50000,
  399900, 3999000, 'INR', 'Business', 'Run high-volume commerce',
  '["analytics","coupons","staff_management","advanced_theme","custom_pages","advanced_reports","bulk_import","shipping_integrations","payment_integrations","custom_domain","api_access"]',
  true, 3, 30, 18, NOW()
)
ON CONFLICT ("plan") DO NOTHING;

-- ENTERPRISE plan (updated to null for truly unlimited fields)
INSERT INTO "PlanLimit" (
  "plan","maxProducts","maxStaff","maxStorageGB","maxDomains",
  "maxApiPerDay","maxApiPerMonth","maxOrders",
  "priceMonthly","priceYearly","currency","displayName","description",
  "features","isActive","sortOrder","trialDays","taxRatePct","updatedAt"
) VALUES (
  'ENTERPRISE', NULL, NULL, 1000, NULL,
  1000000, 10000000, NULL,
  0, 0, 'INR', 'Enterprise', 'Built around your business',
  '["analytics","coupons","staff_management","advanced_theme","custom_pages","advanced_reports","bulk_import","shipping_integrations","payment_integrations","custom_domain","api_access"]',
  true, 4, 30, 18, NOW()
)
ON CONFLICT ("plan") DO UPDATE SET
  "maxProducts"    = NULL,
  "maxStaff"       = NULL,
  "maxStorageGB"   = 1000,
  "maxDomains"     = NULL,
  "maxApiPerDay"   = 1000000,
  "maxApiPerMonth" = 10000000,
  "maxOrders"      = NULL,
  "displayName"    = 'Enterprise',
  "description"    = 'Built around your business',
  "features"       = '["analytics","coupons","staff_management","advanced_theme","custom_pages","advanced_reports","bulk_import","shipping_integrations","payment_integrations","custom_domain","api_access"]',
  "isActive"       = true,
  "sortOrder"      = 4,
  "updatedAt"      = NOW();

-- 8. Deactivate PROFESSIONAL plan (migrated to GROWTH; hidden from new signups)
UPDATE "PlanLimit" SET "isActive" = false, "sortOrder" = 99 WHERE "plan" = 'PROFESSIONAL';
