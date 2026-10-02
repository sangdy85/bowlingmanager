-- CreateTable
CREATE TABLE "TeamCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "defaultAmount" INTEGER NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "memo" TEXT,
    "createdByUserId" TEXT,
    "createdByDisplayNameSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamCharge_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamCharge_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamCharge_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamCharge_type_check" CHECK ("type" IN ('MONTHLY_DUES', 'EVENT_FEE', 'OTHER')),
    CONSTRAINT "TeamCharge_status_check" CHECK ("status" IN ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED')),
    CONSTRAINT "TeamCharge_amount_check" CHECK ("defaultAmount" BETWEEN 1 AND 10000000),
    CONSTRAINT "TeamCharge_title_check" CHECK (length(trim("title")) BETWEEN 1 AND 80),
    CONSTRAINT "TeamCharge_memo_check" CHECK ("memo" IS NULL OR length("memo") <= 500)
);

-- CreateTable
CREATE TABLE "TeamChargeTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chargeId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "memberId" TEXT,
    "guestId" TEXT,
    "displayNameSnapshot" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paidAt" DATETIME,
    "markedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamChargeTarget_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "TeamCharge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamChargeTarget_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamChargeTarget_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "TeamEventGuest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamChargeTarget_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamChargeTarget_type_check" CHECK ("targetType" IN ('MEMBER', 'GUEST')),
    CONSTRAINT "TeamChargeTarget_payment_status_check" CHECK ("paymentStatus" IN ('UNPAID', 'PAID', 'WAIVED')),
    CONSTRAINT "TeamChargeTarget_amount_check" CHECK ("amount" BETWEEN 1 AND 10000000),
    CONSTRAINT "TeamChargeTarget_identity_check" CHECK (
        ("targetType" = 'MEMBER' AND "guestId" IS NULL) OR
        ("targetType" = 'GUEST' AND "memberId" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "TeamChargeTargetAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorDisplayNameSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamChargeTargetAudit_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "TeamChargeTarget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamChargeTargetAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamChargeTargetAudit_action_check" CHECK ("action" IN ('MARK_PAID', 'MARK_UNPAID', 'WAIVE', 'UNWAIVE')),
    CONSTRAINT "TeamChargeTargetAudit_previous_status_check" CHECK ("previousStatus" IS NULL OR "previousStatus" IN ('UNPAID', 'PAID', 'WAIVED')),
    CONSTRAINT "TeamChargeTargetAudit_next_status_check" CHECK ("nextStatus" IN ('UNPAID', 'PAID', 'WAIVED'))
);

-- CreateIndex
CREATE INDEX "TeamCharge_teamId_status_dueDate_idx" ON "TeamCharge"("teamId", "status", "dueDate");
CREATE INDEX "TeamCharge_eventId_idx" ON "TeamCharge"("eventId");
CREATE INDEX "TeamCharge_createdByUserId_idx" ON "TeamCharge"("createdByUserId");
CREATE UNIQUE INDEX "TeamChargeTarget_chargeId_memberId_key" ON "TeamChargeTarget"("chargeId", "memberId");
CREATE UNIQUE INDEX "TeamChargeTarget_chargeId_guestId_key" ON "TeamChargeTarget"("chargeId", "guestId");
CREATE INDEX "TeamChargeTarget_chargeId_paymentStatus_idx" ON "TeamChargeTarget"("chargeId", "paymentStatus");
CREATE INDEX "TeamChargeTarget_memberId_idx" ON "TeamChargeTarget"("memberId");
CREATE INDEX "TeamChargeTarget_guestId_idx" ON "TeamChargeTarget"("guestId");
CREATE INDEX "TeamChargeTarget_markedByUserId_idx" ON "TeamChargeTarget"("markedByUserId");
CREATE INDEX "TeamChargeTargetAudit_targetId_createdAt_idx" ON "TeamChargeTargetAudit"("targetId", "createdAt");
CREATE INDEX "TeamChargeTargetAudit_actorUserId_createdAt_idx" ON "TeamChargeTargetAudit"("actorUserId", "createdAt");
