-- Every existing job (active or not) gets a closing date 30 days from the moment this runs.
ALTER TABLE "Job" ADD COLUMN     "closesAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '30 days'),
ADD COLUMN     "expiryWarningSentAt" TIMESTAMP(3);

CREATE INDEX "Job_status_closesAt_idx" ON "Job"("status", "closesAt");
