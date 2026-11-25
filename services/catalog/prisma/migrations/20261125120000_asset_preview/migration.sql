-- AM asset: a separate preview image (previewKey, previewContentType), served by GET /api/assets/:id/preview.
ALTER TABLE "asset" ADD COLUMN "preview_key" TEXT,
ADD COLUMN "preview_content_type" VARCHAR(20);

-- Assets uploaded before previews: a png, jpg or webp file of at most 5 MB was its own card picture, so it stays its
-- own preview (the same S3 object; the code never deletes a preview that is the asset file). Others stay without one.
UPDATE "asset"
SET "preview_key" = "file_key",
    "preview_content_type" = CASE lower(substring("file_name" from '\.([^.]+)$'))
      WHEN 'png' THEN 'image/png'
      WHEN 'webp' THEN 'image/webp'
      ELSE 'image/jpeg'
    END
WHERE lower(substring("file_name" from '\.([^.]+)$')) IN ('png', 'jpg', 'jpeg', 'webp')
  AND "file_size" <= 5 * 1024 * 1024;
