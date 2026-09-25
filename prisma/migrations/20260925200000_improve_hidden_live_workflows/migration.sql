-- AlterTable
ALTER TABLE "TeamEventAttendance" ADD COLUMN "manualGroup" TEXT
    CHECK ("manualGroup" IS NULL OR "manualGroup" IN ('A', 'B', 'C', 'D', 'E'));

-- AlterTable
ALTER TABLE "TeamEventGuest" ADD COLUMN "manualGroup" TEXT
    CHECK ("manualGroup" IS NULL OR "manualGroup" IN ('A', 'B', 'C', 'D', 'E'));

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventCompetitionBallot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "voterParticipantId" TEXT NOT NULL,
    "enteredByUserId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventCompetitionBallot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventCompetitionBallot_voterParticipantId_fkey" FOREIGN KEY ("voterParticipantId") REFERENCES "EventCompetitionParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventCompetitionBallot_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EventCompetitionBallot" ("eventId", "id", "submittedAt", "updatedAt", "voterParticipantId") SELECT "eventId", "id", "submittedAt", "updatedAt", "voterParticipantId" FROM "EventCompetitionBallot";
DROP TABLE "EventCompetitionBallot";
ALTER TABLE "new_EventCompetitionBallot" RENAME TO "EventCompetitionBallot";
CREATE UNIQUE INDEX "EventCompetitionBallot_voterParticipantId_key" ON "EventCompetitionBallot"("voterParticipantId");
CREATE INDEX "EventCompetitionBallot_eventId_idx" ON "EventCompetitionBallot"("eventId");
CREATE INDEX "EventCompetitionBallot_enteredByUserId_idx" ON "EventCompetitionBallot"("enteredByUserId");
CREATE TABLE "new_EventCompetitionParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT,
    "guestId" TEXT,
    "revealOrder" INTEGER NOT NULL,
    "revealedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventCompetitionParticipant_identity_check" CHECK (("memberId" IS NOT NULL AND "guestId" IS NULL) OR ("memberId" IS NULL AND "guestId" IS NOT NULL)),
    CONSTRAINT "EventCompetitionParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventCompetitionParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventCompetitionParticipant_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "TeamEventGuest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EventCompetitionParticipant" ("createdAt", "eventId", "id", "memberId", "revealOrder", "revealedAt") SELECT "createdAt", "eventId", "id", "memberId", "revealOrder", "revealedAt" FROM "EventCompetitionParticipant";
DROP TABLE "EventCompetitionParticipant";
ALTER TABLE "new_EventCompetitionParticipant" RENAME TO "EventCompetitionParticipant";
CREATE INDEX "EventCompetitionParticipant_memberId_idx" ON "EventCompetitionParticipant"("memberId");
CREATE INDEX "EventCompetitionParticipant_guestId_idx" ON "EventCompetitionParticipant"("guestId");
CREATE UNIQUE INDEX "EventCompetitionParticipant_eventId_memberId_key" ON "EventCompetitionParticipant"("eventId", "memberId");
CREATE UNIQUE INDEX "EventCompetitionParticipant_eventId_guestId_key" ON "EventCompetitionParticipant"("eventId", "guestId");
CREATE UNIQUE INDEX "EventCompetitionParticipant_eventId_revealOrder_key" ON "EventCompetitionParticipant"("eventId", "revealOrder");
CREATE TABLE "new_Score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "score" INTEGER NOT NULL,
    "gameDate" DATETIME NOT NULL,
    "gameType" TEXT,
    "userId" TEXT,
    "teamId" TEXT,
    "memo" TEXT,
    "guestName" TEXT,
    "competitionMode" TEXT,
    "teamEventId" TEXT,
    "teamEventGuestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Score_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Score_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Score_teamEventId_fkey" FOREIGN KEY ("teamEventId") REFERENCES "TeamEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Score_teamEventGuestId_fkey" FOREIGN KEY ("teamEventGuestId") REFERENCES "TeamEventGuest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Score" ("competitionMode", "createdAt", "gameDate", "gameType", "guestName", "id", "memo", "score", "teamEventId", "teamId", "userId") SELECT "competitionMode", "createdAt", "gameDate", "gameType", "guestName", "id", "memo", "score", "teamEventId", "teamId", "userId" FROM "Score";
DROP TABLE "Score";
ALTER TABLE "new_Score" RENAME TO "Score";
CREATE INDEX "Score_teamEventId_idx" ON "Score"("teamEventId");
CREATE INDEX "Score_teamEventGuestId_idx" ON "Score"("teamEventGuestId");
CREATE INDEX "Score_competitionMode_idx" ON "Score"("competitionMode");
CREATE TABLE "new_TeamCompetitionDraftPick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "pickNumber" INTEGER NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "captainMemberId" TEXT,
    "competitionTeamId" TEXT NOT NULL,
    "selectedParticipantId" TEXT,
    "selectedDisplayNameSnapshot" TEXT NOT NULL,
    "pickType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamCompetitionDraftPick_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionDraftPick_captainMemberId_fkey" FOREIGN KEY ("captainMemberId") REFERENCES "TeamMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionDraftPick_competitionTeamId_fkey" FOREIGN KEY ("competitionTeamId") REFERENCES "TeamCompetitionTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionDraftPick_selectedParticipantId_fkey" FOREIGN KEY ("selectedParticipantId") REFERENCES "TeamCompetitionParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamCompetitionDraftPick" ("captainMemberId", "competitionTeamId", "createdAt", "direction", "eventId", "generation", "id", "pickNumber", "pickType", "roundNumber", "selectedDisplayNameSnapshot", "selectedParticipantId") SELECT "captainMemberId", "competitionTeamId", "createdAt", "direction", "eventId", "generation", "id", "pickNumber", "pickType", "roundNumber", "selectedDisplayNameSnapshot", "selectedParticipantId" FROM "TeamCompetitionDraftPick";
DROP TABLE "TeamCompetitionDraftPick";
ALTER TABLE "new_TeamCompetitionDraftPick" RENAME TO "TeamCompetitionDraftPick";
CREATE INDEX "TeamCompetitionDraftPick_eventId_generation_createdAt_idx" ON "TeamCompetitionDraftPick"("eventId", "generation", "createdAt");
CREATE UNIQUE INDEX "TeamCompetitionDraftPick_eventId_generation_pickNumber_key" ON "TeamCompetitionDraftPick"("eventId", "generation", "pickNumber");
CREATE TABLE "new_TeamCompetitionParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "memberId" TEXT,
    "guestId" TEXT,
    "competitionTeamId" TEXT,
    "assignmentType" TEXT,
    "assignmentOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamCompetitionParticipant_identity_check" CHECK (("memberId" IS NOT NULL AND "guestId" IS NULL) OR ("memberId" IS NULL AND "guestId" IS NOT NULL)),
    CONSTRAINT "TeamCompetitionParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionParticipant_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "TeamEventGuest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionParticipant_competitionTeamId_fkey" FOREIGN KEY ("competitionTeamId") REFERENCES "TeamCompetitionTeam" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TeamCompetitionParticipant" ("assignmentOrder", "assignmentType", "competitionTeamId", "createdAt", "eventId", "generation", "id", "memberId") SELECT "assignmentOrder", "assignmentType", "competitionTeamId", "createdAt", "eventId", "generation", "id", "memberId" FROM "TeamCompetitionParticipant";
DROP TABLE "TeamCompetitionParticipant";
ALTER TABLE "new_TeamCompetitionParticipant" RENAME TO "TeamCompetitionParticipant";
CREATE INDEX "TeamCompetitionParticipant_competitionTeamId_idx" ON "TeamCompetitionParticipant"("competitionTeamId");
CREATE INDEX "TeamCompetitionParticipant_guestId_idx" ON "TeamCompetitionParticipant"("guestId");
CREATE UNIQUE INDEX "TeamCompetitionParticipant_eventId_generation_memberId_key" ON "TeamCompetitionParticipant"("eventId", "generation", "memberId");
CREATE UNIQUE INDEX "TeamCompetitionParticipant_eventId_generation_guestId_key" ON "TeamCompetitionParticipant"("eventId", "generation", "guestId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
