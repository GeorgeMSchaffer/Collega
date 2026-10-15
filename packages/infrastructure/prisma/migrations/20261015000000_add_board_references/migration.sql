-- ---------------------------------------------------------------------------
-- Board References (SPEC/decisions.md 2026-10-15, the ninth amendment to the
-- S0.2 schema freeze; SPEC/20-feature-board-references.md "Data model").
--
-- Additive only: every new column is nullable or defaulted and nothing is
-- dropped, so the Delivery phase, issue tasks and org-wide sprints keep working
-- until Plan 4 retires them. No backfill: existing boards have no key prefix
-- until the seed or an Org Admin sets one.
-- ---------------------------------------------------------------------------

-- AlterTable: a lane can reference another board, and can be a final ("done") lane
ALTER TABLE "board_swimlanes"
  ADD COLUMN "references_board_id" UUID,
  ADD COLUMN "is_final" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "board_swimlanes"
  ADD CONSTRAINT "FK_board_swimlanes_boards_references_board_id"
  FOREIGN KEY ("references_board_id") REFERENCES "boards" ("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "board_swimlanes"
  ADD CONSTRAINT "ck_board_swimlanes_no_self_reference"
  CHECK ("references_board_id" IS NULL OR "references_board_id" <> "board_id");

CREATE INDEX "ix_board_swimlanes_references_board_id" ON "board_swimlanes" ("references_board_id");

-- AlterTable: board options and the per-board item counter
ALTER TABLE "boards"
  ADD COLUMN "sprints_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "idea_features_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "key_prefix" VARCHAR(10),
  ADD COLUMN "next_item_number" INTEGER NOT NULL DEFAULT 1;

-- NULL prefixes never collide, so boards without a prefix coexist.
CREATE UNIQUE INDEX "ux_boards_organization_id_key_prefix" ON "boards" ("organization_id", "key_prefix");

-- AlterTable: a task points at its parent idea; both carry a per-board number
ALTER TABLE "ideas"
  ADD COLUMN "parent_idea_id" UUID,
  ADD COLUMN "item_number" INTEGER;

ALTER TABLE "ideas"
  ADD CONSTRAINT "FK_ideas_ideas_parent_idea_id"
  FOREIGN KEY ("parent_idea_id") REFERENCES "ideas" ("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ideas"
  ADD CONSTRAINT "ck_ideas_no_self_parent"
  CHECK ("parent_idea_id" IS NULL OR "parent_idea_id" <> "id");

CREATE INDEX "ix_ideas_parent_idea_id" ON "ideas" ("parent_idea_id");
CREATE UNIQUE INDEX "ux_ideas_board_id_item_number" ON "ideas" ("board_id", "item_number");

-- CreateTable: "blocked" waits on "blocker"; both are ideas on the same board
CREATE TABLE "idea_dependencies" (
  "blocked_idea_id" UUID NOT NULL,
  "blocker_idea_id" UUID NOT NULL,
  "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "PK_idea_dependencies" PRIMARY KEY ("blocked_idea_id", "blocker_idea_id"),
  CONSTRAINT "FK_idea_dependencies_ideas_blocked_idea_id"
    FOREIGN KEY ("blocked_idea_id") REFERENCES "ideas" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_idea_dependencies_ideas_blocker_idea_id"
    FOREIGN KEY ("blocker_idea_id") REFERENCES "ideas" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "ck_idea_dependencies_no_self" CHECK ("blocked_idea_id" <> "blocker_idea_id")
);

CREATE INDEX "ix_idea_dependencies_blocker_idea_id" ON "idea_dependencies" ("blocker_idea_id");

-- AlterTable: a sprint can belong to one board (NULL = a sprint from before this change)
ALTER TABLE "sprints" ADD COLUMN "board_id" UUID;

ALTER TABLE "sprints"
  ADD CONSTRAINT "FK_sprints_boards_board_id"
  FOREIGN KEY ("board_id") REFERENCES "boards" ("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "ix_sprints_board_id_state" ON "sprints" ("board_id", "state");
