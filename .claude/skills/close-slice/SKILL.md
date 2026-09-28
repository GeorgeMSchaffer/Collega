---
name: close-slice
description: Finish a Collega slice — gate, review, tracker, merge into dev, clean up the worktree and branch.
disable-model-invocation: true
argument-hint: <feature-branch>
---

# Close a slice

Closes `$ARGUMENTS` (a `feature/<NNN>-<short-description>` branch). Stop and report at the first
step that fails; don't work around it.

1. **Gate.** In the branch's worktree, run `pnpm check`. It must be green — lint, typecheck, test
   and build. Report the failing output verbatim if it isn't.
2. **Review.** The Code Reviewer must approve before merge (AGENTS.md). If no approval is recorded
   in this session, dispatch the `collega-reviewer` agent on the branch's diff against `dev` and
   stop on any blocking finding.
3. **Tracker.** Update `SPEC/implementation-agent-tracker.md` for the finished slice, and add a
   `SPEC/decisions.md` entry if the slice settled something later work must respect. A finished
   row moves verbatim to `SPEC/tracker-history.md` (the tracker's Maintenance Rule 6); a new
   decision goes in full at the top of the entries, with an index line (the rotation rule at the
   top of `decisions.md`). Commit on the
   feature branch — focused message, no references to Claude, agents, or code generation.
4. **Merge.** From the main checkout on `dev`: `git merge --no-ff <branch>`. Report the merge
   commit hash.
5. **Clean up.** `git worktree remove <path>` then `git branch -d <branch>` (lowercase `-d`: it
   refuses an unmerged branch, which is the point).
6. Push only if the user asks.
