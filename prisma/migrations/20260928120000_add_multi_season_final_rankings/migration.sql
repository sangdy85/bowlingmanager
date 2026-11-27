-- CreateTable
CREATE TABLE "SeasonFinalRanking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "rankingMode" TEXT NOT NULL CHECK ("rankingMode" IN ('DATA', 'IMAGE')),
    "finalizedByUserId" TEXT NOT NULL,
    "finalizedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonFinalRanking_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalRanking_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeasonFinalRankingEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "finalRankingId" TEXT NOT NULL,
    "memberId" TEXT,
    "displayName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL CHECK ("rank" >= 1),
    "totalPoints" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonFinalRankingEntry_finalRankingId_fkey" FOREIGN KEY ("finalRankingId") REFERENCES "SeasonFinalRanking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalRankingEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonFinalRanking_seasonId_revision_key" ON "SeasonFinalRanking"("seasonId", "revision");

-- CreateIndex
CREATE INDEX "SeasonFinalRanking_seasonId_finalizedAt_idx" ON "SeasonFinalRanking"("seasonId", "finalizedAt");

-- CreateIndex
CREATE INDEX "SeasonFinalRanking_finalizedByUserId_idx" ON "SeasonFinalRanking"("finalizedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonFinalRankingEntry_finalRankingId_rank_key" ON "SeasonFinalRankingEntry"("finalRankingId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonFinalRankingEntry_finalRankingId_memberId_key" ON "SeasonFinalRankingEntry"("finalRankingId", "memberId");

-- CreateIndex
CREATE INDEX "SeasonFinalRankingEntry_memberId_idx" ON "SeasonFinalRankingEntry"("memberId");
