CREATE TABLE "BandConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bandUserKey" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "scope" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BandConnection_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BandConnection_userId_key"
ON "BandConnection"("userId");

CREATE INDEX "BandConnection_bandUserKey_idx"
ON "BandConnection"("bandUserKey");

CREATE TABLE "BandShareLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bandKey" TEXT NOT NULL,
    "bandName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceTournamentId" TEXT,
    "sourceRoundNumber" INTEGER,
    "content" TEXT NOT NULL,
    "postKey" TEXT,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryOfId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BandShareLog_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BandShareLog_userId_createdAt_idx"
ON "BandShareLog"("userId", "createdAt");

CREATE INDEX "BandShareLog_sourceType_sourceTournamentId_sourceRoundNumber_idx"
ON "BandShareLog"("sourceType", "sourceTournamentId", "sourceRoundNumber");

CREATE INDEX "BandShareLog_retryOfId_idx"
ON "BandShareLog"("retryOfId");
