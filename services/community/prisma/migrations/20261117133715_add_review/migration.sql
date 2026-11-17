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

-- CreateIndex
CREATE INDEX "review_asset_id_idx" ON "review"("asset_id");

-- CreateIndex
CREATE INDEX "review_created_at_idx" ON "review"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_author_id_asset_id_key" ON "review"("author_id", "asset_id");

-- Rating is a whole number of stars (Prisma cannot express CHECK constraints, so it is only here).
ALTER TABLE "review" ADD CONSTRAINT "review_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
