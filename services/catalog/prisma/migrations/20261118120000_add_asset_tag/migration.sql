-- CreateTable
CREATE TABLE "asset_tag" (
    "asset_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "asset_tag_pkey" PRIMARY KEY ("asset_id","tag_id")
);

-- CreateIndex
CREATE INDEX "asset_tag_tag_id_idx" ON "asset_tag"("tag_id");

-- AddForeignKey
ALTER TABLE "asset_tag" ADD CONSTRAINT "asset_tag_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_tag" ADD CONSTRAINT "asset_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

