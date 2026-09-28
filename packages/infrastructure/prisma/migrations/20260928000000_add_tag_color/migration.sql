-- ---------------------------------------------------------------------------
-- Tag colours (SPEC/decisions.md 2026-09-28, the fourth amendment to the S0.2
-- schema freeze; SPEC/20-feature-ideas-and-engagement.md Tags rules 9-10).
--
-- The column is added nullable, every existing tag is backfilled, and only then
-- is it made NOT NULL. The backfill indexes rule 9's palette, in its listed
-- order from 0, by the first byte of the MD5 digest of the normalized name,
-- modulo 10 - so it is repeatable, and the demo seed computes the same index.
-- ---------------------------------------------------------------------------

ALTER TABLE "tags" ADD COLUMN "color" VARCHAR(7);

UPDATE "tags" AS t
SET "color" = (ARRAY[
        '#E5484D', '#F5A524', '#3FB86B', '#2F9E8F', '#5CC8E0',
        '#6B9BF2', '#B08CF5', '#E879A6', '#A87B2F', '#94A3B8'
    ])[GET_BYTE(DECODE(MD5(t."normalized_name"), 'hex'), 0) % 10 + 1]
WHERE t."color" IS NULL;

ALTER TABLE "tags" ALTER COLUMN "color" SET NOT NULL;
