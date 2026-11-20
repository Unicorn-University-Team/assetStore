/*
  Warnings:

  - You are about to drop the column `is_private` on the `collection` table. All the data in the column will be lost.
  - You are about to alter the column `description` on the `collection` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(2000)`.

*/
-- AlterTable
ALTER TABLE "collection" DROP COLUMN "is_private",
ALTER COLUMN "description" SET DATA TYPE VARCHAR(2000);
