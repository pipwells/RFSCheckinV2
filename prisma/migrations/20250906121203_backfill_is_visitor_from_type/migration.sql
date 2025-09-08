/*
  Warnings:

  - You are about to drop the column `email` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `pinHash` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Member` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "mobile" TEXT,
    "mobileNormalized" TEXT,
    "isVisitor" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("createdAt", "firstName", "id", "isVisitor", "lastName", "mobile", "organisationId", "status", "updatedAt") SELECT "createdAt", "firstName", "id", "isVisitor", "lastName", "mobile", "organisationId", "status", "updatedAt" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE INDEX "Member_organisationId_mobileNormalized_idx" ON "Member"("organisationId", "mobileNormalized");
CREATE INDEX "Member_organisationId_isVisitor_idx" ON "Member"("organisationId", "isVisitor");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
