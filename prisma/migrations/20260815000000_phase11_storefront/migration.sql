-- Phase 11: Storefront Builder — Banner and HomepageSection tables

DO $$ BEGIN
  CREATE TYPE "HomepageSectionType" AS ENUM (
    'HERO', 'BANNERS', 'CATEGORIES', 'FEATURED_PRODUCTS', 'WHY_CHOOSE_US'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Banner" (
  "id"           TEXT NOT NULL,
  "storeId"      TEXT NOT NULL,
  "title"        TEXT,
  "subtitle"     TEXT,
  "ctaText"      TEXT,
  "ctaUrl"       TEXT,
  "desktopImage" TEXT NOT NULL,
  "mobileImage"  TEXT,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HomepageSection" (
  "id"        TEXT NOT NULL,
  "storeId"   TEXT NOT NULL,
  "type"      "HomepageSectionType" NOT NULL,
  "enabled"   BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "config"    JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Banner_storeId_isActive_sortOrder_idx"
  ON "Banner"("storeId", "isActive", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSection_storeId_type_key"
  ON "HomepageSection"("storeId", "type");

CREATE INDEX IF NOT EXISTS "HomepageSection_storeId_sortOrder_idx"
  ON "HomepageSection"("storeId", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "Banner" ADD CONSTRAINT "Banner_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "HomepageSection" ADD CONSTRAINT "HomepageSection_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
