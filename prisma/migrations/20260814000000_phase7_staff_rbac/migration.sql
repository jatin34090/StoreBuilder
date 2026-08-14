-- Phase 7: Store Staff RBAC — add MANAGER role, StoreUserStatus enum,
-- extend StoreUser with invitation/status fields, add StoreAuditLog

-- 1. New enums
CREATE TYPE "StoreUserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- 2. Add MANAGER to StoreRole
ALTER TYPE "StoreRole" ADD VALUE 'MANAGER';

-- 3. Extend StoreUser table
ALTER TABLE "StoreUser"
  ADD COLUMN "status"            "StoreUserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "invitationEmail"   TEXT,
  ADD COLUMN "invitationToken"   TEXT,
  ADD COLUMN "invitationExpires" TIMESTAMP(3),
  ADD COLUMN "invitedByUserId"   TEXT,
  ADD COLUMN "invitedAt"         TIMESTAMP(3),
  ADD COLUMN "joinedAt"          TIMESTAMP(3),
  ADD COLUMN "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- 4. Unique constraint on invitationToken
CREATE UNIQUE INDEX "StoreUser_invitationToken_key" ON "StoreUser"("invitationToken");

-- 5. New indexes
CREATE INDEX "StoreUser_storeId_status_idx" ON "StoreUser"("storeId", "status");
CREATE INDEX "StoreUser_invitationToken_idx" ON "StoreUser"("invitationToken");

-- 6. FK for invitedByUserId
ALTER TABLE "StoreUser"
  ADD CONSTRAINT "StoreUser_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. StoreAuditLog table
CREATE TABLE "StoreAuditLog" (
  "id"           TEXT NOT NULL,
  "storeId"      TEXT NOT NULL,
  "actorUserId"  TEXT NOT NULL,
  "action"       TEXT NOT NULL,
  "targetUserId" TEXT,
  "metadata"     JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreAuditLog_storeId_createdAt_idx" ON "StoreAuditLog"("storeId", "createdAt");
CREATE INDEX "StoreAuditLog_actorUserId_idx" ON "StoreAuditLog"("actorUserId");

ALTER TABLE "StoreAuditLog"
  ADD CONSTRAINT "StoreAuditLog_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
