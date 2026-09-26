CREATE TABLE "MobilePushDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "MobilePushDevice_platform_check" CHECK ("platform" IN ('ANDROID')),
    CONSTRAINT "MobilePushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MobilePushDevice_token_key" ON "MobilePushDevice"("token");
CREATE INDEX "MobilePushDevice_userId_enabled_idx" ON "MobilePushDevice"("userId", "enabled");

CREATE TABLE "MobileNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "MobileNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MobileNotification_dedupeKey_key" ON "MobileNotification"("dedupeKey");
CREATE INDEX "MobileNotification_userId_createdAt_idx" ON "MobileNotification"("userId", "createdAt");
CREATE INDEX "MobileNotification_teamId_eventId_createdAt_idx" ON "MobileNotification"("teamId", "eventId", "createdAt");

CREATE TABLE "MobileNotificationDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MobileNotificationDelivery_status_check" CHECK ("status" IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
    CONSTRAINT "MobileNotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "MobileNotification" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MobileNotificationDelivery_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MobilePushDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MobileNotificationDelivery_notificationId_deviceId_key" ON "MobileNotificationDelivery"("notificationId", "deviceId");
CREATE INDEX "MobileNotificationDelivery_status_nextAttemptAt_idx" ON "MobileNotificationDelivery"("status", "nextAttemptAt");
