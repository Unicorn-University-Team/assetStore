-- CreateTable
CREATE TABLE "tag" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");

-- Tag names are lower case letters, digits and hyphens (Prisma can't express CHECK constraints, so it is only here)
ALTER TABLE "tag" ADD CONSTRAINT "tag_name_check" CHECK ("name" ~ '^[a-z0-9-]{1,50}$');
