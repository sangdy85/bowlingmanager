-- CreateTable
CREATE TABLE "TeamEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "eventTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "gameType" TEXT,
    "attendanceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "laneDrawEnabled" BOOLEAN NOT NULL DEFAULT false,
    "laneDrawMode" TEXT NOT NULL DEFAULT 'BULK',
    "laneDrawStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamEventAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT,
    "memberDisplayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNANSWERED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamEventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamEventAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamEventAttendance_status_check" CHECK ("status" IN ('UNANSWERED', 'ATTENDING', 'NOT_ATTENDING'))
);

-- CreateTable
CREATE TABLE "TeamEventGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamEventGuest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamEventLaneSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "laneNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamEventLaneSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamEventLaneSlot_lane_check" CHECK ("laneNumber" BETWEEN 1 AND 24),
    CONSTRAINT "TeamEventLaneSlot_position_check" CHECK ("position" BETWEEN 1 AND 6)
);

-- CreateTable
CREATE TABLE "TeamEventLaneAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "memberId" TEXT,
    "guestId" TEXT,
    "participantKind" TEXT NOT NULL,
    "participantDisplayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamEventLaneAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TeamEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamEventLaneAssignment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TeamEventLaneSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamEventLaneAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamEventLaneAssignment_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "TeamEventGuest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamEventLaneAssignment_participant_check" CHECK (
        ("participantKind" = 'MEMBER' AND "guestId" IS NULL) OR
        ("participantKind" = 'GUEST' AND "memberId" IS NULL)
    )
);

-- CreateIndex
CREATE INDEX "TeamEvent_teamId_eventDate_idx" ON "TeamEvent"("teamId", "eventDate");
CREATE INDEX "TeamEvent_createdById_idx" ON "TeamEvent"("createdById");
CREATE UNIQUE INDEX "TeamEventAttendance_eventId_memberId_key" ON "TeamEventAttendance"("eventId", "memberId");
CREATE INDEX "TeamEventAttendance_eventId_status_idx" ON "TeamEventAttendance"("eventId", "status");
CREATE INDEX "TeamEventAttendance_memberId_idx" ON "TeamEventAttendance"("memberId");
CREATE INDEX "TeamEventGuest_eventId_idx" ON "TeamEventGuest"("eventId");
CREATE UNIQUE INDEX "TeamEventLaneSlot_eventId_laneNumber_position_key" ON "TeamEventLaneSlot"("eventId", "laneNumber", "position");
CREATE INDEX "TeamEventLaneSlot_eventId_idx" ON "TeamEventLaneSlot"("eventId");
CREATE UNIQUE INDEX "TeamEventLaneAssignment_slotId_key" ON "TeamEventLaneAssignment"("slotId");
CREATE UNIQUE INDEX "TeamEventLaneAssignment_guestId_key" ON "TeamEventLaneAssignment"("guestId");
CREATE UNIQUE INDEX "TeamEventLaneAssignment_eventId_memberId_key" ON "TeamEventLaneAssignment"("eventId", "memberId");
CREATE INDEX "TeamEventLaneAssignment_eventId_idx" ON "TeamEventLaneAssignment"("eventId");
CREATE INDEX "TeamEventLaneAssignment_memberId_idx" ON "TeamEventLaneAssignment"("memberId");
