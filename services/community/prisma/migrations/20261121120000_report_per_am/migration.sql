-- Report table as in the Application Model (PersistenceLayerDiagram, reportSchema).

-- 1. Reasons: inappropriateContent | copyright | spam | brokenFile | other.
--    Old values are rewritten first: inappropriate -> inappropriateContent, malware -> brokenFile
--    (the form showed malware as "Broken or harmful file").
ALTER TABLE "report" DROP CONSTRAINT "report_reason_check";
UPDATE "report" SET "reason" = 'inappropriateContent' WHERE "reason" = 'inappropriate';
UPDATE "report" SET "reason" = 'brokenFile' WHERE "reason" = 'malware';
ALTER TABLE "report" ADD CONSTRAINT "report_reason_check"
  CHECK ("reason" IN ('inappropriateContent', 'copyright', 'spam', 'brokenFile', 'other'));

-- 2. assetName: copy of the asset name at the time of the report, kept for the violation history after the asset
--    is deleted. Reports filed before this column have NULL (filled once from catalog, see README).
ALTER TABLE "report" ADD COLUMN "asset_name" VARCHAR(100);

-- 3. One open report per author and asset (also under concurrent requests). Prisma cannot express a partial index,
--    so it is only here.
DROP INDEX "report_asset_id_author_id_idx";
CREATE INDEX "report_asset_id_idx" ON "report"("asset_id");
CREATE UNIQUE INDEX "report_one_open_per_author_asset" ON "report"("author_id", "asset_id") WHERE "status" = 'open';
