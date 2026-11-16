-- CreateTable
CREATE TABLE "report" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "asset_owner_id" UUID,
    "author_id" UUID NOT NULL,
    "reason" VARCHAR(20) NOT NULL,
    "comment" VARCHAR(500) NOT NULL DEFAULT '',
    "status" VARCHAR(10) NOT NULL DEFAULT 'open',
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_status_created_at_idx" ON "report"("status", "created_at");

-- CreateIndex
CREATE INDEX "report_asset_id_author_id_idx" ON "report"("asset_id", "author_id");

-- Allowed values (Prisma can't express CHECK constraints, so they are only here). Same lists as in ReportModel.
ALTER TABLE "report" ADD CONSTRAINT "report_reason_check" CHECK ("reason" IN ('copyright', 'inappropriate', 'malware', 'spam', 'other'));
ALTER TABLE "report" ADD CONSTRAINT "report_status_check" CHECK ("status" IN ('open', 'resolved', 'rejected'));
-- A decided report knows who decided and when; an open one does not.
ALTER TABLE "report" ADD CONSTRAINT "report_decision_check" CHECK (("status" = 'open') = ("decided_by" IS NULL AND "decided_at" IS NULL));
