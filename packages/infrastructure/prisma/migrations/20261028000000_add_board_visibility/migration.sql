-- ---------------------------------------------------------------------------
-- Board visibility and access lists (SPEC/decisions.md 2026-10-26, "A board
-- can be Restricted to named users and groups"; SPEC/20-feature-board-access-
-- and-groups.md BAG-2 and BAG-3; SPEC/contracts/boards.md "Board access").
--
-- Every existing board becomes 'Organization', which is what every board was:
-- no backfill and no change in who sees what. The access lists are stored
-- whatever the visibility, and grant only while it is 'Restricted'. Deleting
-- a board, a user or a group cascades its grants.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "BoardVisibility" AS ENUM ('Organization', 'Restricted');

-- AlterTable
ALTER TABLE "boards" ADD COLUMN "visibility" "BoardVisibility" NOT NULL DEFAULT 'Organization';

-- CreateTable: users granted a board directly. The pair is the key.
CREATE TABLE "board_access_users" (
  "board_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  CONSTRAINT "PK_board_access_users" PRIMARY KEY ("board_id", "user_id"),
  CONSTRAINT "FK_board_access_users_boards_board_id"
    FOREIGN KEY ("board_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_board_access_users_users_user_id"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "ix_board_access_users_user_id" ON "board_access_users" ("user_id");

-- CreateTable: groups granted a board. The pair is the key.
CREATE TABLE "board_access_groups" (
  "board_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  CONSTRAINT "PK_board_access_groups" PRIMARY KEY ("board_id", "group_id"),
  CONSTRAINT "FK_board_access_groups_boards_board_id"
    FOREIGN KEY ("board_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_board_access_groups_user_groups_group_id"
    FOREIGN KEY ("group_id") REFERENCES "user_groups" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "ix_board_access_groups_group_id" ON "board_access_groups" ("group_id");
