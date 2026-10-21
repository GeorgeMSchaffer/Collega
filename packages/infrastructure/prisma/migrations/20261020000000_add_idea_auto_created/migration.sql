-- ---------------------------------------------------------------------------
-- ideas.auto_created (SPEC/decisions.md 2026-10-20, the eleventh amendment to
-- the S0.2 schema freeze; SPEC/contracts/ideas.md "Tasks and item keys").
--
-- Additive only: one defaulted column, so no backfill. Existing rows read false.
-- ---------------------------------------------------------------------------

-- AlterTable: a board task the system made on entry to an autoCreateTask lane
ALTER TABLE "ideas" ADD COLUMN "auto_created" BOOLEAN NOT NULL DEFAULT false;
