-- ---------------------------------------------------------------------------
-- An optional board description (SPEC/decisions.md 2026-09-27, the second
-- amendment to the S0.2 schema freeze).
--
-- Additive and nullable: every existing board reads NULL, which is "no
-- description", so nothing is backfilled and no row is rewritten.
-- ---------------------------------------------------------------------------

ALTER TABLE "boards" ADD COLUMN "description" VARCHAR(500);
