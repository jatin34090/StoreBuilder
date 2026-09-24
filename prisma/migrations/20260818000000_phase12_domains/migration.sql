-- Phase 12: Custom Domains & Storefront Deployment
-- Adds StoreDomain model for per-store domain lifecycle management.

-- DomainType enum
CREATE TYPE "DomainType" AS ENUM ('PLATFORM_SUBDOMAIN', 'CUSTOM_DOMAIN');

-- DomainStatus enum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'ACTIVE', 'FAILED', 'DISABLED');

-- StoreDomain table
CREATE TABLE "StoreDomain" (
  "id"                TEXT         NOT NULL,
  "storeId"           TEXT         NOT NULL,
  "domain"            TEXT         NOT NULL,
  "normalizedDomain"  TEXT         NOT NULL,
  "type"              "DomainType" NOT NULL,
  "status"            "DomainStatus" NOT NULL DEFAULT 'PENDING',
  "isPrimary"         BOOLEAN      NOT NULL DEFAULT false,
  "verificationToken" TEXT,
  "verifiedAt"        TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StoreDomain_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "StoreDomain" ADD CONSTRAINT "StoreDomain_domain_key"            UNIQUE ("domain");
ALTER TABLE "StoreDomain" ADD CONSTRAINT "StoreDomain_normalizedDomain_key"  UNIQUE ("normalizedDomain");
ALTER TABLE "StoreDomain" ADD CONSTRAINT "StoreDomain_verificationToken_key" UNIQUE ("verificationToken");

-- Indexes
CREATE INDEX "StoreDomain_storeId_idx"              ON "StoreDomain"("storeId");
CREATE INDEX "StoreDomain_normalizedDomain_status_idx" ON "StoreDomain"("normalizedDomain", "status");

-- Foreign key
ALTER TABLE "StoreDomain" ADD CONSTRAINT "StoreDomain_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
