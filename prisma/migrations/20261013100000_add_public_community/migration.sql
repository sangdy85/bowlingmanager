-- Additive migration: private team posts and existing records are untouched.
CREATE TABLE "CommunityPost" (
 "id" TEXT NOT NULL PRIMARY KEY, "category" TEXT NOT NULL, "title" TEXT NOT NULL,
 "content" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
 "authorId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CommunityPost_status_category_createdAt_idx" ON "CommunityPost"("status", "category", "createdAt");
CREATE INDEX "CommunityPost_authorId_createdAt_idx" ON "CommunityPost"("authorId", "createdAt");
CREATE TABLE "CommunityComment" (
 "id" TEXT NOT NULL PRIMARY KEY, "postId" TEXT NOT NULL, "authorId" TEXT NOT NULL,
 "content" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "CommunityComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "CommunityComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CommunityComment_postId_status_createdAt_idx" ON "CommunityComment"("postId", "status", "createdAt");
CREATE INDEX "CommunityComment_authorId_createdAt_idx" ON "CommunityComment"("authorId", "createdAt");
CREATE TABLE "CommunityReport" (
 "id" TEXT NOT NULL PRIMARY KEY, "postId" TEXT NOT NULL, "authorId" TEXT NOT NULL,
 "reason" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CommunityReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "CommunityReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunityReport_postId_authorId_key" ON "CommunityReport"("postId", "authorId");
CREATE INDEX "CommunityReport_createdAt_idx" ON "CommunityReport"("createdAt");
