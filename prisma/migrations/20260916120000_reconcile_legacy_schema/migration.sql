-- CreateTable
CREATE TABLE "BowlingCenter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT NOT NULL,
    FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CenterMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alias" TEXT,
    "userId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "teamId" TEXT,
    FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("centerId") REFERENCES "BowlingCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "answer" TEXT,
    FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeagueMatchup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "teamAId" TEXT,
    "teamASquad" TEXT,
    "teamBId" TEXT,
    "teamBSquad" TEXT,
    "lanes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pointsA" REAL,
    "pointsB" REAL,
    "scoreA1" INTEGER,
    "scoreA2" INTEGER,
    "scoreA3" INTEGER,
    "scoreB1" INTEGER,
    "scoreB2" INTEGER,
    "scoreB3" INTEGER,
    FOREIGN KEY ("roundId") REFERENCES "LeagueRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeagueMatchupIndividualScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchupId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamSquad" TEXT,
    "userId" TEXT,
    "playerName" TEXT,
    "handicap" INTEGER NOT NULL DEFAULT 0,
    "score1" INTEGER NOT NULL DEFAULT 0,
    "score2" INTEGER NOT NULL DEFAULT 0,
    "score3" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("matchupId") REFERENCES "LeagueMatchup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeagueRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "date" DATETIME,
    "registrationEnd" DATETIME,
    "registrationStart" DATETIME,
    "startLane" INTEGER,
    "endLane" INTEGER,
    "laneConfig" TEXT,
    "moveLaneType" TEXT,
    "moveLaneCount" INTEGER,
    "hasFemaleChamp" BOOLEAN NOT NULL DEFAULT false,
    "luckyDrawResult" TEXT,
    FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawLaneScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "lane" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "game1" INTEGER,
    "game2" INTEGER,
    "game3" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("roundId") REFERENCES "LeagueRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoundParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "lane" INTEGER,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "isFemaleChamp" BOOLEAN NOT NULL DEFAULT false,
    "sideBasic" BOOLEAN NOT NULL DEFAULT false,
    "sideBall" BOOLEAN NOT NULL DEFAULT false,
    "sideExtra" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handicap" INTEGER,
    FOREIGN KEY ("roundId") REFERENCES "LeagueRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("registrationId") REFERENCES "TournamentRegistration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "entryFee" INTEGER NOT NULL DEFAULT 0,
    "maxParticipants" INTEGER NOT NULL DEFAULT 0,
    "iteration" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'EVENT',
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "leagueDay" INTEGER,
    "leagueTime" TEXT,
    "teamHandicapLimit" INTEGER,
    "awardMinGames" INTEGER NOT NULL DEFAULT 12,
    "avgTopRankCount" INTEGER NOT NULL DEFAULT 30,
    "avgMinParticipationPct" INTEGER NOT NULL DEFAULT 0,
    "manualTeamHandicaps" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "centerId" TEXT NOT NULL,
    "reportNotice" TEXT,
    "settings" TEXT,
    FOREIGN KEY ("centerId") REFERENCES "BowlingCenter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER,
    "tournamentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "guestTeamName" TEXT,
    "teamId" TEXT,
    "squad" TEXT,
    "handicap" INTEGER,
    "laneAssignment" INTEGER,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "entryGroupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registrationId" TEXT NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "roundId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("registrationId") REFERENCES "TournamentRegistration" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("roundId") REFERENCES "LeagueRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CenterManagers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("A") REFERENCES "BowlingCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT,
    "centerId" TEXT,
    FOREIGN KEY ("centerId") REFERENCES "BowlingCenter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("code", "createdAt", "id", "name", "ownerId", "updatedAt") SELECT "code", "createdAt", "id", "name", "ownerId", "updatedAt" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_code_key" ON "Team"("code" ASC);
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "handicap" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "emailVerified" DATETIME
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "id", "name", "password", "updatedAt") SELECT "createdAt", "email", "emailVerified", "id", "name", "password", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BowlingCenter_code_key" ON "BowlingCenter"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CenterMember_userId_centerId_key" ON "CenterMember"("userId" ASC, "centerId" ASC);

-- CreateIndex
CREATE INDEX "LeagueMatchupIndividualScore_matchupId_idx" ON "LeagueMatchupIndividualScore"("matchupId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RawLaneScore_roundId_lane_slot_key" ON "RawLaneScore"("roundId" ASC, "lane" ASC, "slot" ASC);

-- CreateIndex
CREATE INDEX "RawLaneScore_roundId_idx" ON "RawLaneScore"("roundId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RoundParticipant_roundId_registrationId_key" ON "RoundParticipant"("roundId" ASC, "registrationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_userId_key" ON "TournamentRegistration"("tournamentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "_CenterManagers_B_index" ON "_CenterManagers"("B" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "_CenterManagers_AB_unique" ON "_CenterManagers"("A" ASC, "B" ASC);
