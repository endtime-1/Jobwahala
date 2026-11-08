-- AlterTable
ALTER TABLE "AdminActionLog" ADD COLUMN     "actorRole" TEXT NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "BillingSettings" ADD COLUMN     "hiringFromPriceGhs" INTEGER,
ADD COLUMN     "hiringGuaranteeDays" INTEGER NOT NULL DEFAULT 90;

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "roleTitle" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "location" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "requirements" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "mustHavesJson" TEXT NOT NULL DEFAULT '[]',
    "jobId" TEXT,
    "assignedRecruiterId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "feePesewas" INTEGER,
    "depositPesewas" INTEGER,
    "guaranteeDays" INTEGER NOT NULL DEFAULT 90,
    "sentAt" TIMESTAMP(3),
    "filledAt" TIMESTAMP(3),
    "guaranteeEndsAt" TIMESTAMP(3),
    "guaranteeReminderSentAt" TIMESTAMP(3),
    "replacementCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringPayment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountPesewas" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringCandidate" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "seekerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'SOURCED',
    "consentAskedAt" TIMESTAMP(3),
    "consentAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "ratingsJson" TEXT NOT NULL DEFAULT '{}',
    "fitScore" INTEGER,
    "clientSummary" TEXT,
    "staffNotes" TEXT,
    "shortlistedAt" TIMESTAMP(3),
    "clientDecision" TEXT,
    "clientDecisionNote" TEXT,
    "clientDecidedAt" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "candidateId" TEXT,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HiringRequest_reference_key" ON "HiringRequest"("reference");

-- CreateIndex
CREATE INDEX "HiringRequest_clientId_createdAt_idx" ON "HiringRequest"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "HiringRequest_status_createdAt_idx" ON "HiringRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "HiringRequest_assignedRecruiterId_status_idx" ON "HiringRequest"("assignedRecruiterId", "status");

-- CreateIndex
CREATE INDEX "HiringRequest_status_guaranteeEndsAt_idx" ON "HiringRequest"("status", "guaranteeEndsAt");

-- CreateIndex
CREATE INDEX "HiringPayment_requestId_paidAt_idx" ON "HiringPayment"("requestId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "HiringCandidate_requestId_seekerId_key" ON "HiringCandidate"("requestId", "seekerId");

-- CreateIndex
CREATE INDEX "HiringCandidate_seekerId_stage_idx" ON "HiringCandidate"("seekerId", "stage");

-- CreateIndex
CREATE INDEX "HiringCandidate_requestId_stage_idx" ON "HiringCandidate"("requestId", "stage");

-- CreateIndex
CREATE INDEX "HiringEvent_requestId_createdAt_idx" ON "HiringEvent"("requestId", "createdAt");
