-- Phase 8: SaaS Billing, Subscriptions, Plans and Usage Limits
-- Manual migration (migrate dev requires interactive terminal)

-- 1. Extend SubscriptionStatus enum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIALING';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAST_DUE';

-- 2. New InvoiceStatus enum
DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'VOID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Extend PlanLimit with billing + display fields
ALTER TABLE "PlanLimit"
  ADD COLUMN IF NOT EXISTS "priceMonthly" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "priceYearly"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currency"     TEXT    NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS "displayName"  TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "description"  TEXT,
  ADD COLUMN IF NOT EXISTS "features"     JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "isActive"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "trialDays"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxRatePct"   INTEGER NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- 4. Extend StoreSubscription with trial + cancel fields
ALTER TABLE "StoreSubscription"
  ADD COLUMN IF NOT EXISTS "billingCycle"  TEXT NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS "trialStart"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialEnd"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt"   TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "StoreSubscription_status_trialEnd_idx"
  ON "StoreSubscription"("status", "trialEnd");

-- 5. Create Invoice table
CREATE TABLE IF NOT EXISTS "Invoice" (
  "id"                 TEXT        NOT NULL,
  "invoiceNumber"      TEXT        NOT NULL,
  "storeId"            TEXT        NOT NULL,
  "subscriptionId"     TEXT,
  "plan"               "Plan"      NOT NULL,
  "planSnapshot"       JSONB       NOT NULL DEFAULT '{}',
  "amount"             INTEGER     NOT NULL DEFAULT 0,
  "tax"                INTEGER     NOT NULL DEFAULT 0,
  "currency"           TEXT        NOT NULL DEFAULT 'INR',
  "status"             "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "billingPeriodStart" TIMESTAMP(3),
  "billingPeriodEnd"   TIMESTAMP(3),
  "providerInvoiceId"  TEXT,
  "issuedAt"           TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "paidAt"             TIMESTAMP(3),
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key"     ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_providerInvoiceId_key" ON "Invoice"("providerInvoiceId")
  WHERE "providerInvoiceId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Invoice_storeId_issuedAt_idx"         ON "Invoice"("storeId", "issuedAt");
CREATE INDEX IF NOT EXISTS "Invoice_subscriptionId_idx"           ON "Invoice"("subscriptionId");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "StoreSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Create WebhookEvent table (idempotency)
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id"          TEXT         NOT NULL,
  "provider"    TEXT         NOT NULL,
  "eventId"     TEXT         NOT NULL,
  "eventType"   TEXT         NOT NULL,
  "payload"     JSONB        NOT NULL DEFAULT '{}',
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_eventId_key"
  ON "WebhookEvent"("provider", "eventId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_processedAt_idx"
  ON "WebhookEvent"("provider", "processedAt");

-- 7. Create BillingAuditLog table
CREATE TABLE IF NOT EXISTS "BillingAuditLog" (
  "id"        TEXT         NOT NULL,
  "storeId"   TEXT,
  "actorId"   TEXT,
  "action"    TEXT         NOT NULL,
  "oldValue"  JSONB,
  "newValue"  JSONB,
  "metadata"  JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "BillingAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BillingAuditLog_storeId_createdAt_idx"
  ON "BillingAuditLog"("storeId", "createdAt");

-- 8. Seed PlanLimit with billing data (upsert-style — idempotent)
UPDATE "PlanLimit" SET
  "displayName"  = 'Free',
  "description"  = 'Get started at no cost. Perfect for exploring the platform.',
  "priceMonthly" = 0,
  "priceYearly"  = 0,
  "sortOrder"    = 0,
  "trialDays"    = 0,
  "features"     = '["analytics","coupons"]'::jsonb
WHERE "plan" = 'FREE';

UPDATE "PlanLimit" SET
  "displayName"  = 'Starter',
  "description"  = 'For growing businesses ready to sell online.',
  "priceMonthly" = 99900,
  "priceYearly"  = 99900,
  "sortOrder"    = 1,
  "trialDays"    = 14,
  "features"     = '["analytics","coupons","staff_management","advanced_theme","custom_pages"]'::jsonb
WHERE "plan" = 'STARTER';

UPDATE "PlanLimit" SET
  "displayName"  = 'Professional',
  "description"  = 'Serious sellers who need more power and automation.',
  "priceMonthly" = 299900,
  "priceYearly"  = 299900,
  "sortOrder"    = 2,
  "trialDays"    = 14,
  "features"     = '["analytics","coupons","staff_management","advanced_theme","custom_pages","advanced_reports","bulk_import","shipping_integrations","payment_integrations"]'::jsonb
WHERE "plan" = 'PROFESSIONAL';

UPDATE "PlanLimit" SET
  "displayName"  = 'Enterprise',
  "description"  = 'Custom limits and dedicated support for large operations.',
  "priceMonthly" = 999900,
  "priceYearly"  = 999900,
  "sortOrder"    = 3,
  "trialDays"    = 30,
  "features"     = '["analytics","coupons","staff_management","advanced_theme","custom_pages","advanced_reports","bulk_import","shipping_integrations","payment_integrations","custom_domain","api_access"]'::jsonb
WHERE "plan" = 'ENTERPRISE';
