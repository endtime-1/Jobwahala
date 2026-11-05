-- AlterTable
ALTER TABLE "JobSeekerProfile" DROP COLUMN "visibleToEmployers",
ADD COLUMN     "availability" TEXT,
ADD COLUMN     "cvVisibility" TEXT NOT NULL DEFAULT 'HIDDEN',
ADD COLUMN     "cvVisibleSince" TIMESTAMP(3),
ADD COLUMN     "educationLevel" TEXT,
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "jobCategory" TEXT,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "profileBoostedUntil" TIMESTAMP(3),
ADD COLUMN     "yearsExperience" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "monthlyUnlocks" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CvUnlock" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "seekerId" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvProfileView" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "seekerId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvProfileView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvBlock" (
    "id" TEXT NOT NULL,
    "seekerId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCandidateSearch" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filtersJson" TEXT NOT NULL DEFAULT '{}',
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastAlertAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCandidateSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateInvite" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "seekerId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CvUnlock_employerId_createdAt_idx" ON "CvUnlock"("employerId", "createdAt");

-- CreateIndex
CREATE INDEX "CvUnlock_seekerId_createdAt_idx" ON "CvUnlock"("seekerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CvUnlock_employerId_seekerId_key" ON "CvUnlock"("employerId", "seekerId");

-- CreateIndex
CREATE INDEX "CvProfileView_seekerId_createdAt_idx" ON "CvProfileView"("seekerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CvProfileView_employerId_seekerId_day_key" ON "CvProfileView"("employerId", "seekerId", "day");

-- CreateIndex
CREATE INDEX "CvBlock_employerId_idx" ON "CvBlock"("employerId");

-- CreateIndex
CREATE UNIQUE INDEX "CvBlock_seekerId_employerId_key" ON "CvBlock"("seekerId", "employerId");

-- CreateIndex
CREATE INDEX "SavedCandidateSearch_employerId_idx" ON "SavedCandidateSearch"("employerId");

-- CreateIndex
CREATE INDEX "SavedCandidateSearch_alertsEnabled_idx" ON "SavedCandidateSearch"("alertsEnabled");

-- CreateIndex
CREATE INDEX "CandidateInvite_seekerId_createdAt_idx" ON "CandidateInvite"("seekerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateInvite_employerId_seekerId_jobId_key" ON "CandidateInvite"("employerId", "seekerId", "jobId");

-- CreateIndex
CREATE INDEX "JobSeekerProfile_cvVisibility_profileBoostedUntil_idx" ON "JobSeekerProfile"("cvVisibility", "profileBoostedUntil");

-- AddForeignKey
ALTER TABLE "CvUnlock" ADD CONSTRAINT "CvUnlock_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvUnlock" ADD CONSTRAINT "CvUnlock_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvProfileView" ADD CONSTRAINT "CvProfileView_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvProfileView" ADD CONSTRAINT "CvProfileView_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvBlock" ADD CONSTRAINT "CvBlock_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvBlock" ADD CONSTRAINT "CvBlock_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCandidateSearch" ADD CONSTRAINT "SavedCandidateSearch_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateInvite" ADD CONSTRAINT "CandidateInvite_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateInvite" ADD CONSTRAINT "CandidateInvite_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateInvite" ADD CONSTRAINT "CandidateInvite_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

