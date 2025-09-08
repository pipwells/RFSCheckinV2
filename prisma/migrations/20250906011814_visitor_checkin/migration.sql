-- AlterTable
ALTER TABLE "Session" ADD COLUMN "visitorAgency" TEXT;
ALTER TABLE "Session" ADD COLUMN "visitorPurpose" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "type" TEXT NOT NULL DEFAULT 'member',
    "pinHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isVisitor" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Member_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("createdAt", "email", "firstName", "id", "lastName", "mobile", "organisationId", "pinHash", "status", "type", "updatedAt") SELECT "createdAt", "email", "firstName", "id", "lastName", "mobile", "organisationId", "pinHash", "status", "type", "updatedAt" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE INDEX "Member_organisationId_mobile_idx" ON "Member"("organisationId", "mobile");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
