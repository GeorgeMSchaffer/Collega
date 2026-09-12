# Bug Triage

The working queue of bugs and minor tweaks to fold into an upcoming sprint. Jot items down here in whatever shape is quickest — a sentence is fine.

**This file is a queue, not a roadmap and not a history.** Two neighbours carry what it deliberately does not:

- `SPEC/ideas-inbox.md` — unrefined feature ideas. Nothing there is scheduled, and nothing there blocks work.
- `SPEC/archive/bug-triage-completed.md` — everything already fixed.

## Workflow

- Read this document before starting or resuming feature implementation.
- Items under `TODO` take priority over new features. Do not start a new feature while `TODO` has unresolved items unless the user explicitly approves an exception.
- When an item is fixed and its focused validation passes, **move it to `SPEC/archive/bug-triage-completed.md`** with the completion date and a concise verification note. Do not leave it here.
- Never let an item exist in two places. If a change is incomplete, unverified, or deferred, it stays in `TODO` with its status noted.

### Promote and delete

**When an item is promoted, it leaves this file.** Promotion means it has been written into a canonical spec (`SPEC/20-feature-*.md`, `SPEC/30-Contracts.md`) or scheduled into a sprint plan (`SPEC/sprints/`). At that point the spec or sprint file is its only home — delete the entry here rather than annotating it as "now scheduled as Sprint N".

This rule exists because the opposite happened: entries were promoted and kept, so this file accumulated ~1,100 words of Sprint 6/7 feature design duplicated from `SPEC/20-feature-ai-idea-assist.md` and `SPEC/sprints/sprint-06-view-as.md`, complete with a superseded decision left in place under strikethrough. A duplicate goes stale independently of its source, and then the two disagree.

Two corollaries:

- **Record reversals by deleting, never by striking through.** A struck-through decision leaves both readings in context.
- **Closed is not a status here.** An item marked "CLOSED" belongs in the completed archive, not in `TODO`.

### Scope

- Bugs and minor tweaks → `TODO` below.
- Feature ideas → `SPEC/ideas-inbox.md`.
- Design decisions that change behavior → the canonical spec first, per `CLAUDE.md`.

Keep entries short. A symptom, where it happens, and — if you know it — the cause. Longer analysis is welcome when the analysis *is* the value (a diagnosed root cause worth not re-deriving), but a scheduled feature's full design belongs in its sprint or spec file.

## TODO

- **`UserService.create` never verifies the organization exists.** Found 2026-09-12 by the QA pass over `packages/application`. Every sibling service — `BoardService`, `StatusService`, `IdeaTypeService`, `BusinessImpactService`, `FieldDefinitionService` — calls `ensureOrganizationExists` after the scope check. `UserService` does not, and `authorizeOrganizationScope` returns immediately for a Site Admin, so nothing else catches it. A Site Admin posting to a nonexistent organization id gets a user row staged against it instead of a `404`; in production the foreign key on `users.organization_id` turns that into a `500` at commit. `UserService.import` has the same gap — it authorizes once up front through the same method. Reproduction is in the QA report and was deliberately not left in the suite, since a test asserting the current behaviour would pin the defect.

- **`IdeaService.canAdministerIdeaContent`'s Site Admin branch is unreachable.** Found 2026-09-12, same pass. `if (role === Role.SiteAdmin) return true` cannot fire: all seven callers (`update`, `reassignIdeaType`, `promote`, `returnToDiscovery`, `changeDeliveryStatus`, `assignToSprint`, `delete`) run `ensureNotDirectSiteAdmin` first, and a View As target is never a Site Admin (D-SCOPE, enforced in `ViewAsService.ensureMayActAs`). Confirmed by flipping it to `return false`, which breaks nothing in the 414-test suite. **Behaviour today is correct; the hazard is the reading.** It is dead code shaped like a live bypass, so a later reader can take it as the reason a Site Admin is handled and remove a guard that actually is. `BoardService.ensureAdminScope` faced the same choice and left a comment saying it avoided exactly this — `IdeaService` went the other way. Deleting the branch is the fix; it is a source change and so is not made by the agent that found it.

- **The auth rate limiter blocks the golden replay, so the F1 gate cannot run.** Found 2026-09-11 replaying against Nest on a fresh seed. `cli.ts` calls `runner.resetSessions()` after **every** scenario, so each of the 15 scenarios logs in again for each role it uses — far more than the "eight times per run" `AUTH_THROTTLERS`' doc comment claims, and that wrong number is why login's burst limit was set to 20 as if it left headroom. The run dies partway through `comments` with `429` on `POST /auth/login` and the remaining scenarios never execute. Neutralizing the limiter locally gives **323/447 match, 53 accepted, 71 unexplained, 0 stale** — a usable F1 signal that is otherwise unreachable. Fix is a decision, not a patch: cache sessions across scenarios (they are cleared for View As correctness, so not free), exempt a replay caller, or raise login's limit to something the corpus actually fits in. Note the comment in `apps/api/src/auth/rate-limit.guard.ts` was corrected the same day, but the limit it justified was not changed.

All ten previously open items were promoted into `SPEC/sprints/sprint-07.5-accessibility-and-bug-paydown.md` on 2026-08-25 and deleted from here per the "Promote and delete" rule above — that sprint file is now their only home. They came from a live UI/UX pass against `dev` at `875b223` on 2026-08-16.
