-- assetName is required in the Application Model (reportSchema). All existing reports have it filled from catalog;
-- the placeholder only covers a report whose asset was deleted before the name was stored (none on the server).
UPDATE "report" SET "asset_name" = '(deleted asset)' WHERE "asset_name" IS NULL;
ALTER TABLE "report" ALTER COLUMN "asset_name" SET NOT NULL;
