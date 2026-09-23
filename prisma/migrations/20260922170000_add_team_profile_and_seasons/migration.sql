-- Additive team profile and season-ranking settings.
ALTER TABLE "Team" ADD COLUMN "description" TEXT;
ALTER TABLE "Team" ADD COLUMN "notice" TEXT;
ALTER TABLE "Team" ADD COLUMN "seasonRankingEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TeamSeason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scoringMode" TEXT NOT NULL DEFAULT 'PODIUM',
    "pointsConfig" TEXT NOT NULL DEFAULT '[5,3,1]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamSeason_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamSeason_scoringMode_check" CHECK ("scoringMode" IN ('FULL_RANK', 'PODIUM')),
    CONSTRAINT "TeamSeason_date_check" CHECK ("startDate" <= "endDate")
);

CREATE INDEX "TeamSeason_teamId_enabled_idx" ON "TeamSeason"("teamId", "enabled");
CREATE INDEX "TeamSeason_teamId_startDate_endDate_idx" ON "TeamSeason"("teamId", "startDate", "endDate");
