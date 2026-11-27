ALTER TABLE "TeamEvent" ADD COLUMN "competitionMode" TEXT;
ALTER TABLE "SeasonFinalTournament" ADD COLUMN "competitionMode" TEXT NOT NULL DEFAULT 'OFFICIAL';
ALTER TABLE "Score" ADD COLUMN "competitionMode" TEXT;
ALTER TABLE "Score" ADD COLUMN "teamEventId" TEXT REFERENCES "TeamEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Score_teamEventId_idx" ON "Score"("teamEventId");
CREATE INDEX "Score_competitionMode_idx" ON "Score"("competitionMode");

-- Only competitions with an existing season publication are provably official.
UPDATE "TeamEvent"
SET "competitionMode" = 'OFFICIAL'
WHERE "competitionEnabled" = 1
  AND EXISTS (
    SELECT 1 FROM "SeasonPointPublication"
    WHERE "SeasonPointPublication"."eventId" = "TeamEvent"."id"
  );
