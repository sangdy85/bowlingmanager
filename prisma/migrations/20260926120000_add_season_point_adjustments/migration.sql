CREATE TABLE "SeasonPointAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "enteredByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonPointAdjustment_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "TeamSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonPointAdjustment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SeasonPointAdjustment_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SeasonPointAdjustment_delta_check" CHECK ("delta" <> 0),
    CONSTRAINT "SeasonPointAdjustment_reason_check" CHECK (length(trim("reason")) BETWEEN 1 AND 500)
);

CREATE INDEX "SeasonPointAdjustment_seasonId_createdAt_idx"
ON "SeasonPointAdjustment"("seasonId", "createdAt");

CREATE INDEX "SeasonPointAdjustment_seasonId_memberId_createdAt_idx"
ON "SeasonPointAdjustment"("seasonId", "memberId", "createdAt");

CREATE INDEX "SeasonPointAdjustment_enteredByUserId_createdAt_idx"
ON "SeasonPointAdjustment"("enteredByUserId", "createdAt");
