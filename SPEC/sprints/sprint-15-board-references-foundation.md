# Board References — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rules that override the skill's defaults:** commits carry no reference to Claude, agents or code generation, and no `Co-Authored-By` line (`AGENTS.md`). An implementer does not write tests for its own code: tasks marked **QA** go to a separate QA agent (`AGENTS.md` "Working Rules"). Work on a `feature/<NNN>-<short-description>` branch off `dev`, one slice per branch, reviewed by `collega-reviewer` before it merges into `dev`. Pull and rebase before every push; `collega-53` is merging into `dev` concurrently.

**Goal:** Land the specification, the additive schema and the seed data for Board References, without removing or changing any existing Delivery behavior.

**Architecture:** Plan 1 is additive only. The Delivery phase, issue tasks, the fixed delivery statuses and the `/delivery` UI stay in place and keep working (the Backlog-add and quick-add slices being built by another session depend on them). New columns and one new table are added beside them; every new column is nullable or defaulted, so existing rows and code are untouched. Retiring Delivery is Plan 4, after the replacements exist.

**Tech Stack:** Prisma on PostgreSQL 16 with hand-written SQL migrations (`prisma migrate deploy`), Vitest, the seed modules under `packages/infrastructure/src/demo-seed`.

**Spec:** `SPEC/20-feature-board-references.md` (approved 2026-10-15). Supporting comps: `SPEC/mockups/comp-s-board-reference.html`, `comp-s-idea-and-outcome.html`.

## Global Constraints

- `SPEC/*.md` is canonical; a change to behavior or a contradiction of a recorded decision is recorded in `SPEC/decisions.md` first (this plan's Task 1).
- Slice numbers from **196** up (185–195 belong to the Backlog-add and quick-add work).
- Migrations are hand-written SQL in `packages/infrastructure/prisma/migrations/<YYYYMMDDHHMMSS>_<snake_case>/migration.sql`, with `schema.prisma` edited to match. The schema freeze is amended: this is the **ninth** amendment (the eighth was `20261013000000_allow_ideas_without_board`).
- SQL style: UPPERCASE keywords, lowercase table and column names, no `SELECT *`, meaningful aliases.
- Tests are hermetic: no network, no real clock, no randomness. Migration integration tests run only when `DATABASE_URL` is set and use a throwaway database.
- `pnpm check` (lint, typecheck, test, build) must be green before a slice is reviewed.
- Do not add dependencies.

## Review Focus

- A second board references the same target board: allowed (several parents may feed one task board).
- A lane pointing at its own board: refused by the database, not only the service.
- A board is deleted while a lane references it: refused (`ON DELETE RESTRICT`), the guard the spec requires.
- An idea named as its own parent, or a dependency of an idea on itself: refused by the database.
- Deleting an idea removes its dependency rows in both directions and leaves unrelated rows alone.
- Two boards in one organization with the same key prefix: refused; two boards in different organizations: allowed; two boards with no prefix yet: allowed (NULLs do not collide).
- Re-running the seed twice leaves one prefix per board and does not change ids or counts.

---

## File map

| File | Change | Task |
|---|---|---|
| `SPEC/decisions.md` | new entry + index line; supersession marks | 1 |
| `SPEC/20-feature-issues-and-delivery.md` | supersession banner | 1 |
| `SPEC/contracts/boards.md`, `ideas.md`, `sprints.md` | new "Board References" sections | 2 |
| `SPEC/contracts/idea-dependencies.md` | new | 2 |
| `SPEC/30-Contracts.md` | one index line | 2 |
| `packages/infrastructure/prisma/schema.prisma` | new columns, relations, model | 3 |
| `packages/infrastructure/prisma/migrations/20261015000000_add_board_references/migration.sql` | new | 3 |
| `packages/infrastructure/test/board-references-migration.integration.test.ts` | new | 4 (QA) |
| `packages/infrastructure/src/demo-seed/modules/boards-and-statuses.ts` | set `key_prefix` | 5 |
| `packages/infrastructure/test/demo-scenario.test.ts` | prefix uniqueness assertion | 5 (QA) |
| `SPEC/implementation-agent-tracker.md` | rows for 196–199 | 1, 3, 5 |

---

### Task 1 (slice 196, spec): Record the decision

**Files:**
- Modify: `SPEC/decisions.md` (index table and the top of the full entries)
- Modify: `SPEC/20-feature-issues-and-delivery.md` (top)
- Modify: `SPEC/20-feature-board-references.md` (line stating "second amendment")
- Modify: `SPEC/implementation-agent-tracker.md`

**Interfaces:**
- Produces: the decision heading `## 2026-10-15 — Board References replace the Delivery phase`, which later tasks and the contracts link to.

- [ ] **Step 1: Branch and sync**

```bash
git fetch origin && git switch dev && git pull --ff-only
git switch -c feature/196-board-references-decision
```

- [ ] **Step 2: Find the entries this supersedes**

```bash
grep -n -i "checklist\|Delivery phase\|promotion gate\|fixed delivery\|Backlog" SPEC/decisions.md | cut -c1-160
```

Expected: hits including `2026-10-15 | Issues can be added directly from the Backlog`, and entries about delivery statuses and Tasks. Note each heading; each gets the superseded mark in Step 4.

- [ ] **Step 3: Add the index line and the entry**

In the index table of `SPEC/decisions.md`, insert as the first row under the header:

```markdown
| 2026-10-15 | Board References replace the Delivery phase | active | full below |
```

Directly above the first full entry (`## 2026-10-15 — Issues can be added directly from the Backlog`), insert:

```markdown
## 2026-10-15 — Board References replace the Delivery phase

> Supersedes in part: `20-feature-issues-and-delivery.md` Slice 1 (the Discovery/Delivery phase, the promotion gate as a separate step, the fixed delivery status set, checklist Tasks, org-wide Sprints) and the Backlog-of-Issues model behind "Issues can be added directly from the Backlog". Outcomes (Slice 2) stands and is extended. Full design: `SPEC/20-feature-board-references.md`.

**Decided by the user.** An idea has one lifecycle on one board. A board's lane may be a **Board Reference**: it references another board, and entering it lets the idea spawn **tasks** on that board. A task is an `ideas` row on the child board with `parent_idea_id`, so it has the child board's statuses, assignees, tags and (optionally) sprint. Tasks run in parallel unless one names another as a blocker. When every task is in a final lane the parent is offered the move to its next lane; a person confirms, nothing moves automatically. Sprints become a per-board option and hold tasks from many ideas. A board marks done lanes with `board_swimlanes.is_final`. Items are keyed `PREFIX-n` per board. Value is typed metrics, projected then realized, summed per Outcome.

**Why.** The old split made execution a second, narrower tool: tasks had no status flow, could not be sequenced, and could not be time-boxed with the team's other work. One item type reuses every board mechanism instead of rebuilding them for a second entity.

**Consequences.**
- The S0.2 schema freeze is amended a ninth time (additive columns and one table in Plan 1; the drops come with Plan 4).
- Delivery code stays in place and working until the replacements exist; Plan 4 retires it.
- The 17 Outcomes questions in `contracts/outcomes.md` are answered in `20-feature-board-references.md` and copied into the contract by the Outcomes backend slice.
- Entry to a reference lane requires Effort; no per-lane rules.

---
```

- [ ] **Step 4: Mark the superseded entries**

For each heading noted in Step 2, add directly beneath it the line below, and change that entry's index status from `active` to `superseded`:

```markdown
> **Superseded 2026-10-15** by "Board References replace the Delivery phase".
```

If an entry is only superseded in part, use `amended` and the sentence `> **Amended 2026-10-15**: <the part that changed> is replaced by "Board References replace the Delivery phase".`

- [ ] **Step 5: Add the banner to the old feature spec**

Insert directly under the title line of `SPEC/20-feature-issues-and-delivery.md`:

```markdown
> **Superseded in part, 2026-10-15.** Slice 1 (phase model, promotion gate, fixed delivery statuses, checklist Tasks, org-wide Sprints) is replaced by `SPEC/20-feature-board-references.md`. Slice 2 (Outcomes) stands and is extended there. Until Plan 4 of that spec ships, this document still describes the running code.
```

- [ ] **Step 6: Correct the amendment count in the new spec**

In `SPEC/20-feature-board-references.md`, replace `needs a second amendment` with `is amended a ninth time (the eighth was ideas with no board, 2026-10-13)`.

- [ ] **Step 7: Tracker rows**

Add rows for slices 196 (this), 197 (contracts), 198 (schema), 199 (migration test), 200 (seed) to the Open work table in `SPEC/implementation-agent-tracker.md`, each `Not started`, detail pointing at `SPEC/sprints/sprint-15-board-references-foundation.md`.

- [ ] **Step 8: Verify and commit**

```bash
grep -c "Board References replace the Delivery phase" SPEC/decisions.md
git add SPEC/decisions.md SPEC/20-feature-issues-and-delivery.md SPEC/20-feature-board-references.md SPEC/implementation-agent-tracker.md
git commit -m "Record that Board References replace the Delivery phase"
```

Expected: the grep prints `2` or more (index line, heading, and each superseded mark).

---

### Task 2 (slice 197, spec): Write the contracts

**Files:**
- Modify: `SPEC/contracts/boards.md`, `SPEC/contracts/ideas.md`, `SPEC/contracts/sprints.md`, `SPEC/30-Contracts.md`
- Create: `SPEC/contracts/idea-dependencies.md`

**Interfaces:**
- Produces: field names and rules Plan 2 implements exactly: `references_board_id` / `referencesBoardId`, `is_final` / `isFinal`, `sprintsEnabled`, `ideaFeaturesEnabled`, `keyPrefix`, `parentIdeaId`, `itemKey`, `blockedBy`, `boardId` (sprint).

- [ ] **Step 1: Branch**

```bash
git switch dev && git pull --ff-only && git switch -c feature/197-board-references-contracts
```

- [ ] **Step 2: Read the conventions each file follows**

```bash
sed -n 1,40p SPEC/contracts/boards.md
grep -n "^## \|^### " SPEC/contracts/boards.md SPEC/contracts/ideas.md SPEC/contracts/sprints.md | head -60
```

Place each addition below under a new heading at the end of the file, using the same bullet style (Roles, Item fields, Errors, Rules) as the surrounding sections.

- [ ] **Step 3: Append to `SPEC/contracts/boards.md`**

```markdown
## Board References (planned 2026-10-15)

*Specified in `SPEC/20-feature-board-references.md`. Not built until Plan 2. Existing routes keep their shapes; the fields below are added.*

- **Board item fields (added):**
  - `keyPrefix` string or `null`, 2 to 10 characters `A-Z0-9`, upper-cased on store; unique per organization among boards that have one.
  - `sprintsEnabled` boolean, default `false`.
  - `ideaFeaturesEnabled` boolean, default `true`; default `false` for a board when it is first named as a reference target.
- **Lane item fields (added) on every lane in a board read and write:**
  - `isFinal` boolean, default `false`. A board may have several final lanes.
  - `referencesBoardId` GUID or `null`: the board whose tasks this lane hands work to.
- **Rules:**
  - A lane may not reference its own board.
  - A board that is the target of a reference may not itself contain a reference lane, and a board with a reference lane may not be a target (one level at launch).
  - A lane with ideas in it cannot have `referencesBoardId` changed or removed, and cannot be removed.
  - A board named as a reference target cannot be archived while a lane references it.
  - Saving lanes with `referencesBoardId` set to a board outside the organization, an archived board, or a missing board is refused.
- **Errors:** `422` for each rule above, using the shared error model; message keys named after the rule (`laneReferencesOwnBoard`, `referenceChainNotAllowed`, `laneInUse`, `referenceTargetArchived`).
```

- [ ] **Step 4: Append to `SPEC/contracts/ideas.md`**

```markdown
## Tasks and item keys (planned 2026-10-15)

*Specified in `SPEC/20-feature-board-references.md`. Not built until Plan 2.*

- **Item fields (added):**
  - `itemKey` string or `null`: `<board keyPrefix>-<itemNumber>`, e.g. `CI-19`; `null` for an item on a board with no prefix or no board. Assigned once, never reused.
  - `parentIdeaId` GUID or `null`: set on a task. A task's board must be the board referenced by a lane the parent currently sits in when the task is created.
  - `blockedBy` array of `{ ideaId, itemKey, isFinal }`: the tasks that must be final before this one can leave its board's first lane.
  - `taskCounts` object `{ total, done }` on an item whose lane references a board: `done` counts children in a final lane.
- **Routes (added):**
  - `POST /api/v1/ideas/{ideaId}/tasks` creates a task on the referenced board. Body: the idea create body, minus `boardId`. Success `201` with the task.
  - `PUT /api/v1/ideas/{ideaId}/blocked-by` replaces the blocker set. Body `{ "ideaIds": [...] }`. Details in `contracts/idea-dependencies.md`.
- **Rules:**
  - Moving an idea into a reference lane requires `effort` to be set; otherwise `422` (`effortRequiredForReferenceLane`).
  - A task cannot itself be a parent (no sub-tasks at launch) and cannot be grouped under an Outcome; both `422`.
  - Moving an idea out of a reference lane with open tasks is allowed and does not touch the tasks.
  - A task cannot leave its board's first lane while any blocker is not in a final lane; `422` (`taskBlocked`).
```

- [ ] **Step 5: Append to `SPEC/contracts/sprints.md`**

```markdown
## Sprints per board (planned 2026-10-15)

*Specified in `SPEC/20-feature-board-references.md`. Not built until Plan 2.*

- **Item field (added):** `boardId` GUID or `null`. `null` is a sprint from before this change; Plan 4 removes them.
- **Routes (added):** `GET/POST /api/v1/boards/{boardId}/sprints` list and create a sprint on a board whose `sprintsEnabled` is true; existing `.../organizations/{orgId}/sprints/{id}` routes keep working for reads, start, complete and delete.
- **Rules:**
  - Creating a sprint on a board with `sprintsEnabled` false is refused with `422` (`sprintsNotEnabled`).
  - A sprint holds items from its own board only; an item from another board is refused with `422`.
  - Completing a sprint returns every item not in a final lane to the backlog (sprint cleared), replacing the delivery-status rule.
```

- [ ] **Step 6: Create `SPEC/contracts/idea-dependencies.md`**

```markdown
# Contracts: idea dependencies

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md). *Planned 2026-10-15; specified in `SPEC/20-feature-board-references.md`.*

An **idea dependency** says one item cannot start until another is final. Both items are on the same board. No dependency means parallel.

### `PUT /api/v1/ideas/{ideaId}/blocked-by`

- **Roles:** anyone who may edit the item. Read Only is refused with `403`.
- **Body:** `{ "ideaIds": ["<guid>", ...] }`, the complete blocker set; `[]` clears it.
- **Success:** `200` with the item (`blockedBy` as in `contracts/ideas.md`).
- **Errors:** `401`; `403`; `404` the item or a named blocker does not exist or is outside caller scope; `422` for any of: a blocker equal to the item (`blockerIsSelf`), a blocker on another board (`blockerOnOtherBoard`), a set that would form a cycle (`dependencyCycle`).
- **Rules:** replacing the set is atomic. Deleting an item removes its dependencies in both directions. Adding a blocker to a task that has already left its first lane is allowed; it only affects later moves.
```

- [ ] **Step 7: Index line and commit**

Add to the contract index in `SPEC/30-Contracts.md`, in the same style as its neighbours: ``- `contracts/idea-dependencies.md` — blocked-by sets between items on one board (planned).``

```bash
git add SPEC/contracts SPEC/30-Contracts.md
git commit -m "Specify the Board References contracts"
```

---

### Task 3 (slice 198, backend): Additive schema and migration

**Files:**
- Modify: `packages/infrastructure/prisma/schema.prisma` (`board_swimlanes` 66-76, `boards` 78-94, `ideas` 329-378, `sprints` 503-521)
- Create: `packages/infrastructure/prisma/migrations/20261015000000_add_board_references/migration.sql`

**Interfaces:**
- Produces (columns, snake_case as in Prisma): `board_swimlanes.references_board_id uuid null`, `board_swimlanes.is_final boolean not null default false`; `boards.sprints_enabled boolean not null default false`, `boards.idea_features_enabled boolean not null default true`, `boards.key_prefix varchar(10) null`, `boards.next_item_number integer not null default 1`; `ideas.parent_idea_id uuid null`, `ideas.item_number integer null`; `sprints.board_id uuid null`; table `idea_dependencies(blocked_idea_id, blocker_idea_id, created_at_utc)`.
- Constraint names Task 4 asserts: `ck_board_swimlanes_no_self_reference`, `ck_ideas_no_self_parent`, `ck_idea_dependencies_no_self`, `ux_boards_organization_id_key_prefix`, `ux_ideas_board_id_item_number`.

- [ ] **Step 1: Branch**

```bash
git switch dev && git pull --ff-only && git switch -c feature/198-board-references-schema
```

- [ ] **Step 2: Write the migration**

Create `packages/infrastructure/prisma/migrations/20261015000000_add_board_references/migration.sql`:

```sql
-- ---------------------------------------------------------------------------
-- Board References (SPEC/decisions.md 2026-10-15, the ninth amendment to the
-- S0.2 schema freeze; SPEC/20-feature-board-references.md "Data model").
--
-- Additive only: every new column is nullable or defaulted and nothing is
-- dropped, so the Delivery phase, issue tasks and org-wide sprints keep working
-- until Plan 4 retires them. No backfill: existing boards have no key prefix
-- until the seed or an Org Admin sets one.
-- ---------------------------------------------------------------------------

-- AlterTable: a lane can reference another board, and can be a final ("done") lane
ALTER TABLE "board_swimlanes"
  ADD COLUMN "references_board_id" UUID,
  ADD COLUMN "is_final" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "board_swimlanes"
  ADD CONSTRAINT "FK_board_swimlanes_boards_references_board_id"
  FOREIGN KEY ("references_board_id") REFERENCES "boards" ("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "board_swimlanes"
  ADD CONSTRAINT "ck_board_swimlanes_no_self_reference"
  CHECK ("references_board_id" IS NULL OR "references_board_id" <> "board_id");

CREATE INDEX "ix_board_swimlanes_references_board_id" ON "board_swimlanes" ("references_board_id");

-- AlterTable: board options and the per-board item counter
ALTER TABLE "boards"
  ADD COLUMN "sprints_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "idea_features_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "key_prefix" VARCHAR(10),
  ADD COLUMN "next_item_number" INTEGER NOT NULL DEFAULT 1;

-- NULL prefixes never collide, so boards without a prefix coexist.
CREATE UNIQUE INDEX "ux_boards_organization_id_key_prefix" ON "boards" ("organization_id", "key_prefix");

-- AlterTable: a task points at its parent idea; both carry a per-board number
ALTER TABLE "ideas"
  ADD COLUMN "parent_idea_id" UUID,
  ADD COLUMN "item_number" INTEGER;

ALTER TABLE "ideas"
  ADD CONSTRAINT "FK_ideas_ideas_parent_idea_id"
  FOREIGN KEY ("parent_idea_id") REFERENCES "ideas" ("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ideas"
  ADD CONSTRAINT "ck_ideas_no_self_parent"
  CHECK ("parent_idea_id" IS NULL OR "parent_idea_id" <> "id");

CREATE INDEX "ix_ideas_parent_idea_id" ON "ideas" ("parent_idea_id");
CREATE UNIQUE INDEX "ux_ideas_board_id_item_number" ON "ideas" ("board_id", "item_number");

-- CreateTable: "blocked" waits on "blocker"; both are ideas on the same board
CREATE TABLE "idea_dependencies" (
  "blocked_idea_id" UUID NOT NULL,
  "blocker_idea_id" UUID NOT NULL,
  "created_at_utc" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "PK_idea_dependencies" PRIMARY KEY ("blocked_idea_id", "blocker_idea_id"),
  CONSTRAINT "FK_idea_dependencies_ideas_blocked_idea_id"
    FOREIGN KEY ("blocked_idea_id") REFERENCES "ideas" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_idea_dependencies_ideas_blocker_idea_id"
    FOREIGN KEY ("blocker_idea_id") REFERENCES "ideas" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "ck_idea_dependencies_no_self" CHECK ("blocked_idea_id" <> "blocker_idea_id")
);

CREATE INDEX "ix_idea_dependencies_blocker_idea_id" ON "idea_dependencies" ("blocker_idea_id");

-- AlterTable: a sprint can belong to one board (NULL = a sprint from before this change)
ALTER TABLE "sprints" ADD COLUMN "board_id" UUID;

ALTER TABLE "sprints"
  ADD CONSTRAINT "FK_sprints_boards_board_id"
  FOREIGN KEY ("board_id") REFERENCES "boards" ("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "ix_sprints_board_id_state" ON "sprints" ("board_id", "state");
```

- [ ] **Step 3: Edit `schema.prisma` to match**

`board_swimlanes`: add the fields and name both relations to `boards` (Prisma requires names once two relations join the same pair of models):

```prisma
model board_swimlanes {
  id                  String   @id(map: "PK_board_swimlanes") @db.Uuid
  board_id            String   @db.Uuid
  status_id           String   @db.Uuid
  display_order       Int
  references_board_id String?  @db.Uuid
  is_final            Boolean  @default(false)
  boards              boards   @relation("swimlane_board", fields: [board_id], references: [id], onDelete: Cascade, onUpdate: NoAction, map: "FK_board_swimlanes_boards_board_id")
  referenced_board    boards?  @relation("swimlane_reference", fields: [references_board_id], references: [id], onDelete: Restrict, onUpdate: NoAction, map: "FK_board_swimlanes_boards_references_board_id")
  statuses            statuses @relation(fields: [status_id], references: [id], onUpdate: NoAction, map: "FK_board_swimlanes_statuses_status_id")

  @@unique([board_id, status_id], map: "ux_board_swimlanes_board_id_status_id")
  @@index([status_id], map: "IX_board_swimlanes_status_id")
  @@index([references_board_id], map: "ix_board_swimlanes_references_board_id")
}
```

`boards`: add after `is_archived`/`archived_at_utc`, and replace `board_swimlanes board_swimlanes[]`:

```prisma
  sprints_enabled          Boolean           @default(false)
  idea_features_enabled    Boolean           @default(true)
  key_prefix               String?           @db.VarChar(10)
  next_item_number         Int               @default(1)
  board_swimlanes          board_swimlanes[] @relation("swimlane_board")
  referencing_swimlanes    board_swimlanes[] @relation("swimlane_reference")
  sprints                  sprints[]
```

and add `@@unique([organization_id, key_prefix], map: "ux_boards_organization_id_key_prefix")` beside the existing `@@index`.

`ideas`: add after `outcome_id`:

```prisma
  parent_idea_id            String?             @db.Uuid
  item_number               Int?
  parent_idea               ideas?              @relation("idea_parent", fields: [parent_idea_id], references: [id], onDelete: Restrict, onUpdate: NoAction, map: "FK_ideas_ideas_parent_idea_id")
  child_ideas               ideas[]             @relation("idea_parent")
  blocked_by                idea_dependencies[] @relation("dependency_blocked")
  blocking                  idea_dependencies[] @relation("dependency_blocker")
```

and, with the other indexes: `@@index([parent_idea_id], map: "ix_ideas_parent_idea_id")` and `@@unique([board_id, item_number], map: "ux_ideas_board_id_item_number")`.

`sprints`: add `board_id String? @db.Uuid`, `boards boards? @relation(fields: [board_id], references: [id], onDelete: Restrict, onUpdate: NoAction, map: "FK_sprints_boards_board_id")` and `@@index([board_id, state], map: "ix_sprints_board_id_state")`.

New model, after `idea_followers`:

```prisma
/// "blocked" cannot leave its board's first lane until "blocker" is in a final lane
/// (SPEC/20-feature-board-references.md). The same-board rule and cycle check live in the
/// Application layer; the database refuses only a self-dependency.
model idea_dependencies {
  blocked_idea_id String   @db.Uuid
  blocker_idea_id String   @db.Uuid
  created_at_utc  DateTime @db.Timestamptz(6)
  blocked         ideas    @relation("dependency_blocked", fields: [blocked_idea_id], references: [id], onDelete: Cascade, onUpdate: NoAction, map: "FK_idea_dependencies_ideas_blocked_idea_id")
  blocker         ideas    @relation("dependency_blocker", fields: [blocker_idea_id], references: [id], onDelete: Cascade, onUpdate: NoAction, map: "FK_idea_dependencies_ideas_blocker_idea_id")

  @@id([blocked_idea_id, blocker_idea_id], map: "PK_idea_dependencies")
  @@index([blocker_idea_id], map: "ix_idea_dependencies_blocker_idea_id")
}
```

- [ ] **Step 4: Validate, generate, apply**

```bash
pnpm --filter @collega/infrastructure exec prisma validate
pnpm --filter @collega/infrastructure db:generate
pnpm --filter @collega/infrastructure db:migrate
```

Expected: `The schema ... is valid`; the client regenerates; `migrate deploy` applies `20261015000000_add_board_references` with no error. If `prisma validate` names a missing back-relation, add it to the model it names; do not rename the constraint maps above.

- [ ] **Step 5: Confirm the seed still builds and the gate is green**

```bash
pnpm --filter @collega/infrastructure db:seed
pnpm check
```

Expected: seed completes; `pnpm check` green. The existing `packages/domain/test/enums.test.ts` is unaffected because no enum changed.

- [ ] **Step 6: Commit**

```bash
git add packages/infrastructure/prisma
git commit -m "Add the Board References columns, dependencies table and constraints"
```

---

### Task 4 (slice 199, **QA**): Migration integration test

**Files:**
- Create: `packages/infrastructure/test/board-references-migration.integration.test.ts`

**Interfaces:**
- Consumes: the migration file and constraint names from Task 3.

- [ ] **Step 1: Branch**

```bash
git switch dev && git pull --ff-only && git switch -c feature/199-board-references-migration-test
```

- [ ] **Step 2: Write the test**

The probe database holds only the columns the migration alters, as `idea-followers-migration.integration.test.ts` does. Create `packages/infrastructure/test/board-references-migration.integration.test.ts`:

```ts
// The Board References migration (20261015000000_add_board_references), run as written against a
// database that already holds boards, lanes, ideas and sprints. The probe database holds only the
// columns the migration alters or references. The migration file is sent through `prisma db
// execute`, which is what `migrate deploy` would send. Skipped unless `DATABASE_URL` is set.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'

const DATABASE_URL = process.env.DATABASE_URL
const MIGRATION = fileURLToPath(
  new URL(
    '../prisma/migrations/20261015000000_add_board_references/migration.sql',
    import.meta.url,
  ),
)
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js')

const id = (n: number) => `30000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const [ORG_A, ORG_B] = [id(1), id(2)] as const
const [BOARD_CI, BOARD_IMPL, BOARD_OTHER_ORG] = [id(11), id(12), id(13)] as const
const [LANE_CI, LANE_IMPL] = [id(21), id(22)] as const
const [PARENT, TASK, TASK_TWO] = [id(31), id(32), id(33)] as const
const SPRINT = id(41)
const STATUS = id(51)
const NOW = '2026-10-15T00:00:00Z'

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

describe.skipIf(!DATABASE_URL)('Board References migration', () => {
  const database = `collega_mig_probe_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const admin = new PrismaClient()
  let probe: PrismaClient

  beforeAll(async () => {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
    const url = withDatabase(DATABASE_URL as string, database)
    probe = new PrismaClient({ datasourceUrl: url })

    for (const statement of [
      'CREATE TABLE boards (id UUID PRIMARY KEY, organization_id UUID NOT NULL)',
      // ON DELETE CASCADE on board_id (as in the real schema) so that only the migration's own
      // references_board_id constraint can block a board delete.
      'CREATE TABLE board_swimlanes (id UUID PRIMARY KEY, board_id UUID NOT NULL REFERENCES boards (id) ON DELETE CASCADE, status_id UUID NOT NULL)',
      'CREATE TABLE ideas (id UUID PRIMARY KEY, board_id UUID)',
      'CREATE TABLE sprints (id UUID PRIMARY KEY, state TEXT NOT NULL)',
    ]) {
      await probe.$executeRawUnsafe(statement)
    }
    await probe.$executeRaw`INSERT INTO boards (id, organization_id) VALUES
      (${BOARD_CI}::uuid, ${ORG_A}::uuid), (${BOARD_IMPL}::uuid, ${ORG_A}::uuid),
      (${BOARD_OTHER_ORG}::uuid, ${ORG_B}::uuid)`
    await probe.$executeRaw`INSERT INTO board_swimlanes (id, board_id, status_id) VALUES
      (${LANE_CI}::uuid, ${BOARD_CI}::uuid, ${STATUS}::uuid),
      (${LANE_IMPL}::uuid, ${BOARD_IMPL}::uuid, ${STATUS}::uuid)`
    await probe.$executeRaw`INSERT INTO ideas (id, board_id) VALUES
      (${PARENT}::uuid, ${BOARD_CI}::uuid), (${TASK}::uuid, ${BOARD_IMPL}::uuid),
      (${TASK_TWO}::uuid, ${BOARD_IMPL}::uuid)`
    await probe.$executeRaw`INSERT INTO sprints (id, state) VALUES (${SPRINT}::uuid, 'Active')`

    execFileSync(process.execPath, [PRISMA_CLI, 'db', 'execute', '--url', url, '--file', MIGRATION], {
      stdio: 'pipe',
    })
  }, 60_000)

  afterAll(async () => {
    await probe?.$disconnect()
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`)
    await admin.$disconnect()
  })

  it('leaves existing rows untouched and applies the defaults', async () => {
    const boards = await probe.$queryRaw<
      { sprints_enabled: boolean; idea_features_enabled: boolean; key_prefix: string | null; next_item_number: number }[]
    >`SELECT sprints_enabled, idea_features_enabled, key_prefix, next_item_number FROM boards WHERE id = ${BOARD_CI}::uuid`
    expect(boards[0]).toEqual({
      sprints_enabled: false,
      idea_features_enabled: true,
      key_prefix: null,
      next_item_number: 1,
    })
    const lanes = await probe.$queryRaw<{ is_final: boolean; references_board_id: string | null }[]>`
      SELECT is_final, references_board_id::text AS references_board_id FROM board_swimlanes WHERE id = ${LANE_CI}::uuid`
    expect(lanes[0]).toEqual({ is_final: false, references_board_id: null })
    const sprints = await probe.$queryRaw<{ board_id: string | null }[]>`
      SELECT board_id::text AS board_id FROM sprints WHERE id = ${SPRINT}::uuid`
    expect(sprints[0]?.board_id).toBeNull()
  })

  it('lets a lane reference another board, and two lanes reference the same target', async () => {
    await probe.$executeRaw`UPDATE board_swimlanes SET references_board_id = ${BOARD_IMPL}::uuid WHERE id = ${LANE_CI}::uuid`
    await probe.$executeRaw`INSERT INTO board_swimlanes (id, board_id, status_id, references_board_id)
      VALUES (${id(23)}::uuid, ${BOARD_OTHER_ORG}::uuid, ${STATUS}::uuid, ${BOARD_IMPL}::uuid)`
    const rows = await probe.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM board_swimlanes WHERE references_board_id = ${BOARD_IMPL}::uuid`
    expect(Number(rows[0]?.n)).toBe(2)
  })

  it('refuses a lane that references its own board', async () => {
    await expect(
      probe.$executeRaw`UPDATE board_swimlanes SET references_board_id = ${BOARD_IMPL}::uuid WHERE id = ${LANE_IMPL}::uuid`,
    ).rejects.toThrow(/ck_board_swimlanes_no_self_reference/)
  })

  it('refuses to delete a board a lane still references', async () => {
    await expect(
      probe.$executeRaw`DELETE FROM boards WHERE id = ${BOARD_IMPL}::uuid`,
    ).rejects.toThrow(/FK_board_swimlanes_boards_references_board_id/)
  })

  it('refuses an idea that is its own parent, and accepts a real parent', async () => {
    await expect(
      probe.$executeRaw`UPDATE ideas SET parent_idea_id = id WHERE id = ${TASK}::uuid`,
    ).rejects.toThrow(/ck_ideas_no_self_parent/)
    await probe.$executeRaw`UPDATE ideas SET parent_idea_id = ${PARENT}::uuid WHERE id = ${TASK}::uuid`
  })

  it('numbers items uniquely per board but lets the same number appear on two boards', async () => {
    await probe.$executeRaw`UPDATE ideas SET item_number = 1 WHERE id = ${PARENT}::uuid`
    await probe.$executeRaw`UPDATE ideas SET item_number = 1 WHERE id = ${TASK}::uuid`
    await expect(
      probe.$executeRaw`UPDATE ideas SET item_number = 1 WHERE id = ${TASK_TWO}::uuid`,
    ).rejects.toThrow(/ux_ideas_board_id_item_number/)
  })

  it('keeps a key prefix unique within an organization only, and lets unprefixed boards coexist', async () => {
    await probe.$executeRaw`UPDATE boards SET key_prefix = 'CI' WHERE id = ${BOARD_CI}::uuid`
    await probe.$executeRaw`UPDATE boards SET key_prefix = 'CI' WHERE id = ${BOARD_OTHER_ORG}::uuid`
    await expect(
      probe.$executeRaw`UPDATE boards SET key_prefix = 'CI' WHERE id = ${BOARD_IMPL}::uuid`,
    ).rejects.toThrow(/ux_boards_organization_id_key_prefix/)
    const unprefixed = await probe.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM boards WHERE key_prefix IS NULL`
    expect(Number(unprefixed[0]?.n)).toBe(1)
  })

  it('refuses a dependency on itself and removes dependencies with either idea', async () => {
    await expect(
      probe.$executeRaw`INSERT INTO idea_dependencies (blocked_idea_id, blocker_idea_id, created_at_utc)
        VALUES (${TASK}::uuid, ${TASK}::uuid, ${NOW}::timestamptz)`,
    ).rejects.toThrow(/ck_idea_dependencies_no_self/)

    await probe.$executeRaw`INSERT INTO idea_dependencies (blocked_idea_id, blocker_idea_id, created_at_utc)
      VALUES (${TASK_TWO}::uuid, ${TASK}::uuid, ${NOW}::timestamptz)`
    await probe.$executeRaw`DELETE FROM ideas WHERE id = ${TASK}::uuid`
    const left = await probe.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM idea_dependencies`
    expect(Number(left[0]?.n)).toBe(0)
    const survivor = await probe.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM ideas WHERE id = ${TASK_TWO}::uuid`
    expect(Number(survivor[0]?.n)).toBe(1)
  })
})
```

Note: the tests run in order against shared state, so the delete in the last test must stay last.

- [ ] **Step 3: Run it**

```bash
pnpm --filter @collega/infrastructure exec vitest run test/board-references-migration.integration.test.ts
```

Expected: 8 tests pass when `DATABASE_URL` is set (the local Docker role has `CREATEDB`); without it the suite is skipped. If a `rejects.toThrow` regex fails, print `String(error)` once and match the constraint name that Postgres reports; do not weaken the assertion to `toThrow()`.

- [ ] **Step 4: Commit**

```bash
git add packages/infrastructure/test/board-references-migration.integration.test.ts
git commit -m "Test the Board References migration against a throwaway database"
```

---

### Task 5 (slice 200): Seed a key prefix on every demo board

**Files:**
- Modify: `packages/infrastructure/src/demo-seed/modules/boards-and-statuses.ts` (the board upsert, lines 46-66)
- Test (**QA**): `packages/infrastructure/test/demo-scenario.test.ts`

**Interfaces:**
- Consumes: `boards.key_prefix` from Task 3.
- Produces: an exported pure function `demoKeyPrefix(boardName: string): string` in the same module, which the QA test imports.

The reference lane and the second "Implementation" demo board are deliberately **not** seeded here: adding a board to each demo organization changes the board counts that `demo-scenario.test.ts`, the e2e flows and the golden corpus assert. That reconciliation belongs to Plan 3 with the UI.

- [ ] **Step 1: Branch**

```bash
git switch dev && git pull --ff-only && git switch -c feature/200-board-references-seed-prefix
```

- [ ] **Step 2: Implement**

At the top of `boards-and-statuses.ts`, below the imports, add:

```ts
/** Letters of the name, upper-cased, first four: "Ideas" -> "IDEA", "Opportunities" -> "OPPO". */
export function demoKeyPrefix(boardName: string): string {
  return boardName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4)
}
```

In the board `upsert`, add `key_prefix: demoKeyPrefix(board.name),` to both `update` and `create`.

- [ ] **Step 3: Run the seed twice and check**

```bash
pnpm --filter @collega/infrastructure db:seed && pnpm --filter @collega/infrastructure db:seed
```

Expected: both runs succeed (idempotent). Then, with the database up, `SELECT name, key_prefix FROM boards ORDER BY name;` shows `IDEA` and `OPPO` for the original organizations and a prefix on every board.

- [ ] **Step 4 (QA): Add the uniqueness assertion**

In `packages/infrastructure/test/demo-scenario.test.ts`, add inside the top-level `describe`:

```ts
it('derives a distinct, non-empty key prefix for every board in an organization', () => {
  for (const org of DEMO_ORGANIZATIONS) {
    const prefixes = org.boards.map((board) => demoKeyPrefix(board.name))
    expect(prefixes.every((prefix) => prefix.length >= 2)).toBe(true)
    expect(new Set(prefixes).size).toBe(prefixes.length)
  }
})
```

with `import { demoKeyPrefix } from '../src/demo-seed/modules/boards-and-statuses.js'` beside the existing imports (reuse the file's existing `DEMO_ORGANIZATIONS` import).

```bash
pnpm --filter @collega/infrastructure exec vitest run test/demo-scenario.test.ts
```

Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
pnpm check
git add packages/infrastructure/src/demo-seed packages/infrastructure/test/demo-scenario.test.ts
git commit -m "Seed a key prefix on every demo board"
```

Expected: `pnpm check` green.

---

## Self-review against the spec

- **Spec coverage.** Decisions recorded (Task 1); contracts for boards, ideas, sprints, dependencies (Task 2); every column and table in the spec's Data model except the removals, which are Plan 4 (Task 3); constraints and defaults pinned (Task 4); item keys' prefix (Task 5). Not in Plan 1 by design: item-number assignment (Plan 2), the `Implementation` demo board and reference lane (Plan 3), all removals (Plan 4), metric types for Outcomes (Plan 2).
- **Names.** Constraint names in Task 3 and the regexes in Task 4 match; `demoKeyPrefix` is defined in Task 5 before its test uses it.
- **Open point for the owner.** Item numbers are per board but `ideas.board_id` is nullable (ideas with no board) and ideas can be pulled onto a board (Sprint 14). Plan 2 must decide whether a pulled-in item takes the next number on its new board; the unique index already allows either.

## Plans 2–4 (outline, written when the predecessor merges)

**Plan 2 — Backend.** Domain and application: board reference lanes and `is_final` in the board service and repository (with the guards in `contracts/boards.md`); tasks (`POST /ideas/{id}/tasks`, parent rules, `taskCounts`); item keys and the `next_item_number` counter; `idea_dependencies` and the `taskBlocked` rule; Effort-required entry to a reference lane; per-board sprints and the final-lane carry-over; Outcomes backend (entity, service, routes, metric types, rollups per `20-feature-board-references.md`). QA slice per backend slice.

**Plan 3 — UI.** Statuses page with the reference selector and Kind column; parent drawer with Tasks, sprint chips and blocked locks; child board with sprint header and parent chips; Outcome pages and value table; the demo `Implementation` board and reference lane in the seed, with the board-count reconciliation in `demo-scenario.test.ts`, e2e and the golden accepted-differences. Comps: `comp-s-board-reference.html`, `comp-s-idea-and-outcome.html`.

**Plan 4 — Retire Delivery.** One migration dropping `ideas.phase`, `delivery_status`, the promotion columns, `issue_tasks`, the Delivery enums and the notification event values; delete the roughly 40 Delivery-only files (inventory in this session's research: `packages/domain/src/issue-tasks`, `packages/application/src/issue-tasks`, `apps/api/src/issue-tasks`, `apps/api/src/ideas/delivery.controller.ts`, `apps/web/app/(desk)/delivery/**`, `apps/web/components/delivery/*`, `modules/delivery.ts` in the seed, their tests and `e2e/tests/delivery.spec.ts`); make `sprints.board_id` required; re-record the golden accepted differences; update `SPEC/50-typescript-migration.md` E6 and `SPEC/95-next-sprints.md`. Must be sequenced after the Backlog-add and quick-add work is retired or ported, since both build on the Delivery model.

## Carried into Plan 2 (from the Plan 1 final review)

1. Seeded ideas get no `item_number`, but `contracts/ideas.md` says `itemKey` is null only for a board with no prefix or no board. Plan 2 numbers the seeded ideas, or the contract says un-numbered legacy items get null.
2. Item numbers against board moves, pull-in and prefix edits: `ux_ideas_board_id_item_number` will collide once numbers exist, and the contract is ambiguous on whether `keyPrefix` can change after keys are issued.
3. "Deleting an item removes its dependencies in both directions" holds only for a hard delete (FK cascade). Ideas are soft-deleted, so the application must remove the dependencies itself.
4. Seed and cleanup teardown delete boards before sprints while `sprints.board_id` is ON DELETE RESTRICT. Harmless now; it breaks once a board sprint is seeded (`src/demo-seed/index.ts` ~lines 99 vs 110; `prisma/seed/cleanup-test-data.ts` ~178 vs 198).
5. `contracts/boards.md` has five 422 rules but four error keys. "Missing or other-org board" is 422 there but 404 in `idea-dependencies.md` and the Outcomes defaults. The archive-while-referenced rule is 422 while existing archive conflicts are 409.
6. Spec Behavior 5 (late task additions) against the contract (the parent must sit in the reference lane at task creation): the contract should say "move the parent back first".
7. `key_prefix` has no database CHECK for 2-10 characters A-Z0-9, and the unique index is case-sensitive, so "upper-cased on store" is load-bearing in the application.
8. Add 422 to the Standard Error Responses list in `SPEC/30-Contracts.md`, and write Roles and Errors for the board-tasks route before Plan 2 implements it.
9. Task 2 Step 4 text in this plan still says `POST /ideas/{id}/tasks`; the ruling is `/board-tasks`.
10. The test pinning `''` for a letterless board name in `demo-scenario.test.ts` should be dropped in Plan 2.
11. The lane-save route that carries `referencesBoardId` and `isFinal` is not named in `contracts/boards.md`.
12. `seed-rerun.integration.test.ts` failed on its follower test when the reviewer ran it against the local dev DB. Unchecked on `dev`; not caused by this stack as far as known.
