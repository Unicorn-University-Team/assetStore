-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('inappropriateContent', 'copyright', 'spam', 'brokenFile', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'resolved', 'rejected');

-- CreateTable
CREATE TABLE "review" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);
-- Rating must be an integer between 1 and 5
ALTER TABLE "review"
ADD CONSTRAINT "review_rating_check"
CHECK ("rating" BETWEEN 1 AND 5);

-- CreateTable
CREATE TABLE "report" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "asset_name" TEXT NOT NULL,
    "asset_owner_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "decided_by_id" UUID,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_created_at_idx" ON "review"("created_at");

-- CreateIndex
CREATE INDEX "review_asset_id_idx" ON "review"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_author_id_asset_id_key" ON "review"("author_id", "asset_id");

-- CreateIndex
CREATE INDEX "report_asset_owner_id_status_idx" ON "report"("asset_owner_id", "status");

-- CreateIndex
CREATE INDEX "report_asset_id_idx" ON "report"("asset_id");

-- Only one open report per author and asset
CREATE UNIQUE INDEX "report_one_open_per_author_asset"
ON "report" ("author_id", "asset_id")
WHERE "status" = 'open';
