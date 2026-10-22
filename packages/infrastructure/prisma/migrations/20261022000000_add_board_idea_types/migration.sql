-- ---------------------------------------------------------------------------
-- board_idea_types (SPEC/decisions.md 2026-10-22, the twelfth amendment to the
-- S0.2 schema freeze; SPEC/contracts/boards.md "Allowed idea types").
--
-- Additive only: one new table, so no backfill. A board with no rows takes
-- every active idea type, which is every existing board.
-- ---------------------------------------------------------------------------

-- CreateTable: the idea types a board takes. The pair is the key.
CREATE TABLE "board_idea_types" (
  "board_id" UUID NOT NULL,
  "idea_type_id" UUID NOT NULL,
  CONSTRAINT "PK_board_idea_types" PRIMARY KEY ("board_id", "idea_type_id"),
  CONSTRAINT "FK_board_idea_types_boards_board_id"
    FOREIGN KEY ("board_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_board_idea_types_idea_types_idea_type_id"
    FOREIGN KEY ("idea_type_id") REFERENCES "idea_types" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX "ix_board_idea_types_idea_type_id" ON "board_idea_types" ("idea_type_id");
