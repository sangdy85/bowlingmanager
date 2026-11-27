-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN "blindAt" DATETIME;
ALTER TABLE "TeamMember" ADD COLUMN "blindByUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SeasonRankingSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "savedByUserId" TEXT NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonRankingSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonRankingSnapshot_savedByUserId_fkey" FOREIGN KEY ("savedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeasonRankingSnapshotEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rankingId" TEXT NOT NULL,
    "participantType" TEXT NOT NULL CHECK ("participantType" IN ('MEMBER', 'MANUAL')),
    "memberId" TEXT,
    "displayName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL CHECK ("rank" >= 1),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonRankingSnapshotEntry_rankingId_fkey" FOREIGN KEY ("rankingId") REFERENCES "SeasonRankingSnapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonRankingSnapshotEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeasonFinalRankingParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "finalRankingId" TEXT NOT NULL,
    "participantType" TEXT NOT NULL CHECK ("participantType" IN ('MEMBER', 'MANUAL')),
    "memberId" TEXT,
    "displayName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL CHECK ("rank" >= 1),
    "totalPoints" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonFinalRankingParticipant_finalRankingId_fkey" FOREIGN KEY ("finalRankingId") REFERENCES "SeasonFinalRanking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalRankingParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TeamMember_teamId_blindAt_idx" ON "TeamMember"("teamId", "blindAt");
CREATE INDEX "TeamMember_blindByUserId_idx" ON "TeamMember"("blindByUserId");
CREATE UNIQUE INDEX "SeasonRankingSnapshot_seasonId_revision_key" ON "SeasonRankingSnapshot"("seasonId", "revision");
CREATE INDEX "SeasonRankingSnapshot_seasonId_savedAt_idx" ON "SeasonRankingSnapshot"("seasonId", "savedAt");
CREATE INDEX "SeasonRankingSnapshot_savedByUserId_idx" ON "SeasonRankingSnapshot"("savedByUserId");
CREATE UNIQUE INDEX "SeasonRankingSnapshotEntry_rankingId_rank_key" ON "SeasonRankingSnapshotEntry"("rankingId", "rank");
CREATE UNIQUE INDEX "SeasonRankingSnapshotEntry_rankingId_memberId_key" ON "SeasonRankingSnapshotEntry"("rankingId", "memberId");
CREATE INDEX "SeasonRankingSnapshotEntry_memberId_idx" ON "SeasonRankingSnapshotEntry"("memberId");
CREATE UNIQUE INDEX "SeasonFinalRankingParticipant_finalRankingId_rank_key" ON "SeasonFinalRankingParticipant"("finalRankingId", "rank");
CREATE UNIQUE INDEX "SeasonFinalRankingParticipant_finalRankingId_memberId_key" ON "SeasonFinalRankingParticipant"("finalRankingId", "memberId");
CREATE INDEX "SeasonFinalRankingParticipant_memberId_idx" ON "SeasonFinalRankingParticipant"("memberId");
