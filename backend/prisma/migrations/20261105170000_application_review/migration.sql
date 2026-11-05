-- CreateTable
CREATE TABLE "ApplicationReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "rating" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationReview_applicationId_key" ON "ApplicationReview"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationReview_employerId_idx" ON "ApplicationReview"("employerId");

-- AddForeignKey
ALTER TABLE "ApplicationReview" ADD CONSTRAINT "ApplicationReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
