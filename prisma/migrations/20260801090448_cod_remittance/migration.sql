-- CreateEnum
CREATE TYPE "RemittanceStatus" AS ENUM ('PENDING', 'SUBMITTED', 'RECEIVED');

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "codCollected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "codCollectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CodRemittance" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "RemittanceStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodRemittance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodRemittanceItem" (
    "id" TEXT NOT NULL,
    "remittanceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodRemittanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodRemittance_agentId_status_idx" ON "CodRemittance"("agentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CodRemittanceItem_orderId_key" ON "CodRemittanceItem"("orderId");

-- AddForeignKey
ALTER TABLE "CodRemittance" ADD CONSTRAINT "CodRemittance_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "DeliveryAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodRemittanceItem" ADD CONSTRAINT "CodRemittanceItem_remittanceId_fkey" FOREIGN KEY ("remittanceId") REFERENCES "CodRemittance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodRemittanceItem" ADD CONSTRAINT "CodRemittanceItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
