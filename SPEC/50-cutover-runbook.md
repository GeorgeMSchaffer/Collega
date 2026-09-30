# 50 — Cutover Runbook

> **At a glance** (added 2026-09-29, slice 135 — conversion slice **F4**)
> - **Scope:** the go/no-go checklist, the release sequence, the rollback posture and the first-day
>   checks for putting the TypeScript stack on production. Operational only. `SPEC/50-vercel-deployment.md`
>   explains the reasoning; where it and this runbook differ on a procedure, this runbook and the
>   code win.
> - **Key rules:** `pnpm check` is the gate, not the golden replay; there is no data to migrate from
>   .NET — the target is seeded fresh. Code rolls back; the database does not, and there is no
>   older stack behind either.
> - **Decisions:** 2026-09-29 "How the cutover is run" (this runbook's owner answers); 2026-09-09 "The drifted database is rebuilt, not migrated"; 2026-09-10 "How the two
>   Vercel projects are configured, and how production gets its first administrator"; 2026-09-11 "The
>   golden replay is not a gate, and never was meant to be one"; 2026-09-29 "Spec contradictions
>   resolved".

**Owner** marks a step only the account holder can do: it needs the Vercel team, the Prisma Postgres
console, a production credential, or the merge to `main`. Everything else can be done by whoever
prepares the release.

**Where this starts from.** Production is not a blank slate. Both Vercel projects exist (`collega`
for web, `collega-api`), `collega-api` production has answered `GET /api/v1/health` with `200`, and
a real sign-in has succeeded (`SPEC/tracker-history/2026-09-28-rows-part-1.md`, "Deployment
(Vercel)"). So "cutover" here means **the first release of the finished conversion onto `main`**,
against a database that holds nothing worth keeping. There is no .NET deployment to switch away
from and no data transform to run: F3 is not a slice (`SPEC/50-vercel-deployment.md` §10).

---

## 1. Go/no-go checklist

Every line is a **go** or the release does not start. Record the answer next to each line in the
release notes or the pull request. Names only — **never write a value into this file, a pull
request, or a commit.**

### Code

| # | Check | How | Who |
|---|---|---|---|
| 1 | `pnpm check` green on the exact release commit (the `dev` tip being promoted) | `pnpm check` locally, and the CI run on that commit (`.github/workflows/ci.yml` runs it on pushes to `dev` and `main` and on every pull request) | anyone |
| 2 | Playwright suite green | `pnpm test:e2e` against a scratch local database (`e2e/AGENTS.md`); it is not part of CI | anyone |
| 3 | `SPEC/Bug Triage.md` `TODO` empty, or each open item accepted for this release by the owner | read the section | anyone; acceptance is **Owner** |
| 4 | Golden replay triage recorded — **not a gate** | the last replay's counts and the fix / accept / do-better call on each unexplained difference, written down (`SPEC/decisions.md` 2026-09-11). An unrunnable or unclean replay blocks nothing | anyone |
| 5 | The pending migrations are additive | read every directory under `packages/infrastructure/prisma/migrations/` newer than production's last applied one; nothing drops or renames a column or table that the currently deployed code still reads (`SPEC/50-vercel-deployment.md` §10) | anyone |

### `collega-api` environment variables — **Owner**

Check in Project Settings → Environment Variables, by reopening each entry and reading its
environment badges.

| Name | Production | Preview | Check |
|---|---|---|---|
| `DATABASE_URL` | required | required | A direct `postgres://` / `postgresql://` URL, **not** `prisma+postgres://`. Unprefixed — a store connected with `--prefix` writes `<PREFIX>_POSTGRES_URL`, which nothing reads. **Production and Preview hold different databases**; each entry is ticked for exactly one environment. |
| `ACCESS_TOKEN_SIGNING_KEY` | required | required | At least 32 characters (the API refuses to boot otherwise); different per environment. |
| `SITE_ADMIN_EMAIL` | required | required | The real address in Production; a throwaway in Preview, so staging never receives the production credential. |
| `SITE_ADMIN_PASSWORD` | required | required | Present. It stays after first login — deleting it takes the API down on the next cold start (§8 of the deployment spec). |
| `ANTHROPIC_API_KEY` | optional | optional | Either present, or absent **by decision** — absent means AI idea assist runs dark (`503` on turns, availability `false`). |
| `ACCESS_TOKEN_LIFETIME_MINUTES` | optional | optional | Unset means 480. |
| `COLLEGA_ALLOW_DEMO_SEED` | **must be unset** | either | Set, it switches on the Site Admin's demo-data seed and reset (`apps/api/src/demo-seed/`) in production. |
| `POSTGRES_*` | **must be unset** | **must be unset** | Local-container parts only. |
| `BOOTSTRAP_ORG_*` | **must be unset** | **must be unset** | Belong in the operator's shell for one run, never in the project (deployment spec §8a). |
| `PROMPT_EVAL_ANTHROPIC_API_KEY` | **must be unset** | **must be unset** | A developer tool's key, never production's. |

### `collega` (web) environment variables — **Owner**

| Name | Production | Preview | Check |
|---|---|---|---|
| `COLLEGA_API_URL` | required | required | Ends in `/api/v1`, no trailing slash, not `NEXT_PUBLIC_`. Production names **`collega-api`'s production `*.vercel.app` URL** — a custom API domain is a later, separate change. Preview names the `collega-api` branch alias for `dev`. The value is Sensitive and cannot be read back — confirm it by the smoke checks in §2 step 9, not by reading it. |
| `MOCK_LATENCY_MS`, `MOCK_FAIL` | unset | unset | Inert in production anyway; unset keeps the matrix honest. |

### Project settings — **Owner**, confirm in the dashboard

None of these can be expressed in `vercel.json`, so nothing in the repository proves them.

- [ ] `collega` Root Directory is `apps/web`, Output Directory override is **off**, framework Next.js.
- [ ] `collega-api` Root Directory is `apps/api`, framework Nest.js.
- [ ] Node.js Version is 24.x on both.
- [ ] `collega-api`'s function `maxDuration` is **60 seconds** — the user's decision
      (`SPEC/decisions.md` 2026-09-29) — set in project settings; confirm it in the dashboard. It
      cannot live in `vercel.json` (`README.md`, "Two things that are load-bearing and invisible").
- [ ] Vercel Authentication is **off** for `collega-api` (on, every server-side call from web gets an
      SSO page instead of JSON).
- [ ] Production branch is `main` on both projects.
- [ ] A separate staging Prisma Postgres database is provisioned, and Preview's `DATABASE_URL`
      points at it — ticked for Preview only. The tracker records that Preview's `DATABASE_URL`
      points at the database holding the real Site Admin; **until the staging database exists and
      Preview points at it, this line is a no-go.** Its first preview build migrates it and creates
      Preview's throwaway Site Admin; confirm from that build's log which database it touched.
- [ ] Prisma Postgres backup retention and point-in-time window for the production database are
      known and written down (`SPEC/50-vercel-deployment.md` §10). Not documented in the repository.

### The database — **Owner**

- [ ] Production starts **fresh** on a **new** Prisma Postgres database (§2 step 2), not a wiped
      one: nothing on the current production database is kept (`SPEC/decisions.md` 2026-09-09).
      The old database is kept, untouched, until the release is confirmed (§4), and then deleted.
- [ ] `SITE_ADMIN_EMAIL` in Production is not already owned by a non-admin or inactive account —
      `db:bootstrap-admin` fails the build with exit 1 in that case (deployment spec §8).

---

## 2. Sequence

In order. Each step says what proves it worked; stop at the first that does not and go to §3.

1. **Freeze `dev`** for the release. Note the commit hash to be released. *(anyone)*
2. **Create the new production database.** Provision a new Prisma Postgres database in the region
   the functions use (`iad1` in both `vercel.json` files), take its direct `postgres://` string, and
   replace `collega-api`'s Production `DATABASE_URL` with it — ticked for Production only. Leave the
   old database as it is: repointing `DATABASE_URL` back at it is this step's rollback. The new value
   reaches nothing until a build runs (step 6), and the first build migrates the empty database and
   creates the Site Admin. Do this immediately before the merge in step 5. *(**Owner**)*
3. **Confirm the release rebuilds the API**, or step 2's `DATABASE_URL` never takes effect:
   `pnpm turbo query affected --base=<production's last deployed commit> --packages @collega/api`
   must list `@collega/api` for the release range. If it does not, add a commit touching `apps/api/`
   to the release — or, from a shell with the new `DATABASE_URL` exported, run
   `pnpm --filter @collega/infrastructure db:migrate` and then `db:bootstrap-admin` by hand. The
   running deployment keeps the old database until a new build is live (values are baked at build
   time); anything that serves against the new `DATABASE_URL` before it is migrated will answer API
   errors, so expect them in that window. *(anyone runs the query; **Owner** runs the commands)*
4. **Run §1's checklist** against that commit and record the answers. *(anyone, then **Owner** for the
   owner lines)*
5. **Open the release pull requests through a sync branch**, as for pull requests #22–#27: push
   `dev`'s tip as `sync/<date>` (`git push origin dev:sync/<date>`), then open two pull requests from
   it, one into `dev` and one into `main`. CI runs `pnpm check` on each. *(anyone opens them;
   **Owner** merges the one into `main`)*
6. **What builds.** The merge to `main` starts a Production build on each project whose ignore step
   reports its package affected (`turbo query affected --base=$VERCEL_GIT_PREVIOUS_SHA`):
   - `collega-api`: install, `turbo run build --filter=@collega/api`, then
     `db:migrate` (`prisma migrate deploy` against Production's `DATABASE_URL`), then
     `db:bootstrap-admin`. A failure at any step fails the build, and **the previous deployment keeps
     serving**.
   - `collega`: install and `turbo run build --filter=@collega/web`. No database.
   - **The ignore-step trap.** A project whose app directory and its dependencies did not change since
     its previous deployment shows **CANCELED** — not a failure. That is also why an environment
     variable change reaches nothing on its own: Vercel bakes values at build time, a redeploy of the
     same commit is cancelled by the same step (`apps/web/AGENTS.md`), and an empty commit touches no
     path. **To rebuild after an env change, ship a commit that touches a file under `apps/api/`
     (for the API) or `apps/web/` (for web)** — a comment or markdown file is enough — and promote it.
   - **This release must rebuild `collega-api`** — step 3 checked it.
   *(Vercel; **Owner** watches both build logs)*
7. **Read the `collega-api` build log.** *(**Owner**)*
   - `prisma migrate deploy` lists the migrations it applied, or says there are none pending.
   - The bootstrap ends with `created Site Admin …` or `… already exists`.
   - The entrypoint: the log is **expected** to show `server.js` → `dist/bootstrap.js` being used —
     expected from the deployment spec §3, not verified against a recorded log. Compare with the last
     good `collega-api` build log. A successful build that never mentions `server.js`, with a compile
     step after the custom build command, is the silent failure in `SPEC/50-vercel-deployment.md`
     §11 — treat it as a failed release.
8. **Confirm which database the build touched** — the **new** production database for this build.
   The first preview build after any change to `DATABASE_URL` must be checked the same way for
   staging (§12 step 10 of the deployment spec). *(**Owner**)*
9. **Smoke checks, against production**, in order:
   1. `curl -i https://<api host>/api/v1/health` → `200`, `{"status":"Healthy",…}`. No auth, no
      database — proves routing and boot. *(anyone)*
   2. `curl -i https://<api host>/api/v1/auth/me` → `401` with a JSON problem document. HTML, a
      redirect or a 404 means Deployment Protection or the entrypoint (§11 of the deployment spec),
      not a code bug. *(anyone)*
   3. Open the web app and **sign in as `SITE_ADMIN_EMAIL`**. On the new database the Site Admin was
      just created, so the first sign-in forces a password change, and the change signs you out to
      `/login?passwordChanged=1`; sign in again with the new one. If the build reported
      `… already exists` instead, there is no forced change — sign in with the existing password.
      *(**Owner** — only they hold the credential)*
   4. **Create an organization:** Settings → Organizations → New. It is provisioned with default
      statuses, idea types, business impacts and an `Ideas` board; its invite code shows on the
      Organizations list. *(**Owner**)*
   5. **Create an Org Admin:** Settings → Users → New, choosing that organization and the Org Admin
      role. Hand the temporary password over out of band. *(**Owner**)*
   6. **Register a user:** in a private window, `/register` with the invite code typed into the field
      (not in the URL). It returns to `/login` with *Your account was created*; sign in. *(anyone
      given the code)*
   7. **Create a board:** as the Org Admin — or as the Site Admin through Settings → View As, since a
      direct Site Admin cannot change organization content — Settings → Boards → New. *(Owner or the
      Org Admin)*
   8. **Create an idea** on that board as the registered user, and see it on the board. *(the
      registered user)*
   9. If `ANTHROPIC_API_KEY` is set: signed in, `GET /api/v1/ai-assist/availability` reports
      available, and a turn in the idea form answers. If it is deliberately unset, the form shows the
      plain fields and nothing errors. *(anyone signed in)*
10. **Decide the smoke-test data.** Keep the organization if it is the real first tenant; otherwise
   archive it (Settings → Organizations). Archiving invalidates its invite code. *(**Owner**)*
11. **Go live.** Hand out the real organization's invite code and `/register` address as two separate
   messages (`SPEC/50-vercel-deployment.md` §12 step 12). *(**Owner**)*
12. **Record the release.** Tracker row for the release with the `main` merge hash and both
    deployment ids; mark F4 done in `SPEC/50-typescript-migration.md`. *(anyone)*

---

## 3. Rollback posture

**Code rolls back; the database does not, and there is no older stack behind either.** No .NET
deployment exists to fall back to (`SPEC/50-typescript-migration.md` §7).

### What rolls back

- **Code, per project, in seconds.** Vercel keeps every deployment; Instant Rollback (or promoting a
  previous deployment) points production back at it without a build, so the ignore step and the
  build command do not run — no migration, no bootstrap. *(**Owner**)*
- **Roll back `collega` and `collega-api` together** unless you know the pair is compatible.
- **Environment variables** roll back only with a new build: change the value, then ship a commit that
  touches the right app directory (§2 step 6).
- **The database swap (§2 step 2).** Environment variables are baked into a deployment at build
  time (`apps/web/AGENTS.md`), so the `collega-api` deployment before the release still reads the
  **old** database: an Instant Rollback of `collega-api` is also a rollback to the old database.
  Then set Production's `DATABASE_URL` back to the old database's string, so the next build does not
  land on the new one. This is why the old database is kept until the release is confirmed.
  *(**Owner**)*
- Whether Vercel pauses automatic production assignment after an Instant Rollback, and how to undo
  that, is a Vercel setting — **confirm in the dashboard** before the release, not during an incident.

### What does not

- **Prisma migrations are forward-only.** Rolling code back leaves the schema where the migration put
  it; that is safe only because §1 check 5 keeps every migration additive.
- **A migration that fails** fails the build, so the new code never goes live and the old deployment
  keeps serving. Prisma records the failed migration, and every later `migrate deploy` refuses until
  it is resolved. Recovery, by whoever holds the production `DATABASE_URL`: undo whatever part of
  the migration applied, mark it rolled back with
  `pnpm --filter @collega/infrastructure exec prisma migrate resolve --rolled-back <migration> --schema prisma/schema.prisma`,
  fix the migration in a new commit, and release again. *(**Owner**; Prisma's documented recovery,
  not yet exercised in this repository)*
- **A migration that applied but is wrong** is fixed forward: a new additive migration in a new
  release. Never edit an applied migration's directory.
- **Data.** Restoring rows is Prisma Postgres's backup and nothing in this repository. Until real
  users have written anything, rebuilding (`db:migrate`, then `db:bootstrap-admin`) is equivalent
  and takes seconds.

### Decision points

| Symptom | Call |
|---|---|
| A §1 line is no-go | Do not start. |
| Build fails before `db:migrate` | Nothing changed in production. Fix and re-release. |
| `db:migrate` fails | Old deployment still serving. Resolve the migration as above; do not roll back code — there is nothing to roll back. |
| `db:bootstrap-admin` fails (exit 1) | Migration already applied; old code still serving against the new schema — safe if check 5 held. Fix the account or `SITE_ADMIN_EMAIL` (deployment spec §8), then ship an `apps/api` commit. |
| Build green, smoke 9.1 or 9.2 fails | Configuration or entrypoint, not code: see §11 of the deployment spec. Roll back `collega-api` if the previous deployment was answering. |
| Sign-in or an app flow fails | Instant Rollback of both projects — which also returns the API to the old database — and repoint Production's `DATABASE_URL` at the old database; then diagnose on a preview. |
| After real users have written data | A rollback no longer loses only code; restoring the database would lose their writes. Prefer fixing forward, and treat a restore as an announced event. |

---

## 4. Post-cutover: the first day

Where to look: **Vercel → project → Logs** (runtime logs) for `collega-api` and `collega`, and each
deployment's build log. The API answers errors as problem documents carrying a `traceId`; search
the runtime logs for it. No external error tracker is configured in this repository.

- **Boot failures** on `collega-api` — a config problem names the missing or short variable
  (`ACCESS_TOKEN_SIGNING_KEY`, `SITE_ADMIN_*`, `DATABASE_URL`).
- **`Nest can't resolve dependencies of … (?)`** — the wrong artifact was deployed (§11 of the
  deployment spec). Roll back.
- **Missing query engine** on the first database call — the `binaryTargets` fix in §5 of the
  deployment spec.
- **Connection-limit errors** under load — add `?connection_limit=1` to `DATABASE_URL`, then an
  `apps/api` commit to rebuild.
- **HTML where JSON was expected** in `collega` logs — Deployment Protection on the API.
- **`429`s and lockouts** on sign-in — the auth rate limiter and the five-attempt lockout are working
  as designed; a burst of lockouts is the known denial-of-service risk in the tracker's "Known open
  risks", not a defect to hot-fix.
- **Users signed out at random** — two instances signing with different keys: check
  `ACCESS_TOKEN_SIGNING_KEY` is set for Production.
- **Once the release is confirmed**, delete the old production database in the Prisma Postgres
  console. From then on a rollback reaches code only, not the pre-release database. *(**Owner**)*
- At the end of the day: re-run the health and `/auth/me` checks, confirm `COLLEGA_ALLOW_DEMO_SEED` is
  still unset on Production, and write the outcome into the release's tracker row.
