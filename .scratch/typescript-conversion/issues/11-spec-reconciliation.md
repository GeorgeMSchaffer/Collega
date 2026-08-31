# 11 — What happens to the specs?

Type: grilling
Status: open
Blocked by: —

## Question

`SPEC/*.md` is canonical and gates work — but parts of it are written in .NET vocabulary. `30-Contracts.md` describes routes in ASP.NET terms. `40-test-strategy.md` and `90-definition-of-done.md` assume xUnit and the current project layout. Every `CLAUDE.md` under `src/*` describes a C# project that will not exist.

Left unaddressed, this produces precisely the failure mode this repo has already been burned by: **authoritative documents describing a system that no longer exists, read as current by the next agent.** The tracker was split from a 291-line narrative log for exactly that reason, and `CLAUDE.md` carries a standing warning about a frozen status snapshot that once caused a major planning error.

**Resolve by:** deciding

1. **When** — specs rewritten ahead of the conversion, alongside it, or after. The standing repo rule is canonical spec first, then tests, then implementation; a rewrite is the moment that rule is most likely to be quietly abandoned.
2. **Which kind** — separating **behavior specs** (stack-agnostic; edit lightly) from **implementation guides** (stack-specific; rewrite wholesale). `00-project-brief.md` and `10-requirements.md` are almost certainly the former. `50-postgres-migration.md` is history, not instruction.
3. **Dispositions** for the derived artifacts: `SPEC/SPECKIT/specs/` downstream copies, and `Specs Overview.md` (already explicitly non-canonical).
4. **What happens to `SPEC/archive/`** — it already contains documents asserting the project is unstarted, which were true when written. A second stack's worth of superseded material lands on top of that, and the archive's "don't read unless asked for history" rule has to still hold afterward.

One thing to protect deliberately: the repo's habit of keeping SQL-Server-era comments *because they explain why code differs post-migration*. The conversion will generate a similar class of "why is this like this" knowledge, and it is worth deciding up front where it goes.
