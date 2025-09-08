-- CreateTable
CREATE TABLE "KioskInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "passphraseHash" TEXT NOT NULL,
    "phraseDisplay" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KioskInvite_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KioskInvite_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KioskInvite_organisationId_stationId_used_idx" ON "KioskInvite"("organisationId", "stationId", "used");

-- CreateIndex
CREATE INDEX "KioskInvite_expiresAt_idx" ON "KioskInvite"("expiresAt");
