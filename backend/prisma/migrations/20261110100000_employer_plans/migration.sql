
-- AlterTable
ALTER TABLE "JobSeekerProfile" ADD COLUMN     "visibleToEmployers" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EmployerProfile" ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "galleryJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "whyWorkWithUs" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brandedPage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cvDatabase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hiringReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planTier" TEXT,
ADD COLUMN     "teamLimit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "topEmployers" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "authorizationCode" TEXT,
ADD COLUMN     "graceEndsAt" TIMESTAMP(3),
ADD COLUMN     "graceRemindersSent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nextCreditGrantAt" TIMESTAMP(3),
ADD COLUMN     "pendingProductId" TEXT;

-- AlterTable
ALTER TABLE "CreditAccount" ADD COLUMN     "planBoostCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "planFeaturedCredits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "inviteTokenHash" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobView" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_inviteTokenHash_key" ON "TeamMember"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_ownerId_email_key" ON "TeamMember"("ownerId", "email");

-- CreateIndex
CREATE INDEX "JobView_jobId_createdAt_idx" ON "JobView"("jobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobView_jobId_visitorHash_key" ON "JobView"("jobId", "visitorHash");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobView" ADD CONSTRAINT "JobView_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

