-- AM userAccount: confirmedViolations and suspendedAt (US-6, US-8).
ALTER TABLE "user_account" ADD COLUMN "confirmed_violations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "suspended_at" TIMESTAMP(3);

-- One row per accepted report, so a report is counted only once (AM report/accept step 4).
CREATE TABLE "user_violation" (
    "report_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_violation_pkey" PRIMARY KEY ("report_id")
);

CREATE INDEX "user_violation_user_id_idx" ON "user_violation"("user_id");

ALTER TABLE "user_violation" ADD CONSTRAINT "user_violation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
