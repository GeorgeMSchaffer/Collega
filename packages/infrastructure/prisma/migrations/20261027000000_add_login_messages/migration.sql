-- ---------------------------------------------------------------------------
-- Sign-in messages (SPEC/decisions.md 2026-10-27, an amendment to the S0.2
-- schema freeze; SPEC/contracts/login-messages.md).
--
-- Additive only: two enums and two new tables, so no backfill.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "LoginMessageDisplay" AS ENUM ('Modal', 'Banner');
CREATE TYPE "LoginMessageDismissal" AS ENUM ('EveryLogin', 'DismissOnce', 'AcknowledgeRequired');

-- CreateTable: a null organization is a system message.
CREATE TABLE "login_messages" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "title" VARCHAR(120) NOT NULL,
  "body" VARCHAR(4000) NOT NULL,
  "display" "LoginMessageDisplay" NOT NULL,
  "dismissal_mode" "LoginMessageDismissal" NOT NULL,
  "starts_at_utc" TIMESTAMPTZ(6) NOT NULL,
  "ends_at_utc" TIMESTAMPTZ(6),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
  "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,
  CONSTRAINT "PK_login_messages" PRIMARY KEY ("id"),
  CONSTRAINT "FK_login_messages_organizations_organization_id"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "CK_login_messages_window" CHECK ("ends_at_utc" IS NULL OR "ends_at_utc" > "starts_at_utc")
);

CREATE INDEX "ix_login_messages_organization_id_starts_at_utc"
  ON "login_messages" ("organization_id", "starts_at_utc");

-- CreateTable: one row per user and message, for the message's revision at the time.
CREATE TABLE "login_message_receipts" (
  "message_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "closed_at_utc" TIMESTAMPTZ(6),
  "dismissed_at_utc" TIMESTAMPTZ(6),
  "acknowledged_at_utc" TIMESTAMPTZ(6),
  CONSTRAINT "PK_login_message_receipts" PRIMARY KEY ("message_id", "user_id"),
  CONSTRAINT "FK_login_message_receipts_login_messages_message_id"
    FOREIGN KEY ("message_id") REFERENCES "login_messages" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_login_message_receipts_users_user_id"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "ix_login_message_receipts_user_id" ON "login_message_receipts" ("user_id");
