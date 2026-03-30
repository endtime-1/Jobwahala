ALTER TABLE "Job"
ADD COLUMN "postedByAdminId" TEXT,
ADD COLUMN "postedByAdminAt" TIMESTAMP(3);

CREATE INDEX "Job_postedByAdminId_idx" ON "Job"("postedByAdminId");
CREATE INDEX "Job_postedByAdminAt_idx" ON "Job"("postedByAdminAt");

ALTER TABLE "Job"
ADD CONSTRAINT "Job_postedByAdminId_fkey"
FOREIGN KEY ("postedByAdminId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
