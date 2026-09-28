# SPEC restructure for context efficiency

Self-contained work plan. A fresh session can execute it without prior conversation.
Status: approved 2026-09-28; Phase 1 awaiting review (slice 119, `feature/119-spec-context-restructure`). Documentation only; no application behaviour changes.

## Why
The 2026-09-28 cost review found the most expensive sessions were spec work, with context growing
late in each session. AGENTS.md makes every session read `SPEC/decisions.md` (108 KB, 49 entries)
and the Current Status of `SPEC/implementation-agent-tracker.md` (69 KB; Current Status is roughly
lines 15-221). API slices read `SPEC/30-Contracts.md` (117 KB, 2,070 lines, 20 contract sections).
SPEC/ totals about 1.5 MB. File reads truncate at 20 KB, so agents either page through far more
than they need or work from a partial view.

Goal: a new session loads only what it needs, and no fact is lost.

## Before you start
- Follow AGENTS.md: read the top of `SPEC/decisions.md` and the tracker's Current Status, and run
  `git log --oneline -10`.
- Branch off `dev`: `feature/<NNN>-spec-context-restructure`. Commit per step below, with no
  agent/AI references in commit messages.
- Re-measure the sizes and line numbers above before acting, since the files may have changed.

## Principles (hard rules)
1. **Phase 1 moves text, never deletes or rewords it.** Moved sections are byte-identical.
2. **Stable entry paths.** About 471 references in 200 files (code comments,
   `tools/golden/src/accepted.ts`, sprint files, SPECKIT copies) name `30-Contracts.md`,
   `decisions.md` and the tracker. Nothing reads them programmatically, so each file keeps its path
   and becomes an index, and **section headings keep their exact names** so pointers like
   "30-Contracts.md § Idea Contracts" still resolve through the index.
3. **Hot/cold.** The top file holds what a new session needs; detail is one link away.
4. **Don't touch** `SPEC/archive/`. Don't change behaviour. Raise any conflict or ambiguity with
   the user (one question at a time, multiple choice) instead of resolving it silently.

## Phase 1: split without changing text (one commit per step)

1. **decisions.md → index + archive**
   - Keep the header and the supersession rule.
   - Add an index of all entries, one line each: date, title, active or superseded, link.
   - Keep the newest ~15 entries in full, in the file.
   - Move older entries verbatim, still newest-first, to `SPEC/decisions/archive-<range>.md`
     (≤ 40 KB each).
   - Add a rotation rule: new entries go at the top in full; once the file passes ~40 KB, the
     oldest full entry moves to the archive, and its index line stays.

2. **Tracker → current status + history**
   - Keep: Purpose, Ground-Truth Verification, Pre-Feature Triage Gate, Current Status (active and
     next only), Locked decisions, Agreed order of work, Known open risks, Out of sprint scope,
     Notes For Next Agent, Maintenance Rule.
   - Move verbatim to `SPEC/tracker-history.md`: the completed-sprint narratives (Sprint 5 through
     7.5) and the 2026-09-12 Application QA pass write-up. Link it from the tracker.
   - Target ≤ 20 KB. Update the Maintenance Rule: finished items move to the history file.

3. **30-Contracts.md → conventions + index + per-area files**
   - Keep in `30-Contracts.md`: Purpose through Shared Data Rules (the conventions), plus an index
     table: section heading → file → route prefixes.
   - Move each `## <X> Contracts` section (and Notification Event Contract, and Notes if they are
     contract-specific) verbatim to `SPEC/contracts/<area>.md`. Areas: auth, view-as,
     organizations, users, statuses, idea-field-options, idea-type-fields, boards, ideas, delivery,
     sprints, issue-tasks, tags, comments, upvotes, ai-assist, notifications.
   - **Ask the user:** "Idea Field Option Contracts" appears twice (around lines 737 and 1665).
     Merge them, or keep both?
   - The "read, not edited by slices" rule covers the whole set. Say so in the index.

4. **"At a glance" blocks.** At the top of `05-product-definition.md`, each `20-feature-*.md` and
   each `50-*.md`, add a block of ≤ 10 lines: scope, key rules, related contracts file(s), related
   decisions. Leave the rest of each file unchanged.

5. **Update pointers and docs.**
   - `AGENTS.md` Source of Truth: describe the index/archive layout and the reading order ("read
     the index, open only the part you need").
   - Also update `SPEC/README.MD`, `.claude/agents/collega-reviewer.md` and the `status` skill, if
     they tell agents to read whole files.
   - Leave code comments alone, since the paths are stable.

6. **Verify Phase 1.**
   - A throwaway script (not committed) confirms that the moved parts reproduce each original
     section byte-for-byte, and that no section was dropped or duplicated.
   - Grep a sample of `§`/section-name pointers and confirm each resolves through an index.
   - Run `pnpm check`.
   - Code review, then merge to `dev` before Phase 2.

## Phase 2: condense and reword (starts after Phase 1 is merged)

**Guardrail, for every file:**
- Before editing, write a fact inventory in the session folder, not the repo: routes and methods,
  status codes, error codes, field names and types, roles and permissions, limits and numbers,
  MUST/NEVER rules, dates, and cross-references.
- After editing, rebuild the inventory and diff the two. They must match exactly.
- Then a fresh-context reviewer subagent re-checks the condensed file against the Phase 1 version
  (in the style of the verify-openspec-docs skill).
- One commit per file, so the user can review each on its own.

7. **Contract area files.** Rewrite each contract into a fixed template:
   `Route | Roles | Request | Response | Errors | Rules`. Behaviour stays the same. The golden
   corpus pins these contracts, so keep status codes, field names and error shapes exact.

8. **Feature and product specs** (`05`, `20-*`, `50-*`):
   - Remove duplication.
   - Turn narrative into lists.
   - Where a spec restates something already in another canonical file, replace the restatement
     with a link to it.
   - Keep a one-line "why" for each rule.

9. **Tracker Current Status.** Rewrite as terse status lines. Also give `SPEC/tracker-history.md`
   (about 83 KB after Phase 1) a rotation rule like `decisions.md`'s, so it splits into dated
   files of at most 40,000 bytes rather than growing without bound.

10. **decisions.md.** Entries stay verbatim (confirmed by the user). The log is the record, and
    AGENTS.md requires "enough of the reason". Condense only the index lines.

11. **Derived copies.** Re-point `SPEC/Specs Overview.md` and `SPEC/SPECKIT/specs/` at the new
    layout. Canonical files come first; derived files follow.

## Done when
- The tracker is ≤ 20 KB, and `decisions.md` and `30-Contracts.md` each load whole in one read or
  are clearly indexed.
- Phase 1's byte-level check passes, and every Phase 2 fact inventory matches.
- `pnpm check` is green and every step is merged to `dev`. Report the merge hashes.
- `SPEC/implementation-agent-tracker.md` records the work.
