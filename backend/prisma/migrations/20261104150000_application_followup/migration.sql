ALTER TABLE "EmployerProfile" ADD COLUMN     "avgResponseHours" DOUBLE PRECISION,
ADD COLUMN     "responseCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Application" ADD COLUMN     "firstRespondedAt" TIMESTAMP(3),
ADD COLUMN     "newReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "statusChangedAt" TIMESTAMP(3);

CREATE INDEX "Application_status_createdAt_idx" ON "Application"("status", "createdAt");
