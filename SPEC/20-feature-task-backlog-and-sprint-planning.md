# Feature: Task Backlog and Sprint Planning

> **Status: APPROVED by the owner 2026-10-22 (`SPEC/decisions.md` "Tasks get a Backlog and sprints are planned from it"). Built in Sprint 17 (slices 322 to 337). Scheduling by task editors (TB-4, TB-5, TB-7, TB-9, TB-10) was widened later the same day (`SPEC/decisions.md` "Anyone who can edit a task may schedule it") and is not built yet.** Extends `SPEC/20-feature-board-references.md` (tasks, per-board sprints); changes none of its rules. 
> **Comps (approved by the 2026-10-22 decision; the spec governs where they differ):** `SPEC/mockups/comp-w-tasks-and-sprint-planning.html` (A) and `comp-w-alternates-tasks-and-sprint-planning.html` (B to E).

## Problem

A task is a card on a work board, but it can only be created from its parent idea's drawer, and a sprint is created from a bare form. There is no place to add or manage tasks that have no parent or span several ideas, and a sprint cannot be filled from the tasks still waiting.

## Intent

Give tasks one home and make sprint planning start from it. The owner chose to build **all five** comp W approaches (2026-10-22). They are five views over the same two lists (unassigned tasks, a sprint's tasks), so each is a slice, not a separate model.

## Scope

| Id | Surface | Comp |
|---|---|---|
| A | **Backlog tab** on each work board; "+ New task"; "Add to sprint" bulk bar | W A |
| D | The same Backlog list shown as a **collapsible panel** beside the board lanes | alt D |
| A2 | **Create sprint** drawer ends with a picker of unassigned tasks; "Add to new sprint…" from the Backlog | W A, frame 3 |
| B | **Sprint planning page**: backlog and sprint side by side, inline add | alt B |
| C | **Tasks page** across all work boards (Backlog, My tasks, In sprint, All) with bulk "Move to sprint" | alt C |
| E | **Schedule…** step in the parent idea's Tasks section | alt E |

## Non-goals

Story points, velocity, capacity limits, drag as the only path, automatic scheduling, a second task entity, any change to the lock, blocker or Effort rules.

## Requirements

- **TB-1 Backlog definition.** A board's backlog is its live tasks and standalone cards with no sprint (`sprintId=none`, existing read). A card in a final lane is not shown by default.
  *Scenario:* a task returned from a completed sprint reappears in the backlog. *Oracle:* list read after completing a sprint.
- **TB-2 New task from the backlog.** Title required; optional parent idea, description, assignees, tags, sprint. Parent choices are ideas sitting in a lane that references this board; none chosen makes a standalone card. Same card and audit as a task made from the parent drawer.
  *Oracle:* a parent outside a reference lane is not offered and the server refuses it with the existing error.
- **TB-3 Sprint holds one board's tasks.** Picker and every assignment list only that board's tasks; another board's is refused `sprintItemOnOtherBoard`. A blocked task may be picked; its blockers are shown.
- **TB-4 Create sprint with tasks is atomic.** Creating a sprint with `taskIds` saves the sprint and all assignments, or none. Picking nothing is allowed. Creating a sprint is an Org Admin act (TB-10), so only an Org Admin sees this picker.
  *Oracle:* one invalid id fails the whole create and leaves no sprint.
- **TB-5 Add and remove.** Tasks can be added to a Planned or Active sprint of their board, singly or in bulk, and removed back to the backlog, by anyone who may edit each task (TB-10). The server refuses a whole request containing a task the caller cannot edit, so a selection with such a task disables Add and Remove with the reason ("You can only schedule tasks you created, unless you are an Org Admin"). Removal is the same state as completing the sprint with the task unfinished.
- **TB-6 Sprints off.** A board with `sprints_enabled` false shows Board and Backlog only; no sprint controls.
- **TB-7 Panel (D).** The panel and the tab render the same list and the same actions. **Dropping a panel task on a lane puts it in the Active sprint and sets its status to that lane** (owner, 2026-10-22). The drop is the board's own status move, so every existing rule applies and a refusal leaves the task in the backlog: blockers (`taskBlocked`), the lane rules for a task. The **Add** button, which has no lane, adds to the sprint and leaves status unchanged. With no Active sprint, lanes refuse a panel drop ("No active sprint"). A lane drop needs both permissions: the right to edit the task (it schedules) and the board's status-move right, which every Org Admin and User has and Read Only never (`SPEC/decisions.md` 2026-10-22 "Users always move ideas between statuses", unchanged); lacking either refuses the whole drop.
  *Oracle:* drop on "In progress" gives sprint = Active and status = In progress in one write; a blocked task dropped past its first lane is refused and stays unscheduled.
- **TB-8 Tasks page (C).** Lists tasks across the work boards the viewer can read. "Move to sprint" is enabled only when the selection is from one board and every selected task is one the viewer may edit; otherwise it is disabled with the reason.
- **TB-9 Schedule from the idea (E).** The Tasks section shows each task's sprint and offers "Schedule…" for the unscheduled ones the viewer may edit, choosing an existing Planned or Active sprint of the task's board; an Org Admin may instead open the TB-4 create flow with those tasks ticked (a User is not offered it, since creating a sprint is admin-only). For a User on a board with no Planned or Active sprint, Schedule… is shown disabled with the reason ("No open sprint. An Org Admin creates one.").
- **TB-10 Roles.** *May edit a task* means the app's existing task-edit rule (`canAdministerIdeaContent` in `packages/application`, "Only the author or an Org Admin can edit this task"): the task's author, or an Org Admin of its organization. Read Only never; a Site Admin acting directly never (View As acts as the target).
  - **Anyone who may edit a task may schedule it** into a Planned or Active sprint of its board, or return it to the backlog: Schedule… in the idea drawer, Add and Remove on the planning page and the Backlog bar, the Tasks page's "Move to sprint", a `sprintId` on a new task, `PUT /boards/{boardId}/sprint-assignments`. A new task's author is its creator, so any User may create a task straight into a sprint.
  - **Org Admin only, unchanged:** creating a sprint (including with tasks, TB-4), editing it, Start, Complete and delete, and the Sprints tab's "+ New sprint".
  - **Lane drop:** needs edit rights on the task and the status-move right above; a User may drop a task they author, and may not drop one they cannot edit.
  - User also adds a standalone or parented task. Read Only: sees, no controls. Site Admin: View As only.
  - Bulk requests are all or nothing: one task the caller may not edit refuses the whole request (`403`).

## Contract gaps (written 2026-10-22, owner to review; not built)

Checked against the contracts and code: sprint on board idea items, the `sprintId` filter, per-board sprint list/create and single assignment already exist. What was actually missing, now written:

1. `ideaIds` on `POST /boards/{boardId}/sprints`, atomic (TB-4). `contracts/sprints.md`.
2. `PUT /boards/{boardId}/sprint-assignments`, bulk add, move, remove, with optional `statusId` for the lane drop (TB-5, TB-7, TB-9). `contracts/sprints.md`.
3. `hideFinal` on the board list, and `sprintId` and `hideFinal` on the organization list, so the Tasks page (TB-8) needs **no new route** (work boards come from `referencedByBoardIds`). `contracts/ideas.md`.
4. `POST /boards/{boardId}/tasks`, because the board idea create requires idea-only fields a task lacks (TB-2). `contracts/ideas.md`.

Not needed after all: a sprint field on board items, and a cross-board task route.

## Slices (sequential; each verifiable alone; QA follows each)

1. **Backend:** gaps 1 to 4 plus tests for TB-1 to TB-5.
2. **UI A+D:** Backlog tab, New task drawer, Backlog panel toggle (TB-1, 2, 6, 7).
3. **UI A2:** create-sprint picker and "Add to new sprint…" (TB-3, 4).
4. **UI B:** sprint planning page (TB-5).
5. **UI C:** Tasks page (TB-8); backend is the `sprintId` and `hideFinal` params only.
6. **UI E:** Schedule step in the parent drawer (TB-9).

Gate for each: `pnpm check`; Playwright path for the new surface; browser check per the project memory.

## Open questions for the owner

None. Confirmed 2026-10-22: a lane drop sets status, Add leaves it alone, no Active sprint refuses the drop; Users add tasks, and anyone who may edit a task schedules it while only Org Admins create, start and complete sprints (widened later that day, TB-10); the tab is the default and the panel a toggle. Slice order is the owner's to change.
