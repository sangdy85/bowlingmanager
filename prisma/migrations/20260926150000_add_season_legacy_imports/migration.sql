CREATE TABLE "SeasonLegacyImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "importHash" TEXT NOT NULL,
    "note" TEXT,
    "enteredByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" DATETIME,
    "reversedByUserId" TEXT,
    "reversalReason" TEXT,
    CONSTRAINT "SeasonLegacyImportBatch_mode_check" CHECK ("mode" IN ('DETAILED', 'OPENING_BALANCE')),
    CONSTRAINT "SeasonLegacyImportBatch_note_check" CHECK ("note" IS NULL OR length(trim("note")) BETWEEN 1 AND 500),
    CONSTRAINT "SeasonLegacyImportBatch_reversal_check" CHECK (
        ("reversedAt" IS NULL AND "reversedByUserId" IS NULL AND "reversalReason" IS NULL) OR
        ("reversedAt" IS NOT NULL AND "reversedByUserId" IS NOT NULL AND length(trim("reversalReason")) BETWEEN 1 AND 500)
    ),
    CONSTRAINT "SeasonLegacyImportBatch_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonLegacyImportBatch_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SeasonLegacyImportBatch_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SeasonLegacyImportBatch_seasonId_importHash_key"
ON "SeasonLegacyImportBatch"("seasonId", "importHash");

CREATE INDEX "SeasonLegacyImportBatch_seasonId_reversedAt_createdAt_idx"
ON "SeasonLegacyImportBatch"("seasonId", "reversedAt", "createdAt");

CREATE INDEX "SeasonLegacyImportBatch_enteredByUserId_createdAt_idx"
ON "SeasonLegacyImportBatch"("enteredByUserId", "createdAt");

CREATE TABLE "SeasonLegacyPointEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "eventDate" DATETIME,
    "competitionType" TEXT,
    "placement" INTEGER,
    "points" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonLegacyPointEntry_shape_check" CHECK (
        ("eventDate" IS NOT NULL AND "competitionType" IN ('INDIVIDUAL', 'TEAM', 'EVENT') AND "placement" >= 1) OR
        ("eventDate" IS NULL AND "competitionType" IS NULL AND "placement" IS NULL)
    ),
    CONSTRAINT "SeasonLegacyPointEntry_points_check" CHECK ("points" > 0 AND "points" <= 100000),
    CONSTRAINT "SeasonLegacyPointEntry_note_check" CHECK ("note" IS NULL OR length(trim("note")) BETWEEN 1 AND 500),
    CONSTRAINT "SeasonLegacyPointEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SeasonLegacyImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SeasonLegacyPointEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonLegacyPointEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "SeasonLegacyPointEntry_seasonId_memberId_eventDate_idx"
ON "SeasonLegacyPointEntry"("seasonId", "memberId", "eventDate");

CREATE INDEX "SeasonLegacyPointEntry_batchId_memberId_idx"
ON "SeasonLegacyPointEntry"("batchId", "memberId");
