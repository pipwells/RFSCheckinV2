/*
  Warnings:

  - A unique constraint covering the columns `[organisationId,code]` on the table `Category` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Category_organisationId_code_idx";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SessionTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "notes" TEXT,
    "categoryCodeSnapshot" TEXT NOT NULL DEFAULT '',
    "categoryNameSnapshot" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "SessionTask_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SessionTask_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SessionTask" ("categoryId", "id", "minutes", "notes", "sessionId") SELECT "categoryId", "id", "minutes", "notes", "sessionId" FROM "SessionTask";
DROP TABLE "SessionTask";
ALTER TABLE "new_SessionTask" RENAME TO "SessionTask";
CREATE INDEX "SessionTask_sessionId_idx" ON "SessionTask"("sessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Category_organisationId_parentId_sort_idx" ON "Category"("organisationId", "parentId", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organisationId_code_key" ON "Category"("organisationId", "code");
