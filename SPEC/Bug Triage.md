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

All ten previously open items were promoted into `SPEC/sprints/sprint-07.5-accessibility-and-bug-paydown.md` on 2026-08-25 and deleted from here per the "Promote and delete" rule above — that sprint file is now their only home. They came from a live UI/UX pass against `dev` at `875b223` on 2026-08-16.

From the owner's ad-hoc testing on 2026-10-01, taken one at a time:

6. **An idea's assignees cannot be chosen.** `20-feature-ideas-and-engagement.md` (field list and
   rules 12–13) gives an idea zero to five assignees from its organization, and the API accepts
   `assigneeUserIds`, but the idea form has no picker: it resends the idea's existing assignees.
   Slice 147.
7. **The tags input does not suggest or confirm.** `20-feature-ideas-and-engagement.md` rules 2–5:
   select existing organization tags or create new ones, autocomplete from two characters, an
   unmatched tag created on save. The form is a comma-separated text box. The owner adds: when nothing
   matches, offer to create the tag rather than creating it silently. Slice 148, after 147, reusing
   its picker.

