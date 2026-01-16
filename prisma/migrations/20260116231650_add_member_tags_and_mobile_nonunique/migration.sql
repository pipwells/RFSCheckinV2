/*
  Warnings:

  - You are about to drop the column `actorId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `actorType` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `after` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `before` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `entity` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `channel` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `memberId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `meta` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `sentAt` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `template` on the `Notification` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `entityType` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Config` table without a default value. This is not possible if the table is not empty.
  - Added the required column `message` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Member_organisationId_firegroundNumber_idx";

-- AlterTable
ALTER TABLE "public"."AuditLog" DROP COLUMN "actorId",
DROP COLUMN "actorType",
DROP COLUMN "after",
DROP COLUMN "before",
DROP COLUMN "entity",
ADD COLUMN     "entityType" TEXT NOT NULL,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "entityId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Config" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "value" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."Member" ALTER COLUMN "mobile" DROP NOT NULL,
ALTER COLUMN "mobileNormalized" DROP NOT NULL,
ALTER COLUMN "firegroundNumber" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."Notification" DROP COLUMN "channel",
DROP COLUMN "memberId",
DROP COLUMN "meta",
DROP COLUMN "sentAt",
DROP COLUMN "sessionId",
DROP COLUMN "status",
DROP COLUMN "template",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "name" DROP NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'site_manager';

-- AlterTable
ALTER TABLE "public"."UserStationAccess" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'site_manager';

-- DropEnum
DROP TYPE "public"."UserRole";

-- CreateTable
CREATE TABLE "public"."MemberTag" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tagValue" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberTag_organisationId_active_idx" ON "public"."MemberTag"("organisationId", "active");

-- CreateIndex
CREATE INDEX "MemberTag_memberId_idx" ON "public"."MemberTag"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberTag_organisationId_tagValue_key" ON "public"."MemberTag"("organisationId", "tagValue");

-- CreateIndex
CREATE INDEX "AuditLog_organisationId_createdAt_idx" ON "public"."AuditLog"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "Member_organisationId_isVisitor_idx" ON "public"."Member"("organisationId", "isVisitor");

-- CreateIndex
CREATE INDEX "Notification_organisationId_active_idx" ON "public"."Notification"("organisationId", "active");

-- AddForeignKey
ALTER TABLE "public"."MemberTag" ADD CONSTRAINT "MemberTag_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "public"."Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberTag" ADD CONSTRAINT "MemberTag_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
