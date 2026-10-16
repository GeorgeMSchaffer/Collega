-- ---------------------------------------------------------------------------
-- Metric types (SPEC/decisions.md 2026-10-16, the tenth amendment to the S0.2
-- schema freeze; SPEC/contracts/metric-types.md). Also carries
-- board_swimlanes.auto_create_task for slice 236.
--
-- Additive only: two new tables and one defaulted column, so no backfill.
-- ---------------------------------------------------------------------------

-- AlterTable: a Board Reference lane can create the card's task on entry
ALTER TABLE "board_swimlanes" ADD COLUMN "auto_create_task" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: an organization's metric types. Names may repeat; removal archives.
CREATE TABLE "metric_types" (
  "metric_type_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "unit" VARCHAR(20),
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
  "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "PK_metric_types" PRIMARY KEY ("metric_type_id"),
  CONSTRAINT "FK_metric_types_organizations_organization_id"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX "ix_metric_types_organization_id" ON "metric_types" ("organization_id");

-- CreateTable: projected and realized values per item and type. Values go with
-- the idea; a type with values is archived, never deleted, hence RESTRICT.
CREATE TABLE "idea_metric_values" (
  "idea_id" UUID NOT NULL,
  "metric_type_id" UUID NOT NULL,
  "projected" NUMERIC(17, 2),
  "realized" NUMERIC(17, 2),
  CONSTRAINT "PK_idea_metric_values" PRIMARY KEY ("idea_id", "metric_type_id"),
  CONSTRAINT "FK_idea_metric_values_ideas_idea_id"
    FOREIGN KEY ("idea_id") REFERENCES "ideas" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_idea_metric_values_metric_types_metric_type_id"
    FOREIGN KEY ("metric_type_id") REFERENCES "metric_types" ("metric_type_id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX "ix_idea_metric_values_metric_type_id" ON "idea_metric_values" ("metric_type_id");
