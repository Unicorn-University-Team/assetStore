-- AlterTable
ALTER TABLE "asset" ADD COLUMN     "owner_id" UUID;

-- CreateIndex
CREATE INDEX "asset_owner_id_idx" ON "asset"("owner_id");
