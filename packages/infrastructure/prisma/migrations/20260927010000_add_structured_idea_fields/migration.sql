-- ---------------------------------------------------------------------------
-- Structured idea fields: Problem, Proposed solutions, Impact rationale
-- (SPEC/decisions.md 2026-09-27, the third amendment to the S0.2 schema
-- freeze; SPEC/20-feature-ideas-and-engagement.md rule 2a).
--
-- The three columns are added nullable, every existing idea is backfilled per
-- rule 2a, and only then are they made NOT NULL, so the migration is safe on a
-- database that already holds ideas. Description becomes an optional summary.
-- The 1-to-5 bound on proposed_solutions is enforced in the domain, not here.
-- ---------------------------------------------------------------------------

ALTER TABLE "ideas" ADD COLUMN "problem" VARCHAR(2000);
ALTER TABLE "ideas" ADD COLUMN "proposed_solutions" TEXT[];
ALTER TABLE "ideas" ADD COLUMN "impact_rationale" VARCHAR(1000);

-- Description allows 4000 characters and Problem 2000, so a longer description
-- is cut to fit rather than failing the backfill.
UPDATE "ideas" AS i
SET "problem" = CASE
        WHEN i."description" IS NULL OR BTRIM(i."description") = '' THEN 'Not captured before 2026-09-27.'
        ELSE LEFT(BTRIM(i."description"), 2000)
    END,
    "proposed_solutions" = ARRAY['Not captured before 2026-09-27.']::TEXT[],
    "impact_rationale" = 'Not captured before 2026-09-27.'
WHERE i."problem" IS NULL;

ALTER TABLE "ideas" ALTER COLUMN "problem" SET NOT NULL;
ALTER TABLE "ideas" ALTER COLUMN "proposed_solutions" SET NOT NULL;
ALTER TABLE "ideas" ALTER COLUMN "impact_rationale" SET NOT NULL;

ALTER TABLE "ideas" ALTER COLUMN "description" DROP NOT NULL;
