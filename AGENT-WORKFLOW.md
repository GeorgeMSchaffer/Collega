# Epic worktree workflow

Use this workflow for epic-level work split across role-based slices. Read the sprint's own plan
before assigning work; a role without a scoped task sits out, and downstream UI work does not start
early.

- Use `feature/<NNN>-<short-description>` branches, each with its own worktree from `dev`.
  Backend work covers domain/application/infrastructure/API; UI/UX work covers client tasks; QA
  tests the same slice from a separate worktree; the Code Reviewer gates the other roles and is
  not a parallel implementer.
- The Code Reviewer checks the diff, build, tests and spec conformance, then approves before merge.
  Merge each finished slice into `dev`; after merge, remove its worktree and branch.
- Keep commits focused and human-written, with no AI or agent attribution. Commit at logical
  checkpoints. The release flow is feature branch → `dev` → `main`; report the merge commit hash.
- Open a ready pull request when work and checks are complete; use a draft only while work remains
  in progress or awaits a decision.
