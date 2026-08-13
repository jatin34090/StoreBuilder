-- ─── Multi-Tenant Migration ──────────────────────────────────────────────────
-- Creates the Store/tenant model and adds storeId to all tenant-scoped tables.
-- Existing data is assigned to a single "default" store so the app keeps working.

-- ─── 1. New enums ────────────────────────────────────────────────────────────

CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "StoreRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'DELIVERY_AGENT');

-- ─── 2. New tables ───────────────────────────────────────────────────────────

CREATE TABLE "Store" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "slug"         TEXT NOT NULL,
  "customDomain" TEXT,
  "plan"         "Plan" NOT NULL DEFAULT 'FREE',
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "logoUrl"      TEXT,
  "faviconUrl"   TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");
CREATE UNIQUE INDEX "Store_customDomain_key" ON "Store"("customDomain");
CREATE INDEX "Store_slug_idx" ON "Store"("slug");
CREATE INDEX "Store_plan_isActive_idx" ON "Store"("plan", "isActive");

CREATE TABLE "StoreUser" (
  "id"        TEXT NOT NULL,
  "storeId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "role"      "StoreRole" NOT NULL DEFAULT 'STAFF',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StoreUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreUser_storeId_userId_key" ON "StoreUser"("storeId", "userId");
CREATE INDEX "StoreUser_storeId_role_idx" ON "StoreUser"("storeId", "role");
CREATE INDEX "StoreUser_userId_idx" ON "StoreUser"("userId");

CREATE TABLE "StoreSetting" (
  "storeId"   TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("storeId", "key")
);
CREATE INDEX "StoreSetting_storeId_idx" ON "StoreSetting"("storeId");

CREATE TABLE "PlanLimit" (
  "plan"           "Plan" NOT NULL,
  "maxProducts"    INTEGER NOT NULL DEFAULT 100,
  "maxStaff"       INTEGER NOT NULL DEFAULT 3,
  "maxStorageGB"   INTEGER NOT NULL DEFAULT 5,
  "maxApiPerDay"   INTEGER NOT NULL DEFAULT 10000,
  "maxApiPerMonth" INTEGER NOT NULL DEFAULT 200000,
  "maxOrders"      INTEGER,

  CONSTRAINT "PlanLimit_pkey" PRIMARY KEY ("plan")
);

CREATE TABLE "StoreQuotaUsage" (
  "storeId"        TEXT NOT NULL,
  "productCount"   INTEGER NOT NULL DEFAULT 0,
  "orderCount"     INTEGER NOT NULL DEFAULT 0,
  "customerCount"  INTEGER NOT NULL DEFAULT 0,
  "storageBytes"   BIGINT NOT NULL DEFAULT 0,
  "apiCallsToday"  INTEGER NOT NULL DEFAULT 0,
  "apiCallsMonth"  INTEGER NOT NULL DEFAULT 0,
  "lastDayReset"   TIMESTAMP(3),
  "lastMonthReset" TIMESTAMP(3),
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StoreQuotaUsage_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE "TenantApiLog" (
  "id"         TEXT NOT NULL,
  "storeId"    TEXT NOT NULL,
  "path"       TEXT NOT NULL,
  "method"     TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TenantApiLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TenantApiLog_storeId_createdAt_idx" ON "TenantApiLog"("storeId", "createdAt");

-- ─── 3. Seed default store & seed plan limits ─────────────────────────────────

INSERT INTO "Store" ("id", "name", "slug", "plan", "isActive", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Store', 'default', 'PROFESSIONAL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "StoreQuotaUsage" ("storeId", "updatedAt") VALUES ('00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP);

INSERT INTO "PlanLimit" ("plan", "maxProducts", "maxStaff", "maxStorageGB", "maxApiPerDay", "maxApiPerMonth")
VALUES
  ('FREE',         100,   3,   5,    10000,   200000),
  ('STARTER',      500,   5,   10,   50000,   1000000),
  ('PROFESSIONAL', 5000,  20,  100,  100000,  2000000),
  ('ENTERPRISE',   99999, 100, 1000, 1000000, 20000000);

-- ─── 4. Add storeId columns (nullable first for backfill) ────────────────────

ALTER TABLE "Category"     ADD COLUMN "storeId" TEXT;
ALTER TABLE "Product"      ADD COLUMN "storeId" TEXT;
ALTER TABLE "Order"        ADD COLUMN "storeId" TEXT;
ALTER TABLE "Coupon"       ADD COLUMN "storeId" TEXT;
ALTER TABLE "Review"       ADD COLUMN "storeId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "storeId" TEXT;
ALTER TABLE "CartItem"     ADD COLUMN "storeId" TEXT;
ALTER TABLE "WishlistItem" ADD COLUMN "storeId" TEXT;
ALTER TABLE "DeliveryAgent" ADD COLUMN "storeId" TEXT;

-- ─── 5. Backfill all existing rows → default store ───────────────────────────

UPDATE "Category"     SET "storeId" = '00000000-0000-0000-0000-000000000001';
UPDATE "Product"      SET "storeId" = '00000000-0000-0000-0000-000000000001';
UPDATE "Order"        SET "storeId" = '00000000-0000-0000-0000-000000000001';
UPDATE "Coupon"       SET "storeId" = '00000000-0000-0000-0000-000000000001';
UPDATE "Review"       SET "storeId" = '00000000-0000-0000-0000-000000000001';
UPDATE "Notification" SET "storeId" = '00000000-0000-0000-0000-000000000001';
UPDATE "CartItem"     SET "storeId" = '00000000-0000-0000-0000-000000000001';
UPDATE "WishlistItem" SET "storeId" = '00000000-0000-0000-0000-000000000001';
UPDATE "DeliveryAgent" SET "storeId" = '00000000-0000-0000-0000-000000000001';

-- Assign the first ADMIN user as the store owner
INSERT INTO "StoreUser" ("id", "storeId", "userId", "role", "createdAt")
SELECT
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000001',
  "id",
  'OWNER',
  CURRENT_TIMESTAMP
FROM "User"
WHERE "role" = 'ADMIN'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Update quota counters for the default store
UPDATE "StoreQuotaUsage" SET
  "productCount" = (SELECT COUNT(*) FROM "Product" WHERE "storeId" = '00000000-0000-0000-0000-000000000001'),
  "orderCount"   = (SELECT COUNT(*) FROM "Order"   WHERE "storeId" = '00000000-0000-0000-0000-000000000001'),
  "updatedAt"    = CURRENT_TIMESTAMP
WHERE "storeId" = '00000000-0000-0000-0000-000000000001';

-- ─── 6. Make storeId NOT NULL now that all rows are backfilled ────────────────

ALTER TABLE "Category"     ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Product"      ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Order"        ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Coupon"       ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Review"       ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Notification" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "CartItem"     ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "WishlistItem" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "DeliveryAgent" ALTER COLUMN "storeId" SET NOT NULL;

-- ─── 7. Drop old unique constraints that are now store-scoped ────────────────

ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_slug_key";
ALTER TABLE "Coupon"   DROP CONSTRAINT IF EXISTS "Coupon_code_key";
ALTER TABLE "Product"  DROP CONSTRAINT IF EXISTS "Product_slug_key";

-- Drop old CartItem unique (userId, variantId) — replace with (storeId, userId, variantId)
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_userId_variantId_key";
-- Drop old WishlistItem unique
ALTER TABLE "WishlistItem" DROP CONSTRAINT IF EXISTS "WishlistItem_userId_productId_key";

-- ─── 8. Add new compound unique constraints ───────────────────────────────────

ALTER TABLE "Category"     ADD CONSTRAINT "Category_storeId_slug_key"          UNIQUE ("storeId", "slug");
ALTER TABLE "Product"      ADD CONSTRAINT "Product_storeId_slug_key"            UNIQUE ("storeId", "slug");
ALTER TABLE "Coupon"       ADD CONSTRAINT "Coupon_storeId_code_key"             UNIQUE ("storeId", "code");
ALTER TABLE "CartItem"     ADD CONSTRAINT "CartItem_storeId_userId_variantId_key" UNIQUE ("storeId", "userId", "variantId");
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_storeId_userId_productId_key" UNIQUE ("storeId", "userId", "productId");

-- ─── 9. Add tenant-compound indexes (critical for query performance) ──────────

CREATE INDEX "Category_storeId_isActive_idx"     ON "Category"("storeId", "isActive");
CREATE INDEX "Category_storeId_parentId_idx"     ON "Category"("storeId", "parentId");
CREATE INDEX "Category_storeId_sortOrder_idx"    ON "Category"("storeId", "sortOrder");

-- Remove old Product index and add tenant-aware ones
DROP INDEX IF EXISTS "Product_slug_categoryId_isActive_idx";
CREATE INDEX "Product_storeId_isActive_createdAt_idx"  ON "Product"("storeId", "isActive", "createdAt");
CREATE INDEX "Product_storeId_categoryId_isActive_idx" ON "Product"("storeId", "categoryId", "isActive");
CREATE INDEX "Product_storeId_isFeatured_isActive_idx" ON "Product"("storeId", "isFeatured", "isActive");
CREATE INDEX "Product_storeId_createdAt_idx"           ON "Product"("storeId", "createdAt");

-- Remove old Order index and add tenant-aware ones
DROP INDEX IF EXISTS "Order_userId_status_createdAt_idx";
CREATE INDEX "Order_storeId_status_createdAt_idx" ON "Order"("storeId", "status", "createdAt");
CREATE INDEX "Order_storeId_userId_createdAt_idx" ON "Order"("storeId", "userId", "createdAt");
CREATE INDEX "Order_storeId_createdAt_idx"        ON "Order"("storeId", "createdAt");
CREATE INDEX "Order_storeId_status_idx"           ON "Order"("storeId", "status");

CREATE INDEX "Coupon_storeId_isActive_idx"           ON "Coupon"("storeId", "isActive");
CREATE INDEX "Review_storeId_productId_isVisible_idx" ON "Review"("storeId", "productId", "isVisible");
CREATE INDEX "Review_storeId_createdAt_idx"           ON "Review"("storeId", "createdAt");
CREATE INDEX "Notification_storeId_userId_isRead_idx" ON "Notification"("storeId", "userId", "isRead");
CREATE INDEX "Notification_storeId_createdAt_idx"     ON "Notification"("storeId", "createdAt");
CREATE INDEX "CartItem_storeId_userId_idx"            ON "CartItem"("storeId", "userId");
CREATE INDEX "WishlistItem_storeId_userId_idx"        ON "WishlistItem"("storeId", "userId");
CREATE INDEX "DeliveryAgent_storeId_isOnline_idx"     ON "DeliveryAgent"("storeId", "isOnline");

-- Misc new indexes
CREATE INDEX "ProductImage_productId_isPrimary_idx" ON "ProductImage"("productId", "isPrimary");
CREATE INDEX "ProductImage_variantId_idx"           ON "ProductImage"("variantId");
CREATE INDEX "ProductVariant_productId_idx"         ON "ProductVariant"("productId");
CREATE INDEX "OrderItem_orderId_idx"                ON "OrderItem"("orderId");
CREATE INDEX "User_role_idx"                        ON "User"("role");
CREATE INDEX "Address_userId_idx"                   ON "Address"("userId");
CREATE INDEX "RefreshToken_userId_idx"              ON "RefreshToken"("userId");

-- ─── 10. Foreign keys for new storeId columns ────────────────────────────────

ALTER TABLE "Category"     ADD CONSTRAINT "Category_storeId_fkey"     FOREIGN KEY ("storeId")  REFERENCES "Store"("id") ON DELETE CASCADE;
ALTER TABLE "Product"      ADD CONSTRAINT "Product_storeId_fkey"      FOREIGN KEY ("storeId")  REFERENCES "Store"("id") ON DELETE CASCADE;
ALTER TABLE "Order"        ADD CONSTRAINT "Order_storeId_fkey"        FOREIGN KEY ("storeId")  REFERENCES "Store"("id");
ALTER TABLE "Coupon"       ADD CONSTRAINT "Coupon_storeId_fkey"       FOREIGN KEY ("storeId")  REFERENCES "Store"("id") ON DELETE CASCADE;
ALTER TABLE "Review"       ADD CONSTRAINT "Review_storeId_fkey"       FOREIGN KEY ("storeId")  REFERENCES "Store"("id");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_storeId_fkey" FOREIGN KEY ("storeId")  REFERENCES "Store"("id") ON DELETE CASCADE;
ALTER TABLE "CartItem"     ADD CONSTRAINT "CartItem_storeId_fkey"     FOREIGN KEY ("storeId")  REFERENCES "Store"("id") ON DELETE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_storeId_fkey" FOREIGN KEY ("storeId")  REFERENCES "Store"("id") ON DELETE CASCADE;
ALTER TABLE "DeliveryAgent" ADD CONSTRAINT "DeliveryAgent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id");

-- Foreign keys for new tables
ALTER TABLE "StoreUser"      ADD CONSTRAINT "StoreUser_storeId_fkey"      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE;
ALTER TABLE "StoreUser"      ADD CONSTRAINT "StoreUser_userId_fkey"        FOREIGN KEY ("userId")  REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "StoreSetting"   ADD CONSTRAINT "StoreSetting_storeId_fkey"    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE;
ALTER TABLE "StoreQuotaUsage" ADD CONSTRAINT "StoreQuotaUsage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE;
ALTER TABLE "TenantApiLog"   ADD CONSTRAINT "TenantApiLog_storeId_fkey"    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE;
