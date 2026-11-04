CREATE TABLE "InterestSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterestSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InterestSignup_email_source_key" ON "InterestSignup"("email", "source");
CREATE UNIQUE INDEX "InterestSignup_phone_source_key" ON "InterestSignup"("phone", "source");
CREATE INDEX "InterestSignup_source_createdAt_idx" ON "InterestSignup"("source", "createdAt");
