
-- AlterTable
ALTER TABLE "JobSeekerProfile" ADD COLUMN     "careerStage" TEXT,
ADD COLUMN     "completionYear" INTEGER,
ADD COLUMN     "institution" TEXT,
ADD COLUMN     "programme" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "durationMonths" INTEGER,
ADD COLUMN     "possibleJobOffer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "schedule" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "startsImmediately" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unpaid" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Job_type_status_closesAt_idx" ON "Job"("type", "status", "closesAt");

