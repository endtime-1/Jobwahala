
-- AlterTable
ALTER TABLE "EmployerProfile" ADD COLUMN     "isTrainingProvider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providerReviewNote" TEXT,
ADD COLUMN     "providerReviewedAt" TIMESTAMP(3),
ADD COLUMN     "providerStatus" TEXT NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'ALL',
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "priceGhs" INTEGER,
    "durationWeeks" INTEGER,
    "format" TEXT NOT NULL DEFAULT 'ONLINE',
    "location" TEXT,
    "startDatesJson" TEXT NOT NULL DEFAULT '[]',
    "rollingStart" BOOLEAN NOT NULL DEFAULT false,
    "certificateOffered" BOOLEAN NOT NULL DEFAULT false,
    "enrolUrl" TEXT,
    "enquiryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "featuredFrom" TIMESTAMP(3),
    "featuredUntil" TIMESTAMP(3),
    "videoProvider" TEXT,
    "videoRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSkill" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,

    CONSTRAINT "CourseSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEvent" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnquiry" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerCourse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "providerName" TEXT,
    "completedOn" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SELF',
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_providerId_idx" ON "Course"("providerId");

-- CreateIndex
CREATE INDEX "Course_status_reviewStatus_idx" ON "Course"("status", "reviewStatus");

-- CreateIndex
CREATE INDEX "Course_category_idx" ON "Course"("category");

-- CreateIndex
CREATE INDEX "Course_featuredUntil_idx" ON "Course"("featuredUntil");

-- CreateIndex
CREATE INDEX "CourseSkill_skill_idx" ON "CourseSkill"("skill");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSkill_courseId_skill_key" ON "CourseSkill"("courseId", "skill");

-- CreateIndex
CREATE INDEX "CourseEvent_courseId_type_createdAt_idx" ON "CourseEvent"("courseId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEvent_courseId_type_visitorHash_key" ON "CourseEvent"("courseId", "type", "visitorHash");

-- CreateIndex
CREATE INDEX "CourseEnquiry_courseId_createdAt_idx" ON "CourseEnquiry"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseEnquiry_userId_idx" ON "CourseEnquiry"("userId");

-- CreateIndex
CREATE INDEX "LearnerCourse_userId_idx" ON "LearnerCourse"("userId");

-- CreateIndex
CREATE INDEX "LearnerCourse_courseId_status_idx" ON "LearnerCourse"("courseId", "status");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSkill" ADD CONSTRAINT "CourseSkill_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEvent" ADD CONSTRAINT "CourseEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnquiry" ADD CONSTRAINT "CourseEnquiry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnquiry" ADD CONSTRAINT "CourseEnquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerCourse" ADD CONSTRAINT "LearnerCourse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerCourse" ADD CONSTRAINT "LearnerCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

