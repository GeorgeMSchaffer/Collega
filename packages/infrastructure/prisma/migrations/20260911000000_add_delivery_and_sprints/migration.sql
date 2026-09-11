-- ---------------------------------------------------------------------------
-- Issues-and-Delivery, Slice 1. The amendment to the S0.2 schema freeze that
-- SPEC/decisions.md 2026-09-11 records; the freeze otherwise stands.
--
-- Additive only. Nothing existing is dropped, renamed or retyped, and the one
-- NOT NULL column added to a populated table carries a DEFAULT - so every idea
-- already in the database backfills to 'Discovery' as it is added, in the same
-- statement, with no separate UPDATE to get wrong. That is the whole backward
-- compatibility story: ideation boards filter to Discovery and therefore show
-- exactly what they showed before, no sprint exists so the delivery surfaces
-- open empty, and no existing row gains a task.
--
-- The DEFAULT stays on the column afterwards rather than being dropped, which
-- is what schema.prisma's `@default(Discovery)` declares - keeping the two in
-- step, so the next `prisma db pull` reports no drift.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('Pending', 'Scoping', 'Development', 'Review', 'Complete');

-- CreateEnum
CREATE TYPE "EffortLevel" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "IdeaPhase" AS ENUM ('Discovery', 'Delivery');

-- CreateEnum
CREATE TYPE "IssueTaskState" AS ENUM ('NotStarted', 'InProgress', 'Done');

-- CreateEnum
CREATE TYPE "SprintState" AS ENUM ('Planned', 'Active', 'Completed');

-- AlterTable
ALTER TABLE "ideas" ADD COLUMN     "delivery_status" "DeliveryStatus",
ADD COLUMN     "effort" "EffortLevel",
ADD COLUMN     "phase" "IdeaPhase" NOT NULL DEFAULT 'Discovery',
ADD COLUMN     "promoted_at_utc" TIMESTAMPTZ(6),
ADD COLUMN     "promoted_by_user_id" UUID,
ADD COLUMN     "sprint_id" UUID,
ADD COLUMN     "upvote_count_at_promotion" INTEGER;

-- CreateTable
CREATE TABLE "issue_tasks" (
    "id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "assignee_user_id" UUID,
    "state" "IssueTaskState" NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "completed_at_utc" TIMESTAMPTZ(6),
    "completed_by_user_id" UUID,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_issue_tasks" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprints" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "goal" VARCHAR(500),
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "owner_user_id" UUID,
    "state" "SprintState" NOT NULL,
    "is_deleted" BOOLEAN NOT NULL,
    "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "updated_at_utc" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "PK_sprints" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_issue_tasks_idea_id_sort_order" ON "issue_tasks"("idea_id", "sort_order");

-- CreateIndex
CREATE INDEX "ix_sprints_organization_id_state" ON "sprints"("organization_id", "state");

-- CreateIndex
CREATE INDEX "ix_ideas_organization_id_phase" ON "ideas"("organization_id", "phase");

-- CreateIndex
CREATE INDEX "ix_ideas_sprint_id" ON "ideas"("sprint_id");

-- Deleting a sprint must never take an Issue with it: RESTRICT forces the
-- application to unassign its Issues back to the backlog first, which is the
-- deterministic carry-over the sprint lifecycle promises.
-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "FK_ideas_sprints_sprint_id" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- The one place CASCADE is correct in this feature: a checklist step has no
-- meaning apart from the Issue it belongs to.
-- AddForeignKey
ALTER TABLE "issue_tasks" ADD CONSTRAINT "FK_issue_tasks_ideas_idea_id" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "FK_sprints_organizations_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

