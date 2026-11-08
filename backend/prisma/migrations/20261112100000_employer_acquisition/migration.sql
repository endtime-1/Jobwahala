-- AlterTable
ALTER TABLE "BillingSettings" ADD COLUMN     "foundingFeaturedCredits" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "foundingLimit" INTEGER NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "EmployerProfile" ADD COLUMN     "claimStatus" TEXT NOT NULL DEFAULT 'CLAIMED',
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "createdByAdminId" TEXT,
ADD COLUMN     "foundingAt" TIMESTAMP(3),
ADD COLUMN     "foundingNumber" INTEGER,
ADD COLUMN     "isFoundingEmployer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referralRewardedAt" TIMESTAMP(3),
ADD COLUMN     "referredById" TEXT;

-- CreateTable
CREATE TABLE "CompanyClaim" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'LINK',
    "sentTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerWeeklyReport" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "dataJson" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployerWeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachContact" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "sector" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONTACTED',
    "notes" TEXT,
    "followUpAt" TIMESTAMP(3),
    "companyId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyClaim_tokenHash_key" ON "CompanyClaim"("tokenHash");

-- CreateIndex
CREATE INDEX "CompanyClaim_companyId_status_idx" ON "CompanyClaim"("companyId", "status");

-- CreateIndex
CREATE INDEX "EmployerWeeklyReport_employerId_weekStart_idx" ON "EmployerWeeklyReport"("employerId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerWeeklyReport_employerId_weekStart_key" ON "EmployerWeeklyReport"("employerId", "weekStart");

-- CreateIndex
CREATE INDEX "OutreachContact_status_followUpAt_idx" ON "OutreachContact"("status", "followUpAt");

-- CreateIndex
CREATE INDEX "OutreachContact_createdAt_idx" ON "OutreachContact"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerProfile_foundingNumber_key" ON "EmployerProfile"("foundingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerProfile_referralCode_key" ON "EmployerProfile"("referralCode");

-- CreateIndex
CREATE INDEX "EmployerProfile_referredById_idx" ON "EmployerProfile"("referredById");

-- CreateIndex
CREATE INDEX "EmployerProfile_claimStatus_idx" ON "EmployerProfile"("claimStatus");
