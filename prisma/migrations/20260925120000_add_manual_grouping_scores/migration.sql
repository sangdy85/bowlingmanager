-- Additive event-scoped manual grouping scores for members with insufficient data and guests.
ALTER TABLE "TeamEventAttendance" ADD COLUMN "manualGroupingScore" INTEGER;
ALTER TABLE "TeamEventGuest" ADD COLUMN "manualGroupingScore" INTEGER;
