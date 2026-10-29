# Handoff: slice 356, Restricted boards and groups QA

Written 2026-10-28. Delete this file in the commit that finishes slice 356.

## Goal

Finish slice 356 (QA for slice 355's web UI), get it reviewed and merged. Scope is the 356 row of
`SPEC/20-feature-board-access-and-groups.md`: web unit tests, `e2e/tests/restricted-board.spec.ts`,
and a browser check.

## Where things stand

- Slice 355 is merged: PR #70, merge commit 2d139779. The reviewer approved it on 2026-10-28.
- Branch `feature/356-board-access-ui-qa` was cut from `origin/dev` at 3599dbdf. It is committed
  locally but **not pushed**, and there is no PR yet.
- A QA subagent wrote the tests. Two QA runs (one on Sonnet, one on Opus) stopped on the weekly
  usage limit, which resets Oct 29 at 5pm America/Phoenix.

### Web unit tests: done, 90 pass

| File | Tests | Covers |
|---|---|---|
| `apps/web/test/groups-screen.test.tsx` | 16 | Groups list and drawer, Org Admin vs member controls, delete confirmation naming boards |
| `apps/web/test/groups-page.test.tsx` | 11 | `/settings/groups` page, `openToMembers`, hub Groups card |
| `apps/web/test/group-actions.test.ts` | 10 | Group save and delete actions, errors |
| `apps/web/test/access-section.test.tsx` | 21 | Access section: shown or hidden, kept list, empty callout, head count, *Who?* |
| `apps/web/test/load-access-setup.test.ts` | 7 | `/users` vs `/members` loader |
| `apps/web/test/board-actions-access.test.ts` | 19 | Access fields on create POST, `PUT /boards/{id}/access` on edit, 400 keys in the banner |
| `apps/web/test/lock-marks.test.tsx` | 6 | Lock marks on restricted boards only |

Run: `cd apps/web && npx vitest run test/access-section.test.tsx test/board-actions-access.test.ts test/group-actions.test.ts test/groups-page.test.tsx test/groups-screen.test.tsx test/load-access-setup.test.ts test/lock-marks.test.tsx`

### Playwright spec: written, NOT passing yet

`e2e/tests/restricted-board.spec.ts` has one test with these steps: an Org Admin restricts a board
to a group, a member sees it, a non-member gets Not found and doesn't see it in the list, and a
removed member loses it. A `finally` block restores the board and the group.

- The first agent ran the whole flow, up to one failing locator. The lock mark's sr-only text
  "Restricted" (`apps/web/components/access/lock-mark.tsx:14`) also matched a link.
- Line 112 now reads `row.getByText('Restricted', { exact: true })`. The second agent may have
  changed it, and that change was **never run**.
- Before running, reseed with `pnpm --filter @collega/infrastructure db:seed`. Then run only this
  spec, following `e2e/AGENTS.md`. Run it twice to prove it can be rerun.

### Not done

- `pnpm check` on this branch.
- The browser check named in the slice plan.
- Tracker update: the "Restricted boards and user groups" row in
  `SPEC/implementation-agent-tracker.md`, marked 356 built.
- Push, open the PR against `dev` (ready for review), then run the `collega-reviewer` agent. The
  user merges.

## Next steps

1. Get the e2e spec green, two runs in a row.
2. Run `pnpm check`. If `apps/web/next-env.d.ts` gets modified, `git checkout` it.
3. Do the browser check. Start the preview with `preview_start` name `dev`. The web app is on
   3005, not 3004.
4. Update the tracker and delete this file. Commit, push, open the PR, and run the reviewer.
5. Then the next open item: the idea-scoped mention and assignee candidate lists (BAG 4e).

## Rules carried over

- Commit messages: no references to AI or agents. End with the `Co-Authored-By` trailer.
- Never print `.env`. Load it silently: `set -a; . /Users/gms/code/GitHub/Collega/.env >/dev/null 2>&1; set +a`.
- Demo accounts: `orgadmin@`, `user@` and `readonly@acme-robotics.demo.collega.test`. The password
  is `DEMO_PASSWORD` in `packages/infrastructure/src/demo-seed/modules/scenario.ts`.
- Before any status claim, re-read the tracker's Current Status and run `git log`.
