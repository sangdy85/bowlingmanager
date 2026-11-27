CREATE TABLE "SeasonFinalTournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "tiePolicy" TEXT NOT NULL DEFAULT 'SEED_ASC',
    "eligibilityConfig" TEXT NOT NULL DEFAULT '{}',
    "lockedAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeasonFinalTournament_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalTournament_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SeasonFinalTournament_seasonId_key" ON "SeasonFinalTournament"("seasonId");
CREATE INDEX "SeasonFinalTournament_teamId_status_idx" ON "SeasonFinalTournament"("teamId", "status");

CREATE TABLE "SeasonFinalDivision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "SeasonFinalDivision_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "SeasonFinalTournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SeasonFinalDivision_tournamentId_code_key" ON "SeasonFinalDivision"("tournamentId", "code");
CREATE UNIQUE INDEX "SeasonFinalDivision_tournamentId_sortOrder_key" ON "SeasonFinalDivision"("tournamentId", "sortOrder");

CREATE TABLE "SeasonFinalParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "displayNameSnapshot" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "seasonPointsSnapshot" INTEGER NOT NULL,
    "selectionSource" TEXT NOT NULL DEFAULT 'SEASON_RANK',
    "selectionReason" TEXT,
    "finalPlacement" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonFinalParticipant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "SeasonFinalTournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SeasonFinalParticipant_tournamentId_memberId_key" ON "SeasonFinalParticipant"("tournamentId", "memberId");
CREATE UNIQUE INDEX "SeasonFinalParticipant_tournamentId_seed_key" ON "SeasonFinalParticipant"("tournamentId", "seed");
CREATE INDEX "SeasonFinalParticipant_memberId_idx" ON "SeasonFinalParticipant"("memberId");

CREATE TABLE "SeasonFinalNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "divisionId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "gameCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scoringMode" TEXT NOT NULL DEFAULT 'TOTAL_PINS',
    "placementStart" INTEGER,
    "placementEnd" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeasonFinalNode_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "SeasonFinalTournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalNode_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "SeasonFinalDivision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SeasonFinalNode_tournamentId_key_key" ON "SeasonFinalNode"("tournamentId", "key");
CREATE UNIQUE INDEX "SeasonFinalNode_tournamentId_sortOrder_key" ON "SeasonFinalNode"("tournamentId", "sortOrder");
CREATE INDEX "SeasonFinalNode_divisionId_sortOrder_idx" ON "SeasonFinalNode"("divisionId", "sortOrder");

CREATE TABLE "SeasonFinalTransition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "destinationNodeId" TEXT NOT NULL,
    "conditionType" TEXT NOT NULL,
    "rankStart" INTEGER,
    "rankEnd" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "entrySource" TEXT NOT NULL,
    CONSTRAINT "SeasonFinalTransition_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "SeasonFinalTournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalTransition_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "SeasonFinalNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalTransition_destinationNodeId_fkey" FOREIGN KEY ("destinationNodeId") REFERENCES "SeasonFinalNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SeasonFinalTransition_sourceNodeId_sortOrder_key" ON "SeasonFinalTransition"("sourceNodeId", "sortOrder");
CREATE INDEX "SeasonFinalTransition_tournamentId_idx" ON "SeasonFinalTransition"("tournamentId");
CREATE INDEX "SeasonFinalTransition_destinationNodeId_idx" ON "SeasonFinalTransition"("destinationNodeId");

CREATE TABLE "SeasonFinalNodeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceNodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonFinalNodeEntry_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "SeasonFinalNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalNodeEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SeasonFinalParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalNodeEntry_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "SeasonFinalNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SeasonFinalNodeEntry_nodeId_participantId_key" ON "SeasonFinalNodeEntry"("nodeId", "participantId");
CREATE INDEX "SeasonFinalNodeEntry_participantId_idx" ON "SeasonFinalNodeEntry"("participantId");
CREATE INDEX "SeasonFinalNodeEntry_sourceNodeId_idx" ON "SeasonFinalNodeEntry"("sourceNodeId");

CREATE TABLE "SeasonFinalScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeasonFinalScore_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "SeasonFinalNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalScore_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SeasonFinalParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SeasonFinalScore_nodeId_participantId_gameNumber_key" ON "SeasonFinalScore"("nodeId", "participantId", "gameNumber");
CREATE INDEX "SeasonFinalScore_participantId_idx" ON "SeasonFinalScore"("participantId");

CREATE TABLE "SeasonFinalNodeResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "totalPins" INTEGER NOT NULL,
    "average" REAL NOT NULL,
    "rank" INTEGER NOT NULL,
    "confirmedAt" DATETIME NOT NULL,
    CONSTRAINT "SeasonFinalNodeResult_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "SeasonFinalNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonFinalNodeResult_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SeasonFinalParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SeasonFinalNodeResult_nodeId_participantId_key" ON "SeasonFinalNodeResult"("nodeId", "participantId");
CREATE UNIQUE INDEX "SeasonFinalNodeResult_nodeId_rank_key" ON "SeasonFinalNodeResult"("nodeId", "rank");
CREATE INDEX "SeasonFinalNodeResult_participantId_idx" ON "SeasonFinalNodeResult"("participantId");

CREATE TABLE "SeasonFinalTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "structureJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeasonFinalTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SeasonFinalTemplate_teamId_name_key" ON "SeasonFinalTemplate"("teamId", "name");
CREATE INDEX "SeasonFinalTemplate_teamId_createdAt_idx" ON "SeasonFinalTemplate"("teamId", "createdAt");
