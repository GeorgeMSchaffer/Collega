-- ---------------------------------------------------------------------------
-- Usage analytics (SPEC/decisions.md 2026-10-27, an amendment to the S0.2
-- schema freeze; SPEC/20-feature-analytics.md Part 3; SPEC/contracts/usage.md).
--
-- Additive only: one column with a default and two new tables, so no backfill.
-- The two tables have no foreign keys on purpose (see the decision).
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "users" ADD COLUMN "usage_tracking_opt_out" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "usage_events" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "user_id" UUID NOT NULL,
  "on_behalf_of_user_id" UUID,
  "event_type" VARCHAR(40) NOT NULL,
  "route" VARCHAR(200) NOT NULL,
  "entity_id" UUID,
  "props_json" TEXT,
  "occurred_at_utc" TIMESTAMPTZ(6) NOT NULL,
  "received_at_utc" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "PK_usage_events" PRIMARY KEY ("id")
);

CREATE INDEX "ix_usage_events_user_id_occurred_at_utc" ON "usage_events" ("user_id", "occurred_at_utc");
CREATE INDEX "ix_usage_events_organization_id_event_type_occurred_at_utc" ON "usage_events" ("organization_id", "event_type", "occurred_at_utc");
CREATE INDEX "ix_usage_events_occurred_at_utc" ON "usage_events" ("occurred_at_utc");

-- CreateTable
CREATE TABLE "usage_daily" (
  "day" DATE NOT NULL,
  "organization_id" UUID NOT NULL,
  "event_type" VARCHAR(40) NOT NULL,
  "event_count" INTEGER NOT NULL,
  "user_count" INTEGER NOT NULL,
  CONSTRAINT "PK_usage_daily" PRIMARY KEY ("day", "organization_id", "event_type")
);
