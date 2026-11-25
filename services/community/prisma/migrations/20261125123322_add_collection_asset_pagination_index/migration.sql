-- CreateIndex
CREATE INDEX "collection_asset_collection_id_added_at_asset_id_idx" ON "collection_asset"("collection_id", "added_at", "asset_id");
