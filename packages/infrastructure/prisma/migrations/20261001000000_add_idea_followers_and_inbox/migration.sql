-- ---------------------------------------------------------------------------
-- Idea followers and the notification inbox (SPEC/decisions.md 2026-10-01, the
-- fifth amendment to the S0.2 schema freeze; SPEC/20-feature-idea-following.md
-- rules 36-39).
--
-- `idea_followers` is shaped like `idea_upvotes`. `notification_events` gains
-- read state and the new status's name, captured when a status event is
-- written, and a (recipient, newest first) index that serves the inbox list,
-- the unread count and the 90-day window - which makes the recipient-only
-- index redundant, so it goes.
--
-- The backfill makes the author and every current assignee of each idea that
-- is not soft-deleted a follower, so existing ideas keep today's recipients.
-- The `JOIN users` is there because `ideas.author_user_id` has no foreign key.
-- Existing notifications stay unread.
--
-- Adding an enum value inside the migration's transaction is allowed; nothing
-- below uses it, which is the one thing Postgres forbids in the same transaction.
-- ---------------------------------------------------------------------------

ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'IdeaEdited';

CREATE TABLE "idea_followers" (
    "id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_idea_followers" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ux_idea_followers_idea_id_user_id" ON "idea_followers"("idea_id", "user_id");

CREATE INDEX "IX_idea_followers_user_id" ON "idea_followers"("user_id");

ALTER TABLE "idea_followers" ADD CONSTRAINT "FK_idea_followers_ideas_idea_id" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "idea_followers" ADD CONSTRAINT "FK_idea_followers_users_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "notification_events" ADD COLUMN "read_at_utc" TIMESTAMPTZ(6);

ALTER TABLE "notification_events" ADD COLUMN "status_name" VARCHAR(100);

DROP INDEX "ix_notification_events_recipient_user_id";

CREATE INDEX "ix_notification_events_recipient_user_id_occurred_at_utc" ON "notification_events"("recipient_user_id", "occurred_at_utc" DESC);

INSERT INTO idea_followers (id, idea_id, user_id, created_at_utc)
SELECT gen_random_uuid(), followed.idea_id, followed.user_id, now()
FROM (
    SELECT i.id AS idea_id, i.author_user_id AS user_id
    FROM ideas AS i
    JOIN users AS author ON author.id = i.author_user_id
    WHERE i.is_deleted = FALSE
    UNION
    SELECT ia.idea_id, ia.user_id
    FROM idea_assignees AS ia
    JOIN ideas AS i ON i.id = ia.idea_id
    WHERE i.is_deleted = FALSE
) AS followed;
