-- Backwards compatible: old teams retain draftOrder; new columns remain NULL.
ALTER TABLE "TeamCompetitionTeam" ADD COLUMN "captainSelectionOrder" INTEGER;
ALTER TABLE "TeamCompetitionTeam" ADD COLUMN "selectedDraftOrder" INTEGER;
CREATE UNIQUE INDEX "TeamCompetitionTeam_eventId_generation_captainSelectionOrder_key"
    ON "TeamCompetitionTeam"("eventId", "generation", "captainSelectionOrder");
CREATE UNIQUE INDEX "TeamCompetitionTeam_eventId_generation_selectedDraftOrder_key"
    ON "TeamCompetitionTeam"("eventId", "generation", "selectedDraftOrder");
