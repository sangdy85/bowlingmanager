ALTER TABLE "TeamSeason" ADD COLUMN "rankingMode" TEXT NOT NULL DEFAULT 'DATA'
    CHECK ("rankingMode" IN ('DATA', 'IMAGE'));

CREATE TABLE "SeasonManualCompetition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "competitionType" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CHECK (length(trim("name")) BETWEEN 1 AND 100),
    CHECK ("competitionType" IN ('INDIVIDUAL', 'TEAM', 'EVENT')),
    CONSTRAINT "SeasonManualCompetition_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonManualCompetition_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SeasonManualCompetitionResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "memberDisplayName" TEXT NOT NULL,
    "finalRank" INTEGER,
    "points" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ("finalRank" IS NULL OR "finalRank" BETWEEN 1 AND 1000),
    CHECK ("points" BETWEEN 0 AND 100000),
    CONSTRAINT "SeasonManualCompetitionResult_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "SeasonManualCompetition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonManualCompetitionResult_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SeasonManualCompetitionRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitionId" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "revisedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonManualCompetitionRevision_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "SeasonManualCompetition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonManualCompetitionRevision_revisedByUserId_fkey" FOREIGN KEY ("revisedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SeasonRankingImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ("size" BETWEEN 1 AND 5242880),
    CHECK ("displayOrder" >= 0),
    CONSTRAINT "SeasonRankingImage_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonRankingImage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "SeasonManualCompetition_seasonId_eventDate_idx" ON "SeasonManualCompetition"("seasonId", "eventDate");
CREATE INDEX "SeasonManualCompetition_createdByUserId_createdAt_idx" ON "SeasonManualCompetition"("createdByUserId", "createdAt");
CREATE UNIQUE INDEX "SeasonManualCompetition_seasonId_eventDate_competitionType_name_key" ON "SeasonManualCompetition"("seasonId", "eventDate", "competitionType", "name");
CREATE UNIQUE INDEX "SeasonManualCompetitionResult_competitionId_memberId_key" ON "SeasonManualCompetitionResult"("competitionId", "memberId");
CREATE INDEX "SeasonManualCompetitionResult_memberId_createdAt_idx" ON "SeasonManualCompetitionResult"("memberId", "createdAt");
CREATE INDEX "SeasonManualCompetitionRevision_competitionId_createdAt_idx" ON "SeasonManualCompetitionRevision"("competitionId", "createdAt");
CREATE INDEX "SeasonManualCompetitionRevision_revisedByUserId_createdAt_idx" ON "SeasonManualCompetitionRevision"("revisedByUserId", "createdAt");
CREATE UNIQUE INDEX "SeasonRankingImage_seasonId_displayOrder_key" ON "SeasonRankingImage"("seasonId", "displayOrder");
CREATE INDEX "SeasonRankingImage_createdByUserId_createdAt_idx" ON "SeasonRankingImage"("createdByUserId", "createdAt");
