# Feature: Task Backlog and Sprint Planning

> **Status: APPROVED by the owner 2026-10-22 (`SPEC/decisions.md` "Tasks get a Backlog and sprints are planned from it"). Nothing is built; contract gaps below are unspecified.** Extends `SPEC/20-feature-board-references.md` (tasks, per-board sprints); changes none of its rules. 
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
- **TB-4 Create sprint with tasks is atomic.** Creating a sprint with `taskIds` saves the sprint and all assignments, or none. Picking nothing is allowed.
  *Oracle:* one invalid id fails the whole create and leaves no sprint.
- **TB-5 Add and remove.** Tasks can be added to a Planned or Active sprint of their board, singly or in bulk, and removed back to the backlog. Removal is the same state as completing the sprint with the task unfinished.
- **TB-6 Sprints off.** A board with `sprints_enabled` false shows Board and Backlog only; no sprint controls.
- **TB-7 Panel (D).** The panel and the tab render the same list and the same actions. **Dropping a panel task on a lane puts it in the Active sprint and sets its status to that lane** (owner, 2026-10-22). The drop is the board's own status move, so every existing rule applies and a refusal leaves the task in the backlog: blockers (`taskBlocked`), the lane rules for a task. The **Add** button, which has no lane, adds to the sprint and leaves status unchanged. With no Active sprint, lanes refuse a panel drop ("No active sprint").
  *Oracle:* drop on "In progress" gives sprint = Active and status = In progress in one write; a blocked task dropped past its first lane is refused and stays unscheduled.
- **TB-8 Tasks page (C).** Lists tasks across the work boards the viewer can read. "Move to sprint" is enabled only when the selection is from one board.
- **TB-9 Schedule from the idea (E).** The Tasks section shows each task's sprint and offers "Schedule…" for the unscheduled ones, choosing an existing sprint or opening the TB-4 create flow with those tasks ticked.
- **TB-10 Roles.** Org Admin: everything. User: sees every surface, may add a standalone or parented task (as in the parent drawer today); sprint creation and assignment stay admin-only, per `contracts/sprints.md`. Read Only: sees, no controls. Site Admin: View As only.

## Contract gaps this needs (from `decisions.md` 2026-10-19, items a to d)

1. Board idea items carry `sprintId` and sprint name (chips, panel, Backlog column).
2. A board-task sprint assignment route: single (`PUT /ideas/{id}/sprint` generalised off the retired Delivery phase) and bulk add/remove on a sprint.
3. `taskIds` on sprint create (TB-4).
4. A cross-board task list read for TB-8 (new; slice 5 only).
Backlog read and per-board sprints already exist in `contracts/sprints.md` "Sprints per board".

## Slices (sequential; each verifiable alone; QA follows each)

1. **Backend:** gaps 1 to 3 plus tests for TB-3 to TB-5.
2. **UI A+D:** Backlog tab, New task drawer, Backlog panel toggle (TB-1, 2, 6, 7).
3. **UI A2:** create-sprint picker and "Add to new sprint…" (TB-3, 4).
4. **UI B:** sprint planning page (TB-5).
5. **Backend then UI C:** cross-board read, Tasks page (TB-8).
6. **UI E:** Schedule step in the parent drawer (TB-9).

Gate for each: `pnpm check`; Playwright path for the new surface; browser check per the project memory.

## Open questions for the owner

None. Confirmed 2026-10-22: a lane drop sets status, Add leaves it alone, no Active sprint refuses the drop; Users add tasks and only Org Admins plan sprints; the tab is the default and the panel a toggle. Slice order is the owner's to change.
