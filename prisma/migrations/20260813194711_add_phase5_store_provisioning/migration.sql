-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('DRAFT', 'SETUP', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "address" TEXT,
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'IN',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "StoreStatus" NOT NULL DEFAULT 'SETUP',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "StoreSubscription" ALTER COLUMN "razorpaySubId" DROP NOT NULL,
ALTER COLUMN "razorpayPlanId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OnboardingState" (
    "storeId" TEXT NOT NULL,
    "businessInfo" BOOLEAN NOT NULL DEFAULT false,
    "storeUrl" BOOLEAN NOT NULL DEFAULT false,
    "theme" BOOLEAN NOT NULL DEFAULT false,
    "firstProduct" BOOLEAN NOT NULL DEFAULT false,
    "payment" BOOLEAN NOT NULL DEFAULT false,
    "shipping" BOOLEAN NOT NULL DEFAULT false,
    "launched" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingState_pkey" PRIMARY KEY ("storeId")
);

-- CreateIndex
CREATE INDEX "Store_status_idx" ON "Store"("status");

-- AddForeignKey
ALTER TABLE "OnboardingState" ADD CONSTRAINT "OnboardingState_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
