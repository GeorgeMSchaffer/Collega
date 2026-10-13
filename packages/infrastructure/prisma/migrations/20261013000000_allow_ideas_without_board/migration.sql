-- ---------------------------------------------------------------------------
-- Ideas with no board (SPEC/decisions.md 2026-10-13, the eighth amendment to
-- the S0.2 schema freeze; SPEC/20-feature-board-pull-in.md rule 1).
--
-- An idea in the organization's pool has no board, and neither has the
-- notification event written for it. ideas.board_id carries no foreign key, so
-- this only drops NOT NULL; the board-id index stays. Existing rows keep their
-- board: no backfill.
-- ---------------------------------------------------------------------------
-- AlterTable
ALTER TABLE "ideas" ALTER COLUMN "board_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "notification_events" ALTER COLUMN "board_id" DROP NOT NULL;
