-- A resolved report stays as moderation history when its asset is deleted; its asset_id is then set to NULL and the
-- copied asset_name is kept (AM report DAO deleteByAsset, BM US-3). Open and rejected reports are deleted instead.
ALTER TABLE "report" ALTER COLUMN "asset_id" DROP NOT NULL;
