---
name: status
description: Ground-truth project status for Collega. Use before any status, planning, or scope claim — what is built, in progress, or next — and whenever the user asks "where are we".
---

# Ground-truth status

AGENTS.md's Ground-Truth Verification rule, as a procedure. Never answer from recollection, even
within one conversation: parallel worktree agents land work you have not seen.

1. In the same turn, read `SPEC/implementation-agent-tracker.md`'s **Current Status** section and
   run `git log --oneline -10` (plus `git worktree list` to see work still in flight).
2. Read the index and the top few entries of `SPEC/decisions.md` if the question touches planning
   or scope. Open archived entries (`SPEC/decisions/`) or `SPEC/tracker-history.md` only when the
   question is about history.
3. Cross-check: if the tracker's header and its table disagree, or a recent commit isn't reflected
   in the tracker, say so — neither is trustworthy until re-derived from `git log` and the tree.
4. Answer briefly: what shipped, what's in flight, what's next, and anything stale you found. Cite
   commit hashes rather than dates from memory.
