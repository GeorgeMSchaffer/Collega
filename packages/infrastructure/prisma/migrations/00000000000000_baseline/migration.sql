-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AiCallOutcome" AS ENUM ('Succeeded', 'Refused', 'Failed');

-- CreateEnum
CREATE TYPE "AiKeySource" AS ENUM ('Platform', 'Organization');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('Text', 'Number', 'Date', 'Boolean', 'Dropdown', 'MultiSelect', 'Url');

-- CreateEnum
CREATE TYPE "IdeaTypeFieldMode" AS ENUM ('AllActiveFields', 'Curated');

-- CreateEnum
CREATE TYPE "ImpersonationEndReason" AS ENUM ('ExitedByUser', 'IdleTimeout', 'AbsoluteTimeout', 'TargetNoLongerValid', 'RealUserNoLongerAuthorized');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('IdeaMention', 'CommentMention', 'CommentAdded', 'IdeaStatusChanged');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SiteAdmin', 'OrgAdmin', 'User', 'ReadOnly');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('Active', 'Inactive');

-- CreateTable
CREATE TABLE "__EFMigrationsHistory" (
    "MigrationId" VARCHAR(150) NOT NULL,
    "ProductVersion" VARCHAR(32) NOT NULL,

    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

-- CreateTable
CREATE TABLE "ai_prompt_versions" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "body" VARCHAR(20000) NOT NULL,
    "out_of_scope_redirect" VARCHAR(500) NOT NULL,
    "conversation_closed_redirect" VARCHAR(500) NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "PK_ai_prompt_versions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "on_behalf_of_user_id" UUID,
    "board_id" UUID,
    "occurred_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cache_read_input_tokens" INTEGER NOT NULL,
    "cache_creation_input_tokens" INTEGER NOT NULL,
    "input_rate_per_million" DECIMAL(12,6) NOT NULL,
    "output_rate_per_million" DECIMAL(12,6) NOT NULL,
    "key_source" "AiKeySource" NOT NULL,
    "outcome" "AiCallOutcome" NOT NULL,

    CONSTRAINT "PK_ai_usage_records" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "actor_user_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "message" VARCHAR(1000) NOT NULL,
    "metadata_json" TEXT,
    "occurred_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "on_behalf_of_user_id" UUID,

    CONSTRAINT "PK_audit_events" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_swimlanes" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "PK_board_swimlanes" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boards" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "allow_user_status_update" BOOLEAN NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_boards" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_impacts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_deleted" BOOLEAN NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_business_impacts" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_mentions" (
    "id" UUID NOT NULL,
    "comment_id" UUID NOT NULL,
    "mentioned_user_id" UUID NOT NULL,

    CONSTRAINT "PK_comment_mentions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_comments" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_definition_options" (
    "id" UUID NOT NULL,
    "field_definition_id" UUID NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "PK_field_definition_options" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "field_type" "FieldType" NOT NULL,
    "is_required" BOOLEAN NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_deleted" BOOLEAN NOT NULL,
    "deleted_at_utc" TIMESTAMPTZ(6),
    "deleted_by_user_id" UUID,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_field_definitions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_assignees" (
    "id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "PK_idea_assignees" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_field_values" (
    "id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "field_definition_id" UUID NOT NULL,
    "value" VARCHAR(4000),
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_idea_field_values" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_mentions" (
    "id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "mentioned_user_id" UUID NOT NULL,

    CONSTRAINT "PK_idea_mentions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_tags" (
    "id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "PK_idea_tags" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_type_fields" (
    "id" UUID NOT NULL,
    "idea_type_id" UUID NOT NULL,
    "field_definition_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL,

    CONSTRAINT "PK_idea_type_fields" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_types" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_deleted" BOOLEAN NOT NULL,
    "color_hex" VARCHAR(7),
    "icon" VARCHAR(64),
    "field_mode" "IdeaTypeFieldMode" NOT NULL DEFAULT 'AllActiveFields',
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_idea_types" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_upvotes" (
    "id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_idea_upvotes" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "priority" "Priority" NOT NULL,
    "idea_type_id" UUID NOT NULL,
    "business_impact_id" UUID NOT NULL,
    "due_date" DATE,
    "author_user_id" UUID NOT NULL,
    "is_deleted" BOOLEAN NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_ideas" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" UUID NOT NULL,
    "real_user_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "started_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "absolute_expires_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "ended_at_utc" TIMESTAMPTZ(6),
    "end_reason" "ImpersonationEndReason",

    CONSTRAINT "PK_impersonation_sessions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" UUID NOT NULL,
    "event_type" "NotificationEventType" NOT NULL,
    "organization_id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "idea_title" VARCHAR(150) NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "link" VARCHAR(200) NOT NULL,
    "occurred_at_utc" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_notification_events" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "invite_code" VARCHAR(50) NOT NULL,
    "is_archived" BOOLEAN NOT NULL,
    "logo_url" VARCHAR(500),
    "logo_thumbnail_url" TEXT,
    "logo_height_px" INTEGER,
    "address" VARCHAR(200),
    "city" VARCHAR(100),
    "state" VARCHAR(50),
    "zip" VARCHAR(20),
    "phone" VARCHAR(25),
    "primary_contact_first_name" VARCHAR(100),
    "primary_contact_last_name" VARCHAR(100),
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "ai_scope_statement" VARCHAR(500),

    CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statuses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_deleted" BOOLEAN NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_statuses" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(100) NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_tags" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "normalized_email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL,
    "must_change_password" BOOLEAN NOT NULL,
    "failed_login_count" INTEGER NOT NULL,
    "lockout_window_start_utc" TIMESTAMPTZ(6),
    "locked_until_utc" TIMESTAMPTZ(6),
    "temporary_password_expires_at_utc" TIMESTAMPTZ(6),
    "portrait_png" BYTEA,
    "security_stamp" VARCHAR(64) NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_users" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ux_ai_prompt_versions_version" ON "ai_prompt_versions"("version");

-- CreateIndex
CREATE INDEX "ix_ai_usage_records_occurred_at_utc" ON "ai_usage_records"("occurred_at_utc");

-- CreateIndex
CREATE INDEX "ix_ai_usage_records_organization_id_occurred_at_utc" ON "ai_usage_records"("organization_id", "occurred_at_utc");

-- CreateIndex
CREATE INDEX "ix_audit_events_occurred_at_utc" ON "audit_events"("occurred_at_utc");

-- CreateIndex
CREATE INDEX "ix_audit_events_organization_id" ON "audit_events"("organization_id");

-- CreateIndex
CREATE INDEX "IX_board_swimlanes_status_id" ON "board_swimlanes"("status_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_board_swimlanes_board_id_status_id" ON "board_swimlanes"("board_id", "status_id");

-- CreateIndex
CREATE INDEX "ix_boards_organization_id" ON "boards"("organization_id");

-- CreateIndex
CREATE INDEX "ix_business_impacts_organization_id_sort_order" ON "business_impacts"("organization_id", "sort_order");

-- CreateIndex
CREATE INDEX "IX_comment_mentions_mentioned_user_id" ON "comment_mentions"("mentioned_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_comment_mentions_comment_id_mentioned_user_id" ON "comment_mentions"("comment_id", "mentioned_user_id");

-- CreateIndex
CREATE INDEX "ix_comments_idea_id_created_at_utc" ON "comments"("idea_id", "created_at_utc");

-- CreateIndex
CREATE INDEX "ix_field_definition_options_field_definition_id_display_order" ON "field_definition_options"("field_definition_id", "display_order");

-- CreateIndex
CREATE INDEX "ix_field_definitions_organization_id_display_order" ON "field_definitions"("organization_id", "display_order");

-- CreateIndex
CREATE INDEX "IX_idea_assignees_user_id" ON "idea_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_idea_assignees_idea_id_user_id" ON "idea_assignees"("idea_id", "user_id");

-- CreateIndex
CREATE INDEX "ix_idea_field_values_field_definition_id" ON "idea_field_values"("field_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_idea_field_values_idea_id_field_definition_id" ON "idea_field_values"("idea_id", "field_definition_id");

-- CreateIndex
CREATE INDEX "IX_idea_mentions_mentioned_user_id" ON "idea_mentions"("mentioned_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_idea_mentions_idea_id_mentioned_user_id" ON "idea_mentions"("idea_id", "mentioned_user_id");

-- CreateIndex
CREATE INDEX "IX_idea_tags_tag_id" ON "idea_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_idea_tags_idea_id_tag_id" ON "idea_tags"("idea_id", "tag_id");

-- CreateIndex
CREATE INDEX "IX_idea_type_fields_field_definition_id" ON "idea_type_fields"("field_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_idea_type_fields_idea_type_id_field_definition_id" ON "idea_type_fields"("idea_type_id", "field_definition_id");

-- CreateIndex
CREATE INDEX "ix_idea_types_organization_id_sort_order" ON "idea_types"("organization_id", "sort_order");

-- CreateIndex
CREATE INDEX "IX_idea_upvotes_user_id" ON "idea_upvotes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_idea_upvotes_idea_id_user_id" ON "idea_upvotes"("idea_id", "user_id");

-- CreateIndex
CREATE INDEX "IX_ideas_business_impact_id" ON "ideas"("business_impact_id");

-- CreateIndex
CREATE INDEX "IX_ideas_idea_type_id" ON "ideas"("idea_type_id");

-- CreateIndex
CREATE INDEX "ix_ideas_board_id_is_deleted" ON "ideas"("board_id", "is_deleted");

-- CreateIndex
CREATE INDEX "ix_ideas_organization_id_is_deleted" ON "ideas"("organization_id", "is_deleted");

-- CreateIndex
CREATE INDEX "IX_impersonation_sessions_target_user_id" ON "impersonation_sessions"("target_user_id");

-- CreateIndex
CREATE INDEX "ix_impersonation_sessions_real_user_id_ended_at_utc" ON "impersonation_sessions"("real_user_id", "ended_at_utc");

-- CreateIndex
CREATE INDEX "ix_notification_events_idea_id" ON "notification_events"("idea_id");

-- CreateIndex
CREATE INDEX "ix_notification_events_occurred_at_utc" ON "notification_events"("occurred_at_utc");

-- CreateIndex
CREATE INDEX "ix_notification_events_recipient_user_id" ON "notification_events"("recipient_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_organizations_invite_code" ON "organizations"("invite_code");

-- CreateIndex
CREATE INDEX "ix_statuses_organization_id_sort_order" ON "statuses"("organization_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "ux_tags_organization_id_normalized_name" ON "tags"("organization_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "ux_users_normalized_email" ON "users"("normalized_email");

-- CreateIndex
CREATE INDEX "ix_users_organization_id" ON "users"("organization_id");

-- AddForeignKey
ALTER TABLE "board_swimlanes" ADD CONSTRAINT "FK_board_swimlanes_boards_board_id" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "board_swimlanes" ADD CONSTRAINT "FK_board_swimlanes_statuses_status_id" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "FK_boards_organizations_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "business_impacts" ADD CONSTRAINT "FK_business_impacts_organizations_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "FK_comment_mentions_comments_comment_id" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "FK_comment_mentions_users_mentioned_user_id" FOREIGN KEY ("mentioned_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_ideas_idea_id" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_definition_options" ADD CONSTRAINT "FK_field_definition_options_field_definitions_field_definition~" FOREIGN KEY ("field_definition_id") REFERENCES "field_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_definitions" ADD CONSTRAINT "FK_field_definitions_organizations_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_assignees" ADD CONSTRAINT "FK_idea_assignees_ideas_idea_id" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_assignees" ADD CONSTRAINT "FK_idea_assignees_users_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_field_values" ADD CONSTRAINT "FK_idea_field_values_field_definitions_field_definition_id" FOREIGN KEY ("field_definition_id") REFERENCES "field_definitions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_field_values" ADD CONSTRAINT "FK_idea_field_values_ideas_idea_id" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_mentions" ADD CONSTRAINT "FK_idea_mentions_ideas_idea_id" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_mentions" ADD CONSTRAINT "FK_idea_mentions_users_mentioned_user_id" FOREIGN KEY ("mentioned_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_tags" ADD CONSTRAINT "FK_idea_tags_ideas_idea_id" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_tags" ADD CONSTRAINT "FK_idea_tags_tags_tag_id" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_type_fields" ADD CONSTRAINT "FK_idea_type_fields_field_definitions_field_definition_id" FOREIGN KEY ("field_definition_id") REFERENCES "field_definitions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_type_fields" ADD CONSTRAINT "FK_idea_type_fields_idea_types_idea_type_id" FOREIGN KEY ("idea_type_id") REFERENCES "idea_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_types" ADD CONSTRAINT "FK_idea_types_organizations_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_upvotes" ADD CONSTRAINT "FK_idea_upvotes_ideas_idea_id" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idea_upvotes" ADD CONSTRAINT "FK_idea_upvotes_users_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "FK_ideas_business_impacts_business_impact_id" FOREIGN KEY ("business_impact_id") REFERENCES "business_impacts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "FK_ideas_idea_types_idea_type_id" FOREIGN KEY ("idea_type_id") REFERENCES "idea_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "FK_ideas_organizations_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "FK_impersonation_sessions_users_real_user_id" FOREIGN KEY ("real_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "FK_impersonation_sessions_users_target_user_id" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "FK_statuses_organizations_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "FK_tags_organizations_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "FK_users_organizations_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


-- ---------------------------------------------------------------------------
-- Partial unique indexes, by hand.
--
-- Prisma does not model a partial index, so `db pull` drops these three SILENTLY and
-- `migrate diff` reports an empty migration. Nothing above this line recreates them, and
-- nothing warns you. They are re-expressed here as raw SQL, and
-- test/partial-indexes.test.ts fails if any is missing from this file.
--
-- The second one is not an optimisation. It is what makes "at most one open View As
-- session per user" a database guarantee rather than a race between two requests.
-- See SPEC/typescript-conversion-map/findings/05-prisma-introspection.md.
-- ---------------------------------------------------------------------------

-- A field definition's name is unique per organization among the ones not soft-deleted,
-- so a deleted name can be reused.
CREATE UNIQUE INDEX "ux_field_definitions_organization_id_normalized_name"
  ON "field_definitions" ("organization_id", "normalized_name")
  WHERE ("is_deleted" = false);

-- At most one open impersonation session per real user. Enforced here because two
-- concurrent requests can both pass an application-layer check.
CREATE UNIQUE INDEX "ux_impersonation_sessions_real_user_id_open"
  ON "impersonation_sessions" ("real_user_id")
  WHERE ("ended_at_utc" IS NULL);

-- At most one active AI prompt version, globally.
CREATE UNIQUE INDEX "ux_ai_prompt_versions_active"
  ON "ai_prompt_versions" ("is_active")
  WHERE "is_active";
