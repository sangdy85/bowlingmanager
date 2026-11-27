-- Bowler Hidden is opt-in. Existing and newly-created teams remain disabled.
ALTER TABLE "Team" ADD COLUMN "bowlerHiddenEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Competition metadata is additive and inert for ordinary events.
ALTER TABLE "TeamEvent" ADD COLUMN "competitionEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TeamEvent" ADD COLUMN "competitionType" TEXT;
ALTER TABLE "TeamEvent" ADD COLUMN "competitionStatus" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "TeamEvent" ADD COLUMN "rankPoints" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "TeamEvent" ADD COLUMN "draftGeneration" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TeamEvent" ADD COLUMN "currentPickNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TeamEvent" ADD COLUMN "competitionStartAt" DATETIME;
ALTER TABLE "TeamEvent" ADD COLUMN "votingDurationMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "TeamEvent" ADD COLUMN "competitionGameCount" INTEGER;
ALTER TABLE "TeamEvent" ADD COLUMN "eventNonVoterPolicy" TEXT;
ALTER TABLE "TeamEvent" ADD COLUMN "eventTieBreakPolicy" TEXT;
ALTER TABLE "TeamEvent" ADD COLUMN "eventRevealIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TeamEvent" ADD COLUMN "eventPublishedAt" DATETIME;
ALTER TABLE "TeamEvent" ADD COLUMN "eventPublishedSnapshot" TEXT;

CREATE TABLE "TeamCompetitionTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "captainMemberId" TEXT NOT NULL,
    "draftOrder" INTEGER NOT NULL,
    "lanePriority" INTEGER,
    "teamHandicap" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamCompetitionTeam_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionTeam_captainMemberId_fkey" FOREIGN KEY ("captainMemberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionTeam_values_check" CHECK ("generation" >= 1 AND "draftOrder" >= 1 AND ("lanePriority" IS NULL OR "lanePriority" >= 1) AND "teamHandicap" >= 0)
);

CREATE TABLE "TeamCompetitionParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "memberId" TEXT NOT NULL,
    "competitionTeamId" TEXT,
    "assignmentType" TEXT,
    "assignmentOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamCompetitionParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionParticipant_competitionTeamId_fkey" FOREIGN KEY ("competitionTeamId") REFERENCES "TeamCompetitionTeam" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionParticipant_values_check" CHECK ("generation" >= 1 AND ("assignmentType" IS NULL OR "assignmentType" IN ('CAPTAIN','DRAFT','RANDOM')))
);

CREATE TABLE "TeamCompetitionDraftPick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "pickNumber" INTEGER NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "captainMemberId" TEXT,
    "competitionTeamId" TEXT NOT NULL,
    "selectedParticipantId" TEXT NOT NULL,
    "selectedDisplayNameSnapshot" TEXT NOT NULL,
    "pickType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamCompetitionDraftPick_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionDraftPick_captainMemberId_fkey" FOREIGN KEY ("captainMemberId") REFERENCES "TeamMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionDraftPick_competitionTeamId_fkey" FOREIGN KEY ("competitionTeamId") REFERENCES "TeamCompetitionTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionDraftPick_selectedParticipantId_fkey" FOREIGN KEY ("selectedParticipantId") REFERENCES "TeamCompetitionParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitionDraftPick_values_check" CHECK ("generation" >= 1 AND "pickNumber" >= 1 AND "roundNumber" >= 0 AND "direction" IN ('FORWARD','REVERSE','AUTOMATIC') AND "pickType" IN ('CAPTAIN_PICK','RANDOM_REMAINDER'))
);

CREATE UNIQUE INDEX "TeamCompetitionTeam_event_generation_order_key" ON "TeamCompetitionTeam"("eventId", "generation", "draftOrder");
CREATE UNIQUE INDEX "TeamCompetitionTeam_event_generation_captain_key" ON "TeamCompetitionTeam"("eventId", "generation", "captainMemberId");
CREATE UNIQUE INDEX "TeamCompetitionTeam_event_generation_lane_key" ON "TeamCompetitionTeam"("eventId", "generation", "lanePriority");
CREATE INDEX "TeamCompetitionTeam_event_generation_idx" ON "TeamCompetitionTeam"("eventId", "generation");
CREATE UNIQUE INDEX "TeamCompetitionParticipant_event_generation_member_key" ON "TeamCompetitionParticipant"("eventId", "generation", "memberId");
CREATE INDEX "TeamCompetitionParticipant_team_idx" ON "TeamCompetitionParticipant"("competitionTeamId");
CREATE UNIQUE INDEX "TeamCompetitionDraftPick_event_generation_pick_key" ON "TeamCompetitionDraftPick"("eventId", "generation", "pickNumber");
CREATE INDEX "TeamCompetitionDraftPick_event_generation_created_idx" ON "TeamCompetitionDraftPick"("eventId", "generation", "createdAt");

CREATE TABLE "EventCompetitionParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "revealOrder" INTEGER NOT NULL,
    "revealedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventCompetitionParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventCompetitionParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventCompetitionParticipant_values_check" CHECK ("revealOrder" >= 1)
);

CREATE TABLE "EventCompetitionBallot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "voterParticipantId" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventCompetitionBallot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventCompetitionBallot_voterParticipantId_fkey" FOREIGN KEY ("voterParticipantId") REFERENCES "EventCompetitionParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "EventCompetitionVotePick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ballotId" TEXT NOT NULL,
    "selectedParticipantId" TEXT NOT NULL,
    "selectionOrder" INTEGER NOT NULL,
    CONSTRAINT "EventCompetitionVotePick_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "EventCompetitionBallot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventCompetitionVotePick_selectedParticipantId_fkey" FOREIGN KEY ("selectedParticipantId") REFERENCES "EventCompetitionParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventCompetitionVotePick_values_check" CHECK ("selectionOrder" BETWEEN 1 AND 3)
);

CREATE UNIQUE INDEX "EventCompetitionParticipant_event_member_key" ON "EventCompetitionParticipant"("eventId", "memberId");
CREATE UNIQUE INDEX "EventCompetitionParticipant_event_reveal_key" ON "EventCompetitionParticipant"("eventId", "revealOrder");
CREATE INDEX "EventCompetitionParticipant_member_idx" ON "EventCompetitionParticipant"("memberId");
CREATE UNIQUE INDEX "EventCompetitionBallot_voter_key" ON "EventCompetitionBallot"("voterParticipantId");
CREATE INDEX "EventCompetitionBallot_event_idx" ON "EventCompetitionBallot"("eventId");
CREATE UNIQUE INDEX "EventCompetitionVotePick_ballot_selected_key" ON "EventCompetitionVotePick"("ballotId", "selectedParticipantId");
CREATE UNIQUE INDEX "EventCompetitionVotePick_ballot_order_key" ON "EventCompetitionVotePick"("ballotId", "selectionOrder");
CREATE INDEX "EventCompetitionVotePick_selected_idx" ON "EventCompetitionVotePick"("selectedParticipantId");
