-- CreateTable
CREATE TABLE "AgreementDispute" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "counterpartyId" TEXT,
    "resolverId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgreementDispute_agreementId_createdAt_idx" ON "AgreementDispute"("agreementId", "createdAt");

-- CreateIndex
CREATE INDEX "AgreementDispute_creatorId_createdAt_idx" ON "AgreementDispute"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "AgreementDispute_counterpartyId_createdAt_idx" ON "AgreementDispute"("counterpartyId", "createdAt");

-- CreateIndex
CREATE INDEX "AgreementDispute_resolverId_createdAt_idx" ON "AgreementDispute"("resolverId", "createdAt");

-- CreateIndex
CREATE INDEX "AgreementDispute_status_createdAt_idx" ON "AgreementDispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgreementDispute_type_status_idx" ON "AgreementDispute"("type", "status");

-- AddForeignKey
ALTER TABLE "AgreementDispute" ADD CONSTRAINT "AgreementDispute_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementDispute" ADD CONSTRAINT "AgreementDispute_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementDispute" ADD CONSTRAINT "AgreementDispute_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementDispute" ADD CONSTRAINT "AgreementDispute_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
