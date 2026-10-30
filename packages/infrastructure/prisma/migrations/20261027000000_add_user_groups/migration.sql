-- ---------------------------------------------------------------------------
-- User groups (SPEC/decisions.md 2026-10-26, "A board can be Restricted to
-- named users and groups", which amends the S0.2 schema freeze;
-- SPEC/20-feature-board-access-and-groups.md BAG-1, SPEC/contracts/groups.md).
--
-- Additive: two new tables, no backfill. The board grant tables arrive with
-- board visibility (slice 350). Deleting a group or a user cascades its
-- memberships.
-- ---------------------------------------------------------------------------

-- CreateTable: an organization's named set of users.
CREATE TABLE "user_groups" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "normalized_name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
  "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,
  CONSTRAINT "PK_user_groups" PRIMARY KEY ("id"),
  CONSTRAINT "FK_user_groups_organizations_organization_id"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "ux_user_groups_organization_id_normalized_name"
  ON "user_groups" ("organization_id", "normalized_name");

-- CreateTable: a group's members. The pair is the key.
CREATE TABLE "user_group_members" (
  "group_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  CONSTRAINT "PK_user_group_members" PRIMARY KEY ("group_id", "user_id"),
  CONSTRAINT "FK_user_group_members_user_groups_group_id"
    FOREIGN KEY ("group_id") REFERENCES "user_groups" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_user_group_members_users_user_id"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "ix_user_group_members_user_id" ON "user_group_members" ("user_id");
