-- Additive unified Bowler Hidden season ranking and auditable point ledger.
ALTER TABLE "TeamSeason" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "TeamSeason" ADD COLUMN "individualPointsConfig" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "TeamSeason" ADD COLUMN "teamPointsConfig" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "TeamSeason" ADD COLUMN "eventPointsConfig" TEXT NOT NULL DEFAULT '{}';

-- Preserve the existing active/inactive season meaning and point configuration.
UPDATE "TeamSeason"
SET "status" = CASE WHEN "enabled" = 1 THEN 'ACTIVE' ELSE 'COMPLETED' END,
    "individualPointsConfig" = "pointsConfig",
    "teamPointsConfig" = "pointsConfig",
    "eventPointsConfig" = "pointsConfig";

ALTER TABLE "TeamEvent" ADD COLUMN "seasonId" TEXT REFERENCES "TeamSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamEvent" ADD COLUMN "seasonPublicationRevision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "SeasonPointPublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "eventId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "competitionType" TEXT NOT NULL,
    "competitionDate" DATETIME NOT NULL,
    "competitionTitle" TEXT NOT NULL,
    "pointTableSnapshot" TEXT NOT NULL,
    "resultSnapshot" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "SeasonPointPublication_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonPointPublication_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SeasonPointPublication_values_check" CHECK ("revision" >= 1 AND "competitionType" IN ('INDIVIDUAL','TEAM','EVENT'))
);

CREATE TABLE "SeasonPointEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "eventId" TEXT,
    "memberId" TEXT NOT NULL,
    "memberDisplayName" TEXT NOT NULL,
    "competitionTeamId" TEXT,
    "competitionType" TEXT NOT NULL,
    "competitionDate" DATETIME NOT NULL,
    "competitionTitle" TEXT NOT NULL,
    "finalRank" INTEGER,
    "points" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonPointEntry_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "SeasonPointPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonPointEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonPointEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SeasonPointEntry_values_check" CHECK ("points" >= 0 AND ("finalRank" IS NULL OR "finalRank" >= 1) AND "competitionType" IN ('INDIVIDUAL','TEAM','EVENT'))
);

CREATE UNIQUE INDEX "SeasonPointPublication_season_source_revision_key" ON "SeasonPointPublication"("seasonId", "sourceKey", "revision");
CREATE UNIQUE INDEX "SeasonPointPublication_active_source_key" ON "SeasonPointPublication"("seasonId", "sourceKey") WHERE "revokedAt" IS NULL;
CREATE INDEX "SeasonPointPublication_season_active_date_idx" ON "SeasonPointPublication"("seasonId", "revokedAt", "competitionDate");
CREATE INDEX "SeasonPointPublication_event_active_idx" ON "SeasonPointPublication"("eventId", "revokedAt");
CREATE UNIQUE INDEX "SeasonPointEntry_publication_member_key" ON "SeasonPointEntry"("publicationId", "memberId");
CREATE INDEX "SeasonPointEntry_season_type_date_idx" ON "SeasonPointEntry"("seasonId", "competitionType", "competitionDate");
CREATE INDEX "SeasonPointEntry_season_member_date_idx" ON "SeasonPointEntry"("seasonId", "memberId", "competitionDate");
CREATE INDEX "SeasonPointEntry_event_idx" ON "SeasonPointEntry"("eventId");
CREATE INDEX "TeamSeason_team_status_idx" ON "TeamSeason"("teamId", "status");
CREATE INDEX "TeamEvent_season_date_idx" ON "TeamEvent"("seasonId", "eventDate");
