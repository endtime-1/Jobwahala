-- AlterTable
ALTER TABLE "VerificationRequest" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "contactVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "registrationNumber" TEXT;
-- CreateTable
CREATE TABLE "ContactVerificationCode" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactVerificationCode_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "ContactVerificationCode_verificationRequestId_createdAt_idx" ON "ContactVerificationCode"("verificationRequestId", "createdAt");
-- CreateIndex
CREATE INDEX "AdminActionLog_targetType_targetId_createdAt_idx" ON "AdminActionLog"("targetType", "targetId", "createdAt");
-- CreateIndex
CREATE INDEX "AdminActionLog_adminId_createdAt_idx" ON "AdminActionLog"("adminId", "createdAt");
-- CreateIndex
CREATE INDEX "AdminActionLog_createdAt_idx" ON "AdminActionLog"("createdAt");
-- AddForeignKey
ALTER TABLE "ContactVerificationCode" ADD CONSTRAINT "ContactVerificationCode_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "VerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
