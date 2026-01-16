/*
  Warnings:

  - You are about to alter the column `firegroundNumber` on the `Member` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Char(8)`.
  - Made the column `mobile` on table `Member` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mobileNormalized` on table `Member` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."Member_organisationId_isVisitor_idx";

-- DropIndex
DROP INDEX "public"."Member_organisationId_mobileNormalized_key";

-- AlterTable
ALTER TABLE "public"."Member" ALTER COLUMN "mobile" SET NOT NULL,
ALTER COLUMN "mobileNormalized" SET NOT NULL,
ALTER COLUMN "firegroundNumber" SET DATA TYPE CHAR(8);

-- CreateIndex
CREATE INDEX "Member_organisationId_firegroundNumber_idx" ON "public"."Member"("organisationId", "firegroundNumber");

-- CreateIndex
CREATE INDEX "Member_organisationId_mobileNormalized_idx" ON "public"."Member"("organisationId", "mobileNormalized");
