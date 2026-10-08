-- CreateTable
CREATE TABLE "BandConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "connectedByUserId" TEXT NOT NULL,
    "bandUserKey" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" DATETIME,
    "bandKey" TEXT,
    "bandName" TEXT,
    "bandCoverUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "doPush" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BandConnection_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "BowlingCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BandConnection_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BandPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "roundId" TEXT,
    "type" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "dedupeKey" TEXT NOT NULL,
    "bandKey" TEXT NOT NULL,
    "postKey" TEXT,
    "contentSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "requestedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" DATETIME,
    CONSTRAINT "BandPost_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "BowlingCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BandPost_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BandPost_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "LeagueRound" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BandPost_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BandConnection_centerId_key" ON "BandConnection"("centerId");

-- CreateIndex
CREATE INDEX "BandConnection_connectedByUserId_idx" ON "BandConnection"("connectedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "BandPost_dedupeKey_key" ON "BandPost"("dedupeKey");

-- CreateIndex
CREATE INDEX "BandPost_centerId_createdAt_idx" ON "BandPost"("centerId", "createdAt");

-- CreateIndex
CREATE INDEX "BandPost_tournamentId_type_idx" ON "BandPost"("tournamentId", "type");

-- CreateIndex
CREATE INDEX "BandPost_roundId_type_idx" ON "BandPost"("roundId", "type");
