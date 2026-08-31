# 11 — What happens to the specs?

Type: grilling
Status: open
Blocked by: —

## Question A — When are the specs rewritten?

### Select one

- [ ] **Before** the conversion *(recommended)*. Matches the standing repo rule: canonical spec first, then tests, then implementation.
- [ ] **Alongside** it, per slice.
- [ ] **After** the conversion lands.

## Question B — Which specs get rewritten wholesale?

### Check all that are implementation guides rather than behavior specs

- [ ] `30-Contracts.md` — routes described in ASP.NET terms
- [ ] `40-test-strategy.md` — assumes xUnit and the current project layout
- [ ] `90-definition-of-done.md` — same
- [ ] `src/*/CLAUDE.md` — every one describes a C# project that will not exist
- [ ] `50-postgres-migration.md` — arguably history now, not instruction
- [ ] `00-project-brief.md` and `10-requirements.md` — *probably not*: stack-agnostic behavior, edit lightly

## Question C — Disposition for the derived artifacts

### Select one

- [ ] **Regenerate** `SPEC/SPECKIT/specs/` copies and `Specs Overview.md` from the rewritten canonical specs *(recommended)*
- [ ] **Delete** them for the duration of the conversion and rebuild after
- [ ] **Leave** them; accept they will be stale

## Why this ticket exists

Left unaddressed, this produces exactly the failure mode this repo has already been burned by: **authoritative documents describing a system that no longer exists, read as current by the next agent.** The tracker was split from a 291-line narrative log for that reason, and `CLAUDE.md` carries a standing warning about a frozen status snapshot that once caused a major planning error.

Two further things to decide in passing:

- **`SPEC/archive/`** already holds documents asserting the project is unstarted, true when written. A second stack's worth of superseded material lands on top. The "don't read unless asked for history" rule has to still hold afterward.
- The repo deliberately **keeps SQL-Server-era comments** because they explain why code differs post-migration. The conversion will generate a similar class of "why is this like this" knowledge. Decide up front where it goes.
