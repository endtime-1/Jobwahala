-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "salaryMax" INTEGER,
ADD COLUMN     "salaryMin" INTEGER,
ADD COLUMN     "salaryParsedAt" TIMESTAMP(3);
-- CreateIndex
CREATE INDEX "Job_salaryMax_idx" ON "Job"("salaryMax");
