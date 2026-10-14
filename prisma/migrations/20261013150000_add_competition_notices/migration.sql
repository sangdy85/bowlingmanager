CREATE TABLE "CompetitionNotice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "registrationStartDate" DATETIME NOT NULL,
    "registrationEndDate" DATETIME NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "eventTime" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "fee" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" TEXT NOT NULL,
    "registrationUrl" TEXT,
    "relatedUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompetitionNotice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CompetitionNotice_published_startDate_idx" ON "CompetitionNotice"("published", "startDate");
