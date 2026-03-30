-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "serviceRequestId" TEXT,
    "creatorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "amount" TEXT,
    "timeline" TEXT,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalRevision" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "amount" TEXT,
    "timeline" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Proposal_applicationId_idx" ON "Proposal"("applicationId");

-- CreateIndex
CREATE INDEX "Proposal_serviceRequestId_idx" ON "Proposal"("serviceRequestId");

-- CreateIndex
CREATE INDEX "Proposal_creatorId_idx" ON "Proposal"("creatorId");

-- CreateIndex
CREATE INDEX "Proposal_recipientId_idx" ON "Proposal"("recipientId");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");

-- CreateIndex
CREATE INDEX "Proposal_updatedAt_idx" ON "Proposal"("updatedAt");

-- CreateIndex
CREATE INDEX "Proposal_expiresAt_idx" ON "Proposal"("expiresAt");

-- CreateIndex
CREATE INDEX "ProposalRevision_proposalId_createdAt_idx" ON "ProposalRevision"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "ProposalRevision_authorId_idx" ON "ProposalRevision"("authorId");

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalRevision" ADD CONSTRAINT "ProposalRevision_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalRevision" ADD CONSTRAINT "ProposalRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
