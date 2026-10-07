-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('ROUTE', 'ROUTE_REQUEST', 'ROUTE_RESPONSE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'WELCOME';
ALTER TYPE "NotificationType" ADD VALUE 'ROUTE_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'ROUTE_RESPONSE';
ALTER TYPE "NotificationType" ADD VALUE 'REWARD';
ALTER TYPE "NotificationType" ADD VALUE 'BADGE';
ALTER TYPE "NotificationType" ADD VALUE 'VERIFIED';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "description" TEXT,
ADD COLUMN     "quotedPostId" TEXT,
ADD COLUMN     "type" "PostType" NOT NULL DEFAULT 'ROUTE';

-- CreateIndex
CREATE INDEX "Post_type_idx" ON "Post"("type");

-- CreateIndex
CREATE INDEX "Post_quotedPostId_idx" ON "Post"("quotedPostId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_quotedPostId_fkey" FOREIGN KEY ("quotedPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
