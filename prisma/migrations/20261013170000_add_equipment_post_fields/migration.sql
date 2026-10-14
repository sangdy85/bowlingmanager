-- Optional metadata: existing community posts and discussions remain intact.
ALTER TABLE "CommunityPost" ADD COLUMN "equipmentType" TEXT;
ALTER TABLE "CommunityPost" ADD COLUMN "equipmentCategory" TEXT;
ALTER TABLE "CommunityPost" ADD COLUMN "equipmentBrand" TEXT;
ALTER TABLE "CommunityPost" ADD COLUMN "equipmentModel" TEXT;
ALTER TABLE "CommunityPost" ADD COLUMN "equipmentLink" TEXT;
