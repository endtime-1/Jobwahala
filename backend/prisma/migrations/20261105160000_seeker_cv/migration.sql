-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "cvFileName" TEXT,
ADD COLUMN     "cvFileUrl" TEXT,
ADD COLUMN     "cvSource" TEXT;
-- CreateTable
CREATE TABLE "SeekerCv" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadedUrl" TEXT,
    "uploadedFileName" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "builderUrl" TEXT,
    "builderFileName" TEXT,
    "builderSavedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeekerCv_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "SeekerCv_userId_key" ON "SeekerCv"("userId");
-- AddForeignKey
ALTER TABLE "SeekerCv" ADD CONSTRAINT "SeekerCv_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
