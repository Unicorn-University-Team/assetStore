-- CreateTable
CREATE TABLE "collection" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_asset" (
    "collection_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_asset_pkey" PRIMARY KEY ("collection_id","asset_id")
);

-- CreateIndex
CREATE INDEX "collection_owner_id_idx" ON "collection"("owner_id");

-- CreateIndex
CREATE INDEX "collection_asset_asset_id_idx" ON "collection_asset"("asset_id");

-- AddForeignKey
ALTER TABLE "collection_asset" ADD CONSTRAINT "collection_asset_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
