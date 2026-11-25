/*
  Warnings:

  - You are about to drop the column `comment` on the `report` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `report` table. All the data in the column will be lost.
  - Made the column `asset_owner_id` on table `report` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "report" DROP COLUMN "comment",
DROP COLUMN "updated_at",
ALTER COLUMN "asset_id" DROP NOT NULL,
ALTER COLUMN "asset_owner_id" SET NOT NULL;
