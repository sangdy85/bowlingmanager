-- Additive migration: retain existing finance and attendance constraints/data.
CREATE TABLE "TeamPaymentAccount" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "teamId" TEXT NOT NULL,
 "kind" TEXT NOT NULL CHECK ("kind" IN ('DUES', 'GAME_FEE')),
 "bankName" TEXT NOT NULL,
 "accountNumber" TEXT NOT NULL,
 "holderName" TEXT NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "updatedAt" DATETIME NOT NULL,
 FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeamPaymentAccount_teamId_kind_key" ON "TeamPaymentAccount"("teamId", "kind");
ALTER TABLE "TeamEventAttendance" ADD COLUMN "gameFeeStatus" TEXT NOT NULL DEFAULT 'UNPAID'
 CHECK ("gameFeeStatus" IN ('UNPAID', 'TRANSFER_REQUESTED', 'CASH_REQUESTED', 'TRANSFER_CONFIRMED', 'CASH_CONFIRMED'));
ALTER TABLE "TeamEventAttendance" ADD COLUMN "gameFeeRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TeamEventAttendance" ADD COLUMN "gameFeeRequestedAt" DATETIME;
ALTER TABLE "TeamEventAttendance" ADD COLUMN "gameFeeConfirmedAt" DATETIME;
ALTER TABLE "TeamEventAttendance" ADD COLUMN "gameFeeConfirmedBy" TEXT;
ALTER TABLE "TeamEventAttendance" ADD COLUMN "gameFeeAccountJson" TEXT;

-- Payment audit history survives event/attendance deletion. Existing admin audit checks stay intact.
CREATE TABLE "TeamGameFeeAudit" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "teamId" TEXT NOT NULL,
 "attendanceId" TEXT,
 "eventSnapshotId" TEXT NOT NULL,
 "eventTitle" TEXT NOT NULL,
 "memberId" TEXT NOT NULL,
 "memberName" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "action" TEXT NOT NULL CHECK ("action" IN ('REQUEST_TRANSFER', 'REQUEST_CASH', 'CANCEL_REQUEST', 'CONFIRM_TRANSFER', 'CONFIRM_CASH')),
 "previousStatus" TEXT NOT NULL,
 "nextStatus" TEXT NOT NULL,
 "revision" INTEGER NOT NULL,
 "accountJson" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("attendanceId") REFERENCES "TeamEventAttendance"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeamGameFeeAudit_attendanceId_revision_key" ON "TeamGameFeeAudit"("attendanceId", "revision");
CREATE INDEX "TeamGameFeeAudit_teamId_eventSnapshotId_createdAt_idx" ON "TeamGameFeeAudit"("teamId", "eventSnapshotId", "createdAt");
