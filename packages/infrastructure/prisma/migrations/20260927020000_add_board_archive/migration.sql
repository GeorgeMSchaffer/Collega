-- ---------------------------------------------------------------------------
-- Board archive in place of delete (SPEC/decisions.md 2026-09-27, the third
-- amendment to the S0.2 schema freeze; SPEC/20-feature-boards-and-statuses.md
-- rule 13). Every existing board reads not archived.
-- ---------------------------------------------------------------------------

ALTER TABLE "boards" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "boards" ADD COLUMN "archived_at_utc" TIMESTAMPTZ(6);
