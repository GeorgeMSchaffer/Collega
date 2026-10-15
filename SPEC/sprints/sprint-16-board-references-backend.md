# Board References — Plan 2: Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each backend task is followed by its own QA task, written by a different agent (AGENTS.md: an agent does not write tests for its own code). Backend tasks still write the failing test they need to drive the change only where the plan says so; coverage beyond that is the QA task's job.

**Goal:** The API behind Board References: reference lanes and final lanes, item keys, board tasks, blockers, per-board sprints, the Effort entry rule, and Outcomes.

**Architecture:** Additive on the Plan 1 schema (merged to `dev` 2026-10-15). Domain gets the new fields and pure invariants; application services own every cross-board rule (they need other boards' data); infrastructure maps the columns; the API adds routes. Delivery code is untouched (Plan 4 removes it), so new paths branch on `sprint.boardId` / parent links rather than editing the Delivery rules.

**Tech Stack:** TypeScript, Nest.js, Prisma/PostgreSQL 16, Vitest. No new dependencies.

**Spec:** `SPEC/20-feature-board-references.md` (approved 2026-10-15). Contracts: `SPEC/contracts/{boards,ideas,sprints,idea-dependencies,outcomes}.md`. Decision: `SPEC/decisions.md` "2026-10-15 — Board References replace the Delivery phase". Plan 1: `SPEC/sprints/sprint-15-board-references-foundation.md` (its "Carried into Plan 2" list is folded in below).

## Global Constraints

- Read `AGENTS.md` at the root and in the package you touch. Dependencies flow inward; web imports nothing but the design system; imports use `@collega/<pkg>/<feature>` and `.js` extensions inside a package.
- Errors go through the shared model in `packages/application/src/common/errors.ts` (Task 1 adds the 422 kind). Controllers never hand-build error responses.
- Services run one `unitOfWork.saveChanges()` per command, then write audits (existing pattern). Tests are hermetic: inject the clock (`fixedClock`), no network, no randomness beyond the injected `RandomSource`.
- SQL: UPPERCASE keywords, lowercase names, no `SELECT *`.
- Commit messages read as human-written: no reference to Claude, agents or AI, no Co-Authored-By. One change per commit. Never stage `.superpowers/`.
- `pnpm check` is the gate. Three tests in `apps/web/test/auth-actions.test.ts` already fail on `dev` and are out of scope.
- `SPEC/30-Contracts.md` and `SPEC/contracts/*` are read, not edited, except in Task 0.
- Branches: one `feature/<NNN>-<desc>` per slice, branched from the previous slice (stacked) in the primary checkout; rebase onto `origin/dev` before merging; the owner approves the merge and push.

## Rulings (made while planning; the owner may overrule)

1. **422** is a new `UnprocessableError(code, message)` in the shared model; the response renders `code` as the message key (owner decision 2026-10-15).
2. **Task idea type and business impact:** `ideas.idea_type_id` and `business_impact_id` are NOT NULL, so a board task stores the organization's first active idea type and first active business impact (by sort order), hidden from task reads; if the organization has none, the create fails `422` `noDefaultIdeaType` / `noDefaultBusinessImpact` (owner decision 2026-10-15).
3. **Item numbers:** assigned when an item is created on a board with a prefix, or pulled onto a board; never reused; a pull or move to another board takes the next number on the new board; detaching leaves `item_number` null and `board_id` null. Seeded ideas are numbered by the seed (Task 5). An item on a board without a prefix has a null number and a null key.
4. **`keyPrefix` is editable only while `next_item_number = 1`** (no key issued yet); afterwards a change is `422` `keyPrefixLocked`. Stored upper-cased; the service rejects duplicates in the organization before the database does (`409` via `KNOWN_CONSTRAINTS` as the backstop).
5. **Allocation** is an awaited atomic `UPDATE boards SET next_item_number = next_item_number + 1 ... RETURNING` before the idea is staged, outside the unit-of-work buffer (precedent: `tag.repository.ts` `getOrCreate`). A failed later commit leaks a number, which "never reused" allows.
6. **`laneInUse`** applies to a lane that references a board (changing or removing the reference) and to removing any lane that has ideas without an `ideaMoves` entry (the existing flow stays for ordinary lanes). A bulk `ideaMoves` into a reference lane enforces the Effort rule too.
7. **Missing, other-organization or archived board named in a lane save** is `422` `referencesBoardInvalid` (boards.md); the dependency and Outcome routes keep their `404` for missing or out-of-scope ids.
8. **Sprints:** board sprints branch on `sprint.boardId`; legacy `boardId = null` sprints keep the Delivery behavior until Plan 4. Board-sprint membership works for non-Delivery items, so the Delivery-phase guard is bypassed only on the board path. Roles stay Org Admin only.
9. **Soft delete:** deleting an item removes its `idea_dependencies` rows in both directions in the same unit of work, and a parent with live children cannot be deleted (`422` `hasOpenTasks`).
10. **Audit events (new):** `IdeaBlockedByChanged`, `BoardTaskCreated` (on the task, parent id in metadata), plus the four Outcome events in `contracts/outcomes.md`. All written after the commit, as elsewhere.

## Review Focus

- A lane save that drops `isFinal` / `referencesBoardId` because the repository rebuilds lanes without them (`board.repository.ts` save is delete-all-then-create).
- `ideaMoves` or a pull moving an idea into a reference lane without an Effort value, bypassing `changeStatus`.
- Two concurrent creates on one board receiving the same item number.
- A blocker cycle through three or more items; a blocker set containing duplicates.
- A task counted done only when it sits in a final lane of **its own** board.
- Completing a board sprint carrying back items that are in a final lane, or failing on a non-Delivery item.
- Outcome grouping of a task (must be `422`) and of a standalone card on a child board (must succeed).

## File map

| Area | Files |
|---|---|
| Error model | `packages/application/src/common/errors.ts`, `apps/api/src/common/errors/problem-details.filter.ts` (`KERNEL_STATUS`/`KERNEL_TYPE`/`KERNEL_TITLE`; precedent `packages/application/src/ai/errors.ts`) |
| Boards | `packages/domain/src/boards/board.ts`; `packages/application/src/boards/{board-service,models,ports}.ts`; `packages/infrastructure/src/repositories/board.repository.ts`; `apps/api/src/boards/boards.controller.ts` |
| Ideas | `packages/domain/src/ideas/idea.ts`; `packages/application/src/ideas/{idea.service,models,ports}.ts`; `packages/infrastructure/src/repositories/idea.repository.ts`; `apps/api/src/ideas/ideas.controller.ts` |
| Dependencies | new `IdeaDependenciesPort` in `ideas/ports.ts`; new `packages/infrastructure/src/repositories/idea-dependency.repository.ts`; token and provider lines in `apps/api/src/common/{tokens.ts,persistence/adapters.providers.ts}` |
| Sprints | `packages/domain/src/sprints/sprint.ts`; `packages/application/src/sprints/{sprint.service,models,ports}.ts`; `sprint.repository.ts`; `apps/api/src/sprints/sprints.controller.ts` |
| Outcomes | new `packages/domain/src/outcomes/`, `packages/application/src/outcomes/`, `packages/infrastructure/src/repositories/outcome.repository.ts`, `apps/api/src/outcomes/` |
| Seed | `packages/infrastructure/src/demo-seed/**`, `prisma/seed/cleanup-test-data.ts` |

Test fakes: there is no shared fake repository. Adding a method to `BoardRepository`, `IdeaRepository`, `BoardsPort` or `SprintIssuesPort` breaks the typecheck of every hand-written fake in `packages/application/test/{ideas,boards,statuses,sprints}` and `apps/api/test/boards.controller.test.ts`; each task that adds a port method adds the stub to those fakes.

---

## Task 0 (slice 220, spec): Close the contract gaps Plan 1 left

Edits `SPEC/30-Contracts.md` and `SPEC/contracts/*` only. This is the one task allowed to edit them.

- [ ] Add `422 Unprocessable Entity` to Standard Error Responses in `SPEC/30-Contracts.md` (body shape: Problem Details with the rule key as the message).
- [ ] `boards.md`: name the lane-save routes (`PUT /boards/{boardId}`, `POST /organizations/{orgId}/boards`, `POST /boards/{boardId}/swimlanes/reorder`) as the ones carrying `isFinal` / `referencesBoardId`; add the error keys `referencesBoardInvalid`, `keyPrefixLocked`, `keyPrefixTaken` (409) so the five 422 rules have five keys; state that a missing, other-org or archived referenced board is `referencesBoardInvalid`; state that the archive-while-referenced rule is `referenceTargetArchived` 422 and is the only archive error with that status (existing archive conflicts stay 409).
- [ ] `ideas.md`: rename the route to `POST /api/v1/ideas/{ideaId}/board-tasks` in the Plan 1 text; add Roles (anyone who may edit the parent; Read Only `403`; direct Site Admin `403`) and Errors (`401`, `403`, `404` parent missing or out of scope, `422` `parentNotInReferenceLane`, `parentIsTask`, `referencedBoardArchived`, `noDefaultIdeaType`, `noDefaultBusinessImpact`); add one sentence: late additions require moving the parent back into the reference lane first; add `hasOpenTasks` to the delete rules; correct line 264's "no `reference` field" against the 2026-10-15 section.
- [ ] `sprints.md`: error `sprintItemOnOtherBoard` for the cross-board rule.
- [ ] Commit: "Fill the Board References contract gaps found in review".

## Task 1 (slice 221, backend): 422 in the shared error model

**Files:** `packages/application/src/common/errors.ts`, `apps/api/src/common/errors/problem-details.filter.ts`; test in `apps/api/test/` beside the filter's tests.

**Produces:** `class UnprocessableError extends ApplicationError { readonly code: string }` exported from `@collega/application/common`, kind `unprocessable`; the filter renders status 422, title "Unprocessable Entity" and the `code` as the message key, in the same envelope shape the `aiAssistUnavailable` precedent uses.

- [ ] Add the class and the three filter map entries (copy the `aiAssistUnavailable` pattern in `packages/application/src/ai/errors.ts`).
- [ ] Write the one failing test that renders an `UnprocessableError('taskBlocked', ...)` through the filter and asserts 422 and the key. Run it red, implement, run green.
- [ ] `pnpm --filter @collega/api test` and `pnpm --filter @collega/application test` pass; commit "Add a 422 kind to the shared error model".

## Task 2 (slice 222, backend): Board lanes and flags — domain, application, infrastructure, API

**Files:** see the Boards row of the file map; `constraint-errors.ts` (`ux_boards_organization_id_key_prefix`).

**Interfaces:**
- Domain `BoardSwimlane` gains `isFinal: boolean`, `referencesBoardId: string | null`; `Board` gains `keyPrefix: string | null`, `sprintsEnabled`, `ideaFeaturesEnabled`, `nextItemNumber`. `toSwimlanes` takes lane inputs (`{statusId, isFinal, referencesBoardId}`), not bare status ids; `reorderBoardSwimlanes` preserves both fields. Pure invariants: prefix 2–10 `A-Z0-9`, upper-cased (`BoardInvariantError('keyPrefix', …)`).
- Application `SwimlaneInput` gains `isFinal?`, `referencesBoardId?`; `CreateBoardCommand` / `UpdateBoardCommand` gain `keyPrefix?`, `sprintsEnabled?`, `ideaFeaturesEnabled?`; `BoardListItem`, `BoardDetail`, `SwimlaneDetail` return them. `SwimlaneInfo` in `ideas/ports.ts` gains `isFinal`, `referencesBoardId`; `BoardContext` gains `keyPrefix`.
- Rules in `BoardService` (loads `listByOrganization` for the cross-board checks): `laneReferencesOwnBoard`, `referenceChainNotAllowed` (both directions, one level), `referencesBoardInvalid` (Ruling 7), `laneInUse` (Ruling 6, count via `countIdeasByBoardAndStatus`), `referenceTargetArchived` on `setArchived`, `keyPrefixLocked` / `keyPrefixTaken` (Ruling 4). A board first named as a target gets `ideaFeaturesEnabled = false` unless the same save sets it.
- Repository: `boardFromRow`, `add`, `save`, `swimlaneRows` carry the new columns; `save` must never write `next_item_number` from a stale copy.

- [ ] Domain first (tests: invariants, `toSwimlanes`, reorder keeps flags), then service, repository, controller (`toSwimlaneInputs` currently drops everything but `statusId`/`order`).
- [ ] Update every fake listed under the file map. Integration test: a save round-trips `is_final` and `references_board_id` (extend `board-references-migration.integration.test.ts` only for new CHECKs, if any).
- [ ] Commits: domain+application, then infrastructure+API.

## Task 3 (slice 223, QA): Board lanes and flags

A different agent. Cover every rule in `contracts/boards.md` above (including both chain directions, `laneInUse` on change and on removal, archive guard, prefix lock and duplicate), the round trip through the real repository (integration, skipped without `DATABASE_URL`), the controller's body parsing, and the three Review Focus lines about lanes. Mutation-check the guards.

## Task 4 (slice 224, backend): Item numbers and keys

**Files:** Ideas row of the file map; `board.repository.ts` (allocator); `constraint-errors.ts` (`ux_ideas_board_id_item_number`); CSV import in `idea.service.ts`.

**Interfaces:** `BoardsPort.allocateItemNumber(boardId): Promise<number | null>` (null when the board has no prefix); `Idea` gains `itemNumber: number | null`; `createIdeaRecord`, `stagePull` / `reassignIdeas`, `importBoardIdeas` allocate per Ruling 3; reads (`projectListItems`, `projectDeliveryCards`, `projectDetail`, the create result) return `itemKey` using a batched `BoardsPort.getKeyPrefixes(boardIds)`.

- [ ] Failing test first: two creates on one board get 1 and 2, a create on a prefix-less board gets null and no key.
- [ ] Implement allocator (Ruling 5), domain field, mapper (`fromRow` and `scalarWriteData` must carry `item_number` or saves null it), projections, pull-in and import.
- [ ] Seed: number the seeded ideas (`demo-seed/modules/…`) in creation order per board and set each board's `next_item_number`; fix teardown order (sprints before boards) in `src/demo-seed/index.ts` and `prisma/seed/cleanup-test-data.ts`; drop the `''`-for-letterless-name pin in `demo-scenario.test.ts`.

## Task 5 (slice 225, QA): Item numbers and keys

Concurrent-create integration test (no duplicate numbers), pull-in and move renumbering, prefix lock after the first key, CSV import numbering, projections' `itemKey` shape, seeded keys unique per board and `next_item_number` consistent.

## Task 6 (slice 226, backend): Board tasks

**Files:** Ideas row; `ideas.controller.ts` (`@Post('ideas/:ideaId/board-tasks') @HttpCode(201)`).

**Interfaces:** `IdeaService.createBoardTask(parentIdeaId, command)`; `Idea` gains `parentIdeaId`; `IdeaRepository.countChildrenByParentIds(parentIds): Promise<Map<string, {total: number; done: number}>>` (grouped SQL joining the child's own board lane `is_final`); reads return `parentIdeaId` and `taskCounts` (only on an item whose current lane references a board).

**Behavior:** per Ruling 2 and `contracts/ideas.md`: parent must sit in a lane with `referencesBoardId`; the task lands on that board in its leftmost lane; `parentIsTask` and `referencedBoardArchived` as 422; `createIdeaRecord` gains a `parentIdeaId` option and the default-type lookup. `IdeaService.delete` refuses a parent with live children (`hasOpenTasks`) and removes dependency rows (Task 8 supplies the port; until then the delete guard lands with Task 8).

- [ ] Failing test first (service-level, using the harness): create succeeds from a parent in the reference lane; fails from any other lane.
- [ ] Idea-only features off: no type/fields/upvotes exposed on a task read (the board flag decides).

## Task 7 (slice 227, QA): Board tasks

All `ideas.md` task rules; `taskCounts` done semantics across two boards; default type/impact missing; late addition (parent moved on) fails and works after moving the parent back; View As denial; Read Only; route-level test.

## Task 8 (slice 228, backend): Effort entry rule, dependencies and `taskBlocked`

**Files:** `IdeaService.changeStatus` and `BoardService` bulk move path; new `IdeaDependenciesPort` and `PrismaIdeaDependencyRepository`; `PUT /ideas/:ideaId/blocked-by` (`guidList` parsing, 200).

**Interfaces:** `IdeaDependenciesPort { listBlockerIds(blockedId); listBlockersByBlockedIds(ids); listEdgesForBoard(boardId); replaceBlockers(blockedId, blockerIds, nowUtc); deleteAllFor(ideaId) }`. `IdeaService.setBlockedBy(ideaId, ideaIds)`: dedupe; `blockerIsSelf`, `blockerOnOtherBoard`, `dependencyCycle` (DFS over the board's edges) as 422; missing or out-of-scope blocker 404; atomic replace; `IdeaBlockedByChanged` audit. `changeStatus`: target lane references a board and `idea.effort === null` → `effortRequiredForReferenceLane`; a task leaving its board's first lane with any blocker not in a final lane → `taskBlocked`. `BoardService.update` `ideaMoves` into a reference lane applies the Effort rule (Ruling 6). Reads return `blockedBy: [{ideaId, itemKey, isFinal}]`.

- [ ] Failing tests first for each of the three 422s.

## Task 9 (slice 229, QA): Effort rule and dependencies

Three-item cycle, duplicates in the set, clearing with `[]`, soft-delete removing both directions, `taskBlocked` with a blocker in a non-final lane of the same board, Effort via `ideaMoves`, `blockedBy` read shape.

## Task 10 (slice 230, backend): Sprints per board

**Files:** Sprints row; `SprintsController` gains `GET/POST boards/:boardId/sprints`; `SprintItem` gains `boardId`; `SprintRepository.listByBoard`; new narrow `SprintBoardsPort` (board org, `sprintsEnabled`, archived).

**Behavior:** `createForBoard` → `sprintsNotEnabled` 422; `assignToSprint` for a board sprint refuses an item from another board (`sprintItemOnOtherBoard`) and does not require the Delivery phase; `complete` for `boardId != null` clears every item not in a final lane (new domain transition without the phase guard) and reports `carriedOverIssueCount`; `delete` likewise; `countsBySprintIds` counts done as "in a final lane" for board sprints; board-sprint reads list items regardless of phase. Legacy `boardId = null` paths unchanged.

## Task 11 (slice 231, QA): Sprints per board

Create on a disabled board, cross-board item, completion carry-over with mixed final/non-final items, non-Delivery items, legacy sprint untouched, counts.

## Task 12 (slice 232, backend): Outcomes — entity, service, routes

**Files:** the new Outcomes row of the file map. Copy the Sprints layering for the entity, soft delete, owner check and display name; Tags for the random colour (`RandomSource`); Statuses for exact-set reorder. Add `outcomeId` to the domain `Idea`, `fromRow` and `scalarWriteData`.

**Routes and rules:** exactly `contracts/outcomes.md` as decided in `SPEC/20-feature-board-references.md` "Further decisions" (`GET/POST organizations/:orgId/outcomes`, `GET/PUT/DELETE …/:id`, `PUT …/outcomes/order` declared before `:id`, `PUT ideas/:ideaId/outcomes`, `GET organizations/:orgId/roadmap`); copy the answered questions into `contracts/outcomes.md` in this slice (the contract's last open-questions section is replaced by the decisions). Grouping: a task (has a parent) is `422` `taskCannotBeGrouped`; standalone cards on child boards are allowed; unknown, deleted or other-org Outcome is `404`; a no-op grouping writes no audit. Audit events as in `contracts/outcomes.md`.

## Task 13 (slice 233, backend): Outcome rollups and metric types

The spec leaves the metric-type table unsettled ("reuse the user-defined fields machinery where it fits"). **Stop and ask the owner** before this task: decide the shape (reuse custom field definitions of numeric type with projected/realized values per item, versus a new `metric_types` table). Everything else in the rollup (`ideaCount`, `doneIdeaCount`, `taskCount`, `doneTaskCount`, sprint span, quarter placement) is derived read-side and can be built before that decision; value totals wait for it.

## Task 14 (slice 234, QA): Outcomes

Every rule and decided default in `contracts/outcomes.md`, role matrix (Org Admin mutate; members read; Read Only read; direct Site Admin 403 and View As allowed), reorder exact-set, grouping rules including tasks and standalone cards, soft-delete exclusion, rollup counts against a two-board fixture.

---

## Self-review against the spec

- **Spec coverage.** Behavior 1–4 (Task 6, 8), 6 (Task 2), 7 (Task 12–13), 9 (all tasks reuse existing role helpers). Data model: lanes/final (2), keys (4), parent (6), dependencies (8), sprints (10), Outcomes (12–13). Effort entry (8). Plan 1 carried items: 1–3 → Task 4/8/9 and Rulings 3, 9; 4 → Task 4; 5, 8, 9, 11 → Task 0; 6 → Task 0 and 6; 7 → Task 2; 10 → Task 4; 12 → noted for the first task that runs the seed integration tests.
- **Open for the owner.** Task 13's metric shape (the plan stops there). Order against Sprint 14's QA slices (181, 184) and the cutover is the owner's call.
- **Not here.** UI (Plan 3), removals (Plan 4). The UI plan needs: the lane-save shape, `itemKey`, `taskCounts`, `blockedBy`, sprint reads, the Outcome routes — all fixed by Tasks 0–14.
