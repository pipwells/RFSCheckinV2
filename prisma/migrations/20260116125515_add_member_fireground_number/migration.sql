/*
  Warnings:

  - A unique constraint covering the columns `[organisationId,firegroundNumber]` on the table `Member` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organisationId,mobileNormalized]` on the table `Member` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `firegroundNumber` to the `Member` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Member_organisationId_mobileNormalized_idx";

-- AlterTable
ALTER TABLE "public"."Member" ADD COLUMN     "firegroundNumber" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Member_organisationId_firegroundNumber_key" ON "public"."Member"("organisationId", "firegroundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Member_organisationId_mobileNormalized_key" ON "public"."Member"("organisationId", "mobileNormalized");
