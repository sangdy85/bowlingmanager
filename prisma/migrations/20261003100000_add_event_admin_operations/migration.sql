ALTER TABLE "TeamEvent" ADD COLUMN "eventVotingDeadlineAt" DATETIME;

CREATE TABLE "TeamEventAdminAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT,
    "eventSnapshotId" TEXT NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "competitionType" TEXT,
    "beforeStatus" TEXT,
    "afterStatus" TEXT,
    "detailsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamEventAdminAudit_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamEventAdminAudit_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamEventAdminAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamEventAdminAudit_action_check" CHECK ("action" IN (
        'REOPEN_ATTENDANCE',
        'CLEAR_INDIVIDUAL_GROUPS',
        'RESET_TEAM_DRAFT',
        'RESET_LANES',
        'ADMIN_LANE_OVERRIDE',
        'ADMIN_TEAM_OVERRIDE',
        'RESET_EVENT_PARTICIPANTS',
        'RESET_EVENT_VOTING',
        'RESET_EVENT_BALLOT',
        'REOPEN_PUBLICATION',
        'CHANGE_GAME_COUNT',
        'CLEAR_SCORES',
        'REVOKE_PUBLICATION',
        'DELETE_EVENT'
    ))
);

CREATE INDEX "TeamEventAdminAudit_teamId_createdAt_idx" ON "TeamEventAdminAudit"("teamId", "createdAt");
CREATE INDEX "TeamEventAdminAudit_eventSnapshotId_createdAt_idx" ON "TeamEventAdminAudit"("eventSnapshotId", "createdAt");
CREATE INDEX "TeamEventAdminAudit_actorUserId_createdAt_idx" ON "TeamEventAdminAudit"("actorUserId", "createdAt");
