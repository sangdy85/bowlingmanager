-- Additive only: keep existing Team rows, indexes and constraints.
ALTER TABLE "Team" ADD COLUMN "missionsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TeamMission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamMission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMission_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemberMissionProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "allCoverCount" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemberMissionProgress_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberMissionProgress_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberMissionProgress_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TeamMission_teamId_seasonId_memberId_idx" ON "TeamMission"("teamId", "seasonId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMission_seasonId_memberId_kind_threshold_key" ON "TeamMission"("seasonId", "memberId", "kind", "threshold");

-- CreateIndex
CREATE INDEX "MemberMissionProgress_teamId_seasonId_memberId_idx" ON "MemberMissionProgress"("teamId", "seasonId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberMissionProgress_seasonId_memberId_key" ON "MemberMissionProgress"("seasonId", "memberId");
