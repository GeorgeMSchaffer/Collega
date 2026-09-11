-- ---------------------------------------------------------------------------
-- The three notification types Issues-and-Delivery Slice 1 writes
-- (SPEC/20-feature-issues-and-delivery.md "Audit & Notifications").
--
-- `AddDeliveryAndSprints` added the phase columns and the two new tables but
-- left this enum at its four ideation values, so the promotion, delivery-status
-- and task-assignment notifications the spec requires had nowhere to be stored.
-- Adding a value to a Postgres enum is additive and rewrites no row: existing
-- notification_events rows are untouched and every existing value still reads
-- back the same.
--
-- Audit event types need no migration - audit_events.event_type is text.
-- ---------------------------------------------------------------------------

ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'IdeaPromoted';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'IssueDeliveryStatusChanged';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'IssueTaskAssigned';
