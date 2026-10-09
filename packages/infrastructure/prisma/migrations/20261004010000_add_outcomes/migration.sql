-- ---------------------------------------------------------------------------
-- Issues-and-Delivery, Slice 2: Outcomes (SPEC/decisions.md 2026-10-09, the
-- seventh amendment to the S0.2 schema freeze; SPEC/20-feature-issues-and-
-- delivery.md "New entity: Outcome" and "EF migration AddOutcomes";
-- SPEC/contracts/outcomes.md).
--
-- Additive only: one new table and one nullable column on ideas, so no
-- backfill. Every existing Issue starts ungrouped.
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "ideas" ADD COLUMN     "outcome_id" UUID;

-- CreateTable
CREATE TABLE "outcomes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "target_start_date" DATE NOT NULL,
    "target_end_date" DATE NOT NULL,
    "owner_user_id" UUID,
    "sort_order" INTEGER NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_outcomes" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_outcomes_organization_id_sort_order" ON "outcomes"("organization_id", "sort_order");

-- CreateIndex
CREATE INDEX "ix_ideas_outcome_id" ON "ideas"("outcome_id");

-- Single-parent grouping (2026-09-02). SET NULL, never CASCADE: removing an
-- Outcome ungroups its Issues and must never delete one.
-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "FK_ideas_outcomes_outcome_id" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "outcomes" ADD CONSTRAINT "FK_outcomes_organizations_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

