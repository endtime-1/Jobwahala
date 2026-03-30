ALTER TABLE "Message"
ALTER COLUMN "content" DROP NOT NULL;

ALTER TABLE "Message"
ADD COLUMN "attachmentUrl" TEXT,
ADD COLUMN "attachmentName" TEXT,
ADD COLUMN "attachmentContentType" TEXT,
ADD COLUMN "attachmentSizeBytes" INTEGER;
