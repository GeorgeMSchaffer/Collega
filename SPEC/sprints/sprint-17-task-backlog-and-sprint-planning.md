# Task Backlog and Sprint Planning: Slice Plan

> **Status: PLANNED 2026-10-22, not started. Owner to approve the order before slice 322 begins.** Slice numbers continue from 321 (allowed idea types) and may shift if other work lands first.

**Goal:** Tasks get a home (Backlog tab and board panel), sprints are created and planned from them (task picker, planning page, Tasks page), and an idea's owner can schedule its tasks.

**Spec:** `SPEC/20-feature-task-backlog-and-sprint-planning.md` (approved 2026-10-22; requirements TB-1 to TB-10). **Contracts (written, owner review pending):** `contracts/sprints.md` "Backlog and sprint planning", `contracts/ideas.md` (`hideFinal`, org-list `sprintId`, `POST /boards/{boardId}/tasks`). **Decision:** `SPEC/decisions.md` 2026-10-22. **Comps:** `SPEC/mockups/comp-w-tasks-and-sprint-planning.html`, `comp-w-alternates-tasks-and-sprint-planning.html`.

**Not changed:** the schema (no S0.2 amendment: every field used exists; confirm in 322), the lock, blocker and Effort rules, Outcomes, org-wide legacy sprints.

## Constraints

- Root `AGENTS.md` and the package's own. Business rules in domain/application, never controllers or components; `apps/web` talks HTTP only.
- One branch per slice, `feature/<NNN>-<desc>`, stacked on the previous slice in the primary checkout; Code Reviewer approves each before merge into `dev`; the owner approves the push.
- A QA slice is written by a different agent from the slice it covers.
- `pnpm check` is the gate. UI slices are also checked in the browser pane (dev server, console, the flow exercised) before they are called done.
- `contracts/*` are read, not edited, except to fix an error the build finds; any such edit is flagged to the owner.

## Order

| # | Slice | Covers | Needs | Role |
|---|---|---|---|---|
| 322 | `POST /boards/{id}/tasks`; `hideFinal` and org-list `sprintId` | TB-1, TB-2, TB-8 (data) | none | Backend |
| 323 | QA for 322 | same | 322 | QA |
| 324 | `ideaIds` on board sprint create; `PUT /boards/{id}/sprint-assignments` with optional `statusId` | TB-3, TB-4, TB-5, TB-7 (data) | 322 | Backend |
| 325 | QA for 324 | same | 324 | QA |
| 326 | Board tabs (Board, Backlog, Sprints), Backlog list, New task drawer, sprints-off state | TB-1, TB-2, TB-6, TB-10 | 322 | UI |
| 327 | QA for 326 (Playwright path: add a standalone task and a parented task) | same | 326 | QA |
| 328 | Create-sprint task picker; Backlog bulk bar "Add to sprint" / "Add to new sprint…" | TB-3, TB-4, TB-5 | 324, 326 | UI |
| 329 | QA for 328 | same | 328 | QA |
| 330 | Backlog panel toggle on the board; lane drop sets sprint and status | TB-7 | 324, 326 | UI |
| 331 | QA for 330 | same | 330 | QA |
| 332 | Sprints tab list and sprint planning page (add, remove, inline add, start) | TB-5 | 324, 326 | UI |
| 333 | QA for 332 | same | 332 | QA |
| 334 | Tasks page across work boards, bulk "Move to sprint" | TB-8 | 322, 324 | UI |
| 335 | QA for 334 | same | 334 | QA |
| 336 | "Schedule…" in the parent idea's Tasks section | TB-9 | 324 | UI |
| 337 | QA for 336, then one end-to-end path across all surfaces | TB-1 to TB-10 | 336 | QA |

**Parallelism:** 324 (backend, sprint and idea services) and 326 (UI, board page) touch disjoint files and may run together after 322 merges; neither result reshapes the other. Everything else is sequential. 330 to 336 are independent of each other once 324 and 326 are in, and may be reordered by the owner (the comp review suggested the Tasks page last).

## Slices

### 322 Backend: task create from a work board, backlog filters
- `POST /boards/{boardId}/tasks` per `contracts/ideas.md`: title, optional description, assignees, tags, `parentIdeaId`, `sprintId`. With a parent it reuses the `board-tasks` create path (one code path, not a copy); without, a standalone card. `422` `boardIsNotAWorkBoard` when no lane references the board. A `sprintId` needs an admin (`403` keyed `sprintId`).
- `hideFinal` on `GET /boards/{boardId}/ideas`; `sprintId` and `hideFinal` on `GET /organizations/{organizationId}/ideas`.
- **Verify first:** no migration is needed; the task stores the organization's default idea type and business impact exactly as `board-tasks` does.
- **Done when:** the routes behave as the contract states, with the audit event `BoardTaskCreated` on both create paths; `pnpm check` green.

### 323 QA for 322
Cover: standalone create; parented create equals `board-tasks`; non-work board `422`; Read Only and direct Site Admin `403`; non-admin `sprintId` `403`; `hideFinal` leaves out only final lanes of the card's own board; org-list `sprintId=none` and `hideFinal` compose with `boardId` and `scope=assigned`.

### 324 Backend: sprint create with tasks, bulk assignment
- `ideaIds` on `POST /boards/{boardId}/sprints`: atomic; `400` keyed `ideaIds`, `422` `sprintItemOnOtherBoard`, new `422` `sprintItemAlreadyAssigned`.
- `PUT /boards/{boardId}/sprint-assignments`: add, move, return to backlog; optional `statusId` through the **one** existing status-move path (lock, blockers, audit); all or nothing; no-ops write no audit event.
- **Done when:** a failing item rolls back the whole request and the error names its key; the single `PUT /ideas/{id}/sprint` is unchanged.

### 325 QA for 324
Cover: all-or-nothing on create and on assignment; completed sprint refused; other board's item refused; item already in another sprint refused on create but moved by assignment; `statusId` with `null` sprint `400`; blocked task dropped past its first lane `taskBlocked` and rolled back; audit events per changed item only; User `403`.

### 326 UI: tabs, Backlog, New task
- Board page gets **Board | Backlog | Sprints** tabs; Backlog is the default for a work board; Sprints shows only when `sprintsEnabled`.
- Backlog list: search, parent-idea filter, assignee and tag filters, selection. "+ New task" drawer per comp W screen 2 (parent choices are ideas in a lane that references this board). Empty and sprints-off states per comp W screen 5.
- Role gating: Read Only sees no controls; Users may add tasks; sprint controls admin-only (TB-10).
- **Done when:** the flow works in the browser at desktop and mobile width, in Graphite and one light theme; keyboard reachable.

### 328 UI: sprint picker and bulk bar
- Create-sprint drawer ends with the unassigned-task picker (search, parent filter, "Select all of this idea's tasks", blocker hint, "N selected"); "Create sprint with N tasks".
- Backlog selection bar: "Add to <Active/Planned sprint>" and "Add to new sprint…" (opens the drawer with those ticked). Admin only.
- **Done when:** one invalid id surfaces as a form error and nothing is created.

### 330 UI: Backlog panel and lane drop
- A toggle shows the same Backlog list as a collapsible panel beside the lanes (bottom sheet on mobile).
- **Drop on a lane** calls the assignment route with the Active sprint and that lane's `statusId`; **Add** sends no `statusId`. No Active sprint, a blocked task, or a non-admin: the lane refuses the drop with the reason, never a bounce. Keyboard path: Add button and the existing arrows.
- **Done when:** a drop sets sprint and status in one write, and a refused move leaves the task in the backlog.

### 332 UI: Sprints tab and planning page
- Sprints list with "N tasks waiting"; "+ New sprint"; planning page with Backlog and "In this sprint" columns, Add and Remove buttons, inline new-task line, Start sprint.
- **Done when:** removing returns a task to the Backlog; counts update without a reload.

### 334 UI: Tasks page
- New "Tasks" destination listing tasks across work boards (`boardId` from `referencedByBoardIds`), tabs Backlog, My tasks (`scope=assigned`), In sprint, All; "Move to sprint" enabled for one board's selection only. Not shown to a Site Admin acting directly.
- **Done when:** selecting tasks from two boards disables the action with the stated reason.

### 336 UI: Schedule from the idea
- The parent drawer's Tasks section shows each task's sprint and "Schedule…" for unscheduled tasks: pick a Planned/Active sprint or "Create a new sprint…" with those tasks ticked. Hidden from non-admins.

## Review Focus

- A status move reimplemented inside the assignment instead of reusing the one path (lock, blockers, audit would diverge).
- Partial writes: a refused item leaving others assigned.
- A task from another board, or a Completed sprint, accepted by the picker or the drop.
- The drop changing status without the sprint, or the sprint without the status.
- A non-admin seeing or reaching a sprint control; Read Only seeing a "+ New task".
- Backlog listing finished work, or hiding a standalone card because it has no parent.
- Counts (tab badge, "N waiting") reading stale after an add, remove or create.

## Definition of done (per `SPEC/90-definition-of-done.md`)

Every slice: reviewer approved, `pnpm check` green, merged to `dev`, tracker row updated. UI slices: exercised in the browser pane. The feature: slice 337's end-to-end path passes, comp W's five screens match the built UI or the differences are recorded in `SPEC/decisions.md`, and the contracts section "Backlog and sprint planning (proposed)" loses "proposed" once the owner has reviewed it.
