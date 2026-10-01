# Contracts: demo-seed

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices. Written from the code
(`apps/api/src/demo-seed/demo-seed.controller.ts`) on 2026-10-01; the routes themselves date from
2026-09-14 and were kept, opt-in only, by `SPEC/decisions.md` 2026-09-30 ("What the MVP release
includes", item 2).

## Demo Seed Contracts

Settings → Demo data seeds and resets the demo world on a deployment that has opted in. Both routes
run exactly the code `pnpm db:seed` runs (`runDemoSeed`, `resetDemoSeed` in
`packages/infrastructure/src/demo-seed`).

- **The opt-in.** Both routes answer only while the environment variable `COLLEGA_ALLOW_DEMO_SEED` is set to a non-blank value on the API deployment. Production never sets it, and it is unset by default. It is read per request, but Vercel bakes environment variables into a build, so setting it takes a new build of the API before it is seen. This is the exception to `SPEC/90-definition-of-done.md`'s rule that the demo seed does not run outside Development.
- **Switched off is `403`, not `404`.** The route exists in every deployment; where it has not opted in, it refuses with a `403` whose detail says so, and the Settings screen prints that detail.
- **Check order.** Authentication (`401`) and the Site Admin role check (`403`) come first; the opt-in check is second. A caller who is not a Site Admin never learns whether the deployment has opted in.
- **Ownership.** The seed owns only rows whose ids derive deterministically from the two demo organizations' slugs, so a reset never touches an organization, user or idea created by hand.

### `POST /api/v1/demo-seed`
Add the demo world, leaving anything already there alone.

- **Roles:** Site Admin only. A Site Admin acting through View As carries the target's role and is refused.
- **Request:** — (no body)
- **Response:** `200`:
  - `deletedRows` — always `0`
  - `modules` — array, one entry per seed module in the order it ran: `module` (the module's name) and `milliseconds` (how long it took)
- **Errors:**
  - `401` caller is not authenticated
  - `403` caller is not a Site Admin, **or** `COLLEGA_ALLOW_DEMO_SEED` is not set on this deployment. The second returns the detail "Demo seeding is switched off for this deployment. Set COLLEGA_ALLOW_DEMO_SEED on the project to enable it."
- **Rules:**
  - Idempotent. Every module upserts on a deterministic id, so a second run changes nothing and is the ordinary way to repair demo data somebody edited while exploring.
  - The route is synchronous: the response arrives when every module has finished.

### `POST /api/v1/demo-seed/reset`
Remove the demo world and build it again, for a walkthrough that starts from the top.

- **Roles:** Site Admin only, as above.
- **Request:** — (no body)
- **Response:** `200`:
  - `deletedRows` — the number of rows the reset removed, summed across every table it deletes from
  - `modules` — as for `POST /demo-seed`, from the re-seed that follows the deletion
- **Errors:** as for `POST /demo-seed`.
- **Rules:**
  - Deletes only seed-owned rows (see Ownership above), in foreign-key order, then runs the full seed. The deletion and the re-seed are not one transaction: a failure part-way leaves a partly seeded world, and running `POST /demo-seed` repairs it.
  - Ideas are deleted by organization rather than by board, because `ideas.board_id` carries no foreign key.
