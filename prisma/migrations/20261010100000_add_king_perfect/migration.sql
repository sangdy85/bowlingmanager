-- CreateTable
CREATE TABLE "KingPerfectEdition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "practiceAt" DATETIME NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUALIFYING_OPEN',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "rules" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "settlement" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KingPerfectEdition_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KingPerfectEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handicap" INTEGER NOT NULL,
    "eligibility" TEXT NOT NULL DEFAULT 'PENDING',
    "athlete" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "KingPerfectEntry_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "KingPerfectEdition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KingPerfectEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CenterMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KingPerfectAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "raw" INTEGER NOT NULL,
    "handicap" INTEGER NOT NULL,
    "converted" INTEGER NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KingPerfectAttempt_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KingPerfectEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KingPerfectSeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "attemptId" TEXT NOT NULL,
    "raw" INTEGER NOT NULL,
    "handicap" INTEGER NOT NULL,
    "converted" INTEGER NOT NULL,
    CONSTRAINT "KingPerfectSeed_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KingPerfectEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KingPerfectMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "tableIndex" INTEGER NOT NULL,
    "lanes" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "KingPerfectMatch_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "KingPerfectEdition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KingPerfectSeat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "handicap" INTEGER NOT NULL,
    "rawTotal" INTEGER,
    "total" INTEGER,
    "rank" INTEGER,
    CONSTRAINT "KingPerfectSeat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "KingPerfectMatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KingPerfectSeat_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KingPerfectEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KingPerfectGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seatId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "raw" INTEGER,
    "converted" INTEGER,
    CONSTRAINT "KingPerfectGame_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "KingPerfectSeat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KingPerfectFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    CONSTRAINT "KingPerfectFee_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KingPerfectEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KingPerfectAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "before" TEXT NOT NULL,
    "after" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KingPerfectAudit_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "KingPerfectEdition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KingPerfectSideEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    CONSTRAINT "KingPerfectSideEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KingPerfectEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KingPerfectLuckyWin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KingPerfectLuckyWin_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KingPerfectEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectEdition_tournamentId_month_key" ON "KingPerfectEdition"("tournamentId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectEntry_editionId_memberId_key" ON "KingPerfectEntry"("editionId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectAttempt_requestKey_key" ON "KingPerfectAttempt"("requestKey");

-- CreateIndex
CREATE INDEX "KingPerfectAttempt_entryId_createdAt_idx" ON "KingPerfectAttempt"("entryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectSeed_entryId_key" ON "KingPerfectSeed"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectSeed_editionId_position_key" ON "KingPerfectSeed"("editionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectMatch_editionId_stage_slot_key" ON "KingPerfectMatch"("editionId", "stage", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectSeat_matchId_entryId_key" ON "KingPerfectSeat"("matchId", "entryId");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectSeat_matchId_position_key" ON "KingPerfectSeat"("matchId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectGame_seatId_number_key" ON "KingPerfectGame"("seatId", "number");

-- CreateIndex
CREATE INDEX "KingPerfectFee_stage_status_idx" ON "KingPerfectFee"("stage", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectFee_entryId_source_key" ON "KingPerfectFee"("entryId", "source");

-- CreateIndex
CREATE INDEX "KingPerfectAudit_editionId_createdAt_idx" ON "KingPerfectAudit"("editionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectAudit_editionId_requestKey_key" ON "KingPerfectAudit"("editionId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectSideEntry_entryId_stage_category_key" ON "KingPerfectSideEntry"("entryId", "stage", "category");

-- CreateIndex
CREATE UNIQUE INDEX "KingPerfectLuckyWin_entryId_key" ON "KingPerfectLuckyWin"("entryId");
