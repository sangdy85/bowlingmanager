-- RedefineIndex
DROP INDEX "EventCompetitionBallot_event_idx";
CREATE INDEX "EventCompetitionBallot_eventId_idx" ON "EventCompetitionBallot"("eventId");

-- RedefineIndex
DROP INDEX "EventCompetitionBallot_voter_key";
CREATE UNIQUE INDEX "EventCompetitionBallot_voterParticipantId_key" ON "EventCompetitionBallot"("voterParticipantId");

-- RedefineIndex
DROP INDEX "EventCompetitionParticipant_member_idx";
CREATE INDEX "EventCompetitionParticipant_memberId_idx" ON "EventCompetitionParticipant"("memberId");

-- RedefineIndex
DROP INDEX "EventCompetitionParticipant_event_reveal_key";
CREATE UNIQUE INDEX "EventCompetitionParticipant_eventId_revealOrder_key" ON "EventCompetitionParticipant"("eventId", "revealOrder");

-- RedefineIndex
DROP INDEX "EventCompetitionParticipant_event_member_key";
CREATE UNIQUE INDEX "EventCompetitionParticipant_eventId_memberId_key" ON "EventCompetitionParticipant"("eventId", "memberId");

-- RedefineIndex
DROP INDEX "EventCompetitionVotePick_selected_idx";
CREATE INDEX "EventCompetitionVotePick_selectedParticipantId_idx" ON "EventCompetitionVotePick"("selectedParticipantId");

-- RedefineIndex
DROP INDEX "EventCompetitionVotePick_ballot_order_key";
CREATE UNIQUE INDEX "EventCompetitionVotePick_ballotId_selectionOrder_key" ON "EventCompetitionVotePick"("ballotId", "selectionOrder");

-- RedefineIndex
DROP INDEX "EventCompetitionVotePick_ballot_selected_key";
CREATE UNIQUE INDEX "EventCompetitionVotePick_ballotId_selectedParticipantId_key" ON "EventCompetitionVotePick"("ballotId", "selectedParticipantId");

-- RedefineIndex
DROP INDEX "SeasonPointEntry_event_idx";
CREATE INDEX "SeasonPointEntry_eventId_idx" ON "SeasonPointEntry"("eventId");

-- RedefineIndex
DROP INDEX "SeasonPointEntry_season_member_date_idx";
CREATE INDEX "SeasonPointEntry_seasonId_memberId_competitionDate_idx" ON "SeasonPointEntry"("seasonId", "memberId", "competitionDate");

-- RedefineIndex
DROP INDEX "SeasonPointEntry_season_type_date_idx";
CREATE INDEX "SeasonPointEntry_seasonId_competitionType_competitionDate_idx" ON "SeasonPointEntry"("seasonId", "competitionType", "competitionDate");

-- RedefineIndex
DROP INDEX "SeasonPointEntry_publication_member_key";
CREATE UNIQUE INDEX "SeasonPointEntry_publicationId_memberId_key" ON "SeasonPointEntry"("publicationId", "memberId");

-- RedefineIndex
DROP INDEX "SeasonPointPublication_event_active_idx";
CREATE INDEX "SeasonPointPublication_eventId_revokedAt_idx" ON "SeasonPointPublication"("eventId", "revokedAt");

-- RedefineIndex
DROP INDEX "SeasonPointPublication_season_active_date_idx";
CREATE INDEX "SeasonPointPublication_seasonId_revokedAt_competitionDate_idx" ON "SeasonPointPublication"("seasonId", "revokedAt", "competitionDate");

-- RedefineIndex
DROP INDEX "SeasonPointPublication_season_source_revision_key";
CREATE UNIQUE INDEX "SeasonPointPublication_seasonId_sourceKey_revision_key" ON "SeasonPointPublication"("seasonId", "sourceKey", "revision");

-- RedefineIndex
DROP INDEX "TeamCompetitionDraftPick_event_generation_created_idx";
CREATE INDEX "TeamCompetitionDraftPick_eventId_generation_createdAt_idx" ON "TeamCompetitionDraftPick"("eventId", "generation", "createdAt");

-- RedefineIndex
DROP INDEX "TeamCompetitionDraftPick_event_generation_pick_key";
CREATE UNIQUE INDEX "TeamCompetitionDraftPick_eventId_generation_pickNumber_key" ON "TeamCompetitionDraftPick"("eventId", "generation", "pickNumber");

-- RedefineIndex
DROP INDEX "TeamCompetitionParticipant_team_idx";
CREATE INDEX "TeamCompetitionParticipant_competitionTeamId_idx" ON "TeamCompetitionParticipant"("competitionTeamId");

-- RedefineIndex
DROP INDEX "TeamCompetitionParticipant_event_generation_member_key";
CREATE UNIQUE INDEX "TeamCompetitionParticipant_eventId_generation_memberId_key" ON "TeamCompetitionParticipant"("eventId", "generation", "memberId");

-- RedefineIndex
DROP INDEX "TeamCompetitionTeam_event_generation_idx";
CREATE INDEX "TeamCompetitionTeam_eventId_generation_idx" ON "TeamCompetitionTeam"("eventId", "generation");

-- RedefineIndex
DROP INDEX "TeamCompetitionTeam_event_generation_lane_key";
CREATE UNIQUE INDEX "TeamCompetitionTeam_eventId_generation_lanePriority_key" ON "TeamCompetitionTeam"("eventId", "generation", "lanePriority");

-- RedefineIndex
DROP INDEX "TeamCompetitionTeam_event_generation_captain_key";
CREATE UNIQUE INDEX "TeamCompetitionTeam_eventId_generation_captainMemberId_key" ON "TeamCompetitionTeam"("eventId", "generation", "captainMemberId");

-- RedefineIndex
DROP INDEX "TeamCompetitionTeam_event_generation_order_key";
CREATE UNIQUE INDEX "TeamCompetitionTeam_eventId_generation_draftOrder_key" ON "TeamCompetitionTeam"("eventId", "generation", "draftOrder");

-- RedefineIndex
DROP INDEX "TeamEvent_season_date_idx";
CREATE INDEX "TeamEvent_seasonId_eventDate_idx" ON "TeamEvent"("seasonId", "eventDate");

-- RedefineIndex
DROP INDEX "TeamSeason_team_status_idx";
CREATE INDEX "TeamSeason_teamId_status_idx" ON "TeamSeason"("teamId", "status");
