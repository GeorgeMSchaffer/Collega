# 50 — Vercel Deployment

Canonical deployment spec for the TypeScript stack. It covers the two Vercel projects, what each
one builds, where migrations run, the environment matrix, how the first administrator comes to
exist, the preview topology, and the rollback posture.

**Target, decided 2026-09-03 (`SPEC/decisions.md`, conversion ticket `02`):** Vercel for both
applications, Prisma Postgres for the database. `SPEC/50-azure-deployment.md`,
`SPEC/50-azure-api-cicd.md` and `SPEC/50-kubernetes-deployment.md` describe the **frozen .NET
stack** and are not build instructions for anything shipping — Sprint 8 was cancelled and that
stack is never deployed.

> **What is in the repository and what is not.** Everything below that lives in files —
> `apps/*/vercel.json`, `apps/api/server.js`, the migration and bootstrap steps — is committed and
> was exercised locally. **Nothing on Vercel itself has been created or verified**: the two
> projects do not exist yet, and neither does the database. §11 lists exactly what remains
> unproven and what proving it would take; §12 is the ordered list of what only the account holder
> can do.

---

## 1. Two projects, not one

`apps/web` and `apps/api` deploy as **two separate Vercel projects from the same repository**.

This is forced rather than preferred. Mounting Nest inside the Next app would mean `apps/web`
importing `@collega/application` and `@collega/infrastructure`, which is a lint error enforced by
`biome.json`'s `noRestrictedImports` and asserted by `tools/boundaries` — the layer boundary that
`SPEC/50-typescript-migration.md` §4.3 exists to preserve. Ticket `08` anticipated the cross-origin
cost of two hosts and accepted it.

| | `collega-web` | `collega-api` |
|---|---|---|
| Root Directory | `apps/web` | `apps/api` |
| Framework Preset | Next.js | Nest.js |
| Config in repo | `apps/web/vercel.json` | `apps/api/vercel.json` |
| Talks to the database | never | **only this one** |
| Reached by the browser | yes | **never** (§4) |

Both `vercel.json` files set `framework`, `installCommand`, `buildCommand`, `ignoreCommand` and
`regions`, so those are version-controlled rather than typed into a settings page. **Root Directory
is the one setting that cannot live in the file** — Vercel needs it to find the file at all — so it
is set once per project in the dashboard and never changes.

---

## 2. Install and build

Both projects install from the **workspace root**, not from their own directory, because their
dependencies are sibling packages:

```
installCommand: cd ../.. && pnpm install --frozen-lockfile
```

`--frozen-lockfile` matches CI: a lockfile that disagrees with the manifests fails the deploy
instead of silently resolving something else.

Both build through Turborepo, which builds the workspace packages first (`^build`) and, for
anything downstream of `packages/infrastructure`, runs `prisma generate` first as well
(`turbo.json` makes `db:generate` a dependency of `build`; `packages/infrastructure`'s `postinstall`
is the second belt on the same braces):

```
collega-web   cd ../.. && pnpm turbo run build --filter=@collega/web
collega-api   cd ../.. && pnpm turbo run build --filter=@collega/api
              && pnpm --filter @collega/infrastructure db:migrate
              && pnpm --filter @collega/infrastructure db:bootstrap-admin
```

`@collega/web#build` has its own `turbo.json` entry whose outputs exclude `!.next/cache/**`; that
is required for a Next app under Turborepo and is already in place.

**The web build never needs a database.** Its only workspace dependency is
`@collega/design-system`, and `DATABASE_URL` is not among its inputs. Keep it that way: a web
deploy that can be blocked by the database is a web deploy that fails during an incident.

`ignoreCommand: npx turbo-ignore --fallback=HEAD^1` skips a project's build when nothing in its
dependency graph changed — a `SPEC/`-only commit stops burning two builds and two red checks. On
error `turbo-ignore` exits non-zero, which means *build anyway*; the failure mode is a wasted
build, not a missed one.

---

## 3. The API's entrypoint — `apps/api/server.js`

Vercel's Node runtime captures a server through its `listen()` call, and `apps/api/src/main.ts`
already ends in `await app.listen(config.server.port)` with `PORT` read from the environment
(`common/config/fragments/server.ts`). So the API needs no handler wrapper and no second copy of
the bootstrap — but it does need Vercel to run the **compiled** output.

**Why compiled and not the source.** Nest resolves constructor dependencies from
`design:paramtypes` metadata, which only `tsc` with `emitDecoratorMetadata` emits.
`apps/api/tsconfig.json` sets it; esbuild — what a bundler reaches for — does not implement it at
all. A deployment that compiled `src/main.ts` itself would look healthy and fail to resolve every
provider on the first request. This is the thing not to assume either way: `dist/main.js` is the
artifact that works, and reaching it is deliberate.

Vercel looks for an entrypoint named `app` / `index` / `server` / `main` at the project root
**before** it looks under `src/`, so a root file wins over `src/main.ts`:

```js
// apps/api/server.js
import './dist/main.js'
```

`apps/api/vercel.json` names `server.js` in its `functions` block (`maxDuration: 60`), which
doubles as an assertion: if Vercel resolved a different entrypoint, the pattern matches nothing and
the build says so rather than deploying the wrong file.

**If a deployment reports that `server.js` matched no function**, the entrypoint was resolved
differently. Read the build log for the file it chose, and prefer changing the file's *name* to
whatever Vercel is looking for over changing what it does — the requirement is only that the thing
Vercel runs is `dist/`-backed.

---

## 4. Cross-origin: there is none, and that is the design

**The browser never calls `apps/api`.** `apps/api/src/main.ts` calls no `enableCors()`, and
`apps/web` reaches the API server-side through `COLLEGA_API_URL` (`apps/web/lib/api/config.ts`),
forwarding the session cookie and re-issuing it on its own origin. `COLLEGA_API_URL` is
deliberately **not** `NEXT_PUBLIC_`: that would inline the API's address into the client bundle and
invite exactly the call CORS would then have to permit.

Do not add CORS to make something work. If a browser request to the API host is being blocked,
something is calling the API from the wrong side of the app.

---

## 5. Database and migrations

**Prisma Postgres** (ticket `02`), provisioned by the account holder — it does not exist yet.
Two databases: one for **production**, one shared **staging** database for every preview (§7).

### Where `prisma migrate deploy` runs, and why

In the **API project's build command**, after the build and before the deployment goes live.

- It is the only place that reliably holds the right `DATABASE_URL` for the environment being
  deployed, and it runs exactly once per deployment.
- It runs **before** the new function serves traffic, so the schema is never behind the code.
- A failed migration fails the build, so a deployment whose migration did not apply never goes
  live at all.
- It runs after the compile, so a build that was going to fail anyway never touches the database.

`prisma migrate deploy` is idempotent and takes an advisory lock, **and that covers the migration
step only**. Two qualifications, both of which have been read too generously before:

- The lock is released when `migrate deploy` exits, before the next `&&` in the build command runs.
  It says nothing about `db:bootstrap-admin`, which is the step two concurrent builds actually
  collide in — see §8 for how that step defends itself.
- "Serialize" overstates what the lock does even for the migration. A waiter that does not get the
  lock inside Prisma's timeout fails with `P1002` rather than queueing behind the holder, so under
  real contention the second build errors out and needs a redeploy. Idempotent means the redeploy is
  safe, not that it is unnecessary.

Migrations are additive — see the rollback posture in §10 before writing one that is not.

`packages/infrastructure/prisma/migrations/` holds a single baseline migration
(`00000000000000_baseline`). Against a **fresh** database it applies cleanly and that is the
expected case. Against a database that already has the schema but no `_prisma_migrations` table —
the shape any pre-existing developer database is in — it must first be told the baseline is
already applied:

```bash
pnpm --filter @collega/infrastructure exec prisma migrate resolve \
  --applied 00000000000000_baseline --schema prisma/schema.prisma
```

### The connection string

Paste whatever Prisma Postgres hands over into `DATABASE_URL` verbatim. The database fragment takes
it as-is (`common/config/fragments/database.ts`); the `POSTGRES_*` parts it can compose from are for
the local container only, and must not be set in deployment.

Two things to watch, neither verified against a live Prisma Postgres instance:

- Prisma Postgres offers a `prisma+postgres://…?api_key=…` URL and, on most plans, a **direct
  TCP `postgresql://` string**. The pinned client (`@prisma/client` 6.19.3) carries the code path
  for both. **If the client rejects the URL at boot, switch to the direct string** — that keeps the
  standard engine, changes one environment variable, and needs no code change. Anything that
  required adding an Accelerate extension would be a decision, not a fix.
- Every warm function instance opens its own pool. Prisma Postgres caps connections; if the API
  starts reporting connection-limit errors under load, add `?connection_limit=1` to the URL before
  reaching for anything larger.

### Prisma's query engine

`prisma generate` runs during the Vercel build, on the same Amazon Linux image the functions run
on, so the `native` binary target it resolves is the one the runtime needs. If a deployment ever
fails with a missing query engine, the fix is `binaryTargets = ["native", "rhel-openssl-3.0.x"]`
in the generator block of `packages/infrastructure/prisma/schema.prisma` — a generator change, not
a data-model change, so it does not touch the S0.2 schema freeze.

---

## 6. Environment matrix

Set these in **Project Settings → Environment Variables**, per project. `.env.example` documents
every name for local development; nothing in this table belongs in a committed file.

### `collega-api`

| Variable | Environments | Required | What breaks without it |
|---|---|---|---|
| `DATABASE_URL` | Production, Preview | **yes** | The build fails at `db:migrate`; if it somehow got past, every request 500s. Production and Preview hold **different** values — production and staging. |
| `ACCESS_TOKEN_SIGNING_KEY` | Production, Preview | **yes** | The API **refuses to boot** (see below). Generate with `openssl rand -base64 48`; a different value per environment. |
| `SITE_ADMIN_EMAIL` | Production, Preview | **yes** | The API refuses to boot, and nothing creates the first administrator (§8). |
| `SITE_ADMIN_PASSWORD` | Production, Preview | **yes** | Same. Removable after the first login and password change — the bootstrap then finds the account and leaves it alone. |
| `ACCESS_TOKEN_LIFETIME_MINUTES` | optional | no | Defaults to 480 (8h). |
| `ANTHROPIC_API_KEY` | optional | no | AI idea assist runs dark — the scripted fallback answers and the API reports "not configured" rather than erroring (`SPEC/20-feature-ai-idea-assist.md` rule 31). D6 is unbuilt, so today it changes nothing. |
| `POSTGRES_*` | — | **no** | Do not set them. They are the local container's parts; `DATABASE_URL` wins anyway, and having both invites the two drifting. |

**`ACCESS_TOKEN_SIGNING_KEY` is now enforced.** `authFragment` pushes a config problem when the key
is absent and `NODE_ENV=production`, which Nest surfaces as a boot failure. Before this change an
unset key meant "generate a random one for this process" — harmless for one local process, and
actively harmful on serverless, where **every cold start is a new process**: two warm instances
sign with different keys, so a session issued by one is rejected by the other and users are signed
out at moments nobody could trace back to a missing variable. Refusing to boot is the cheaper
failure. Vercel sets `NODE_ENV=production` for preview deployments too, so previews need a key as
well — a different one.

### `collega-web`

| Variable | Environments | Required | What breaks without it |
|---|---|---|---|
| `COLLEGA_API_URL` | Production, Preview | **yes in deployment** | Falls back to `http://127.0.0.1:3001/api/v1` and every server-side call fails. Include the `/api/v1` prefix and no trailing slash. Production points at the production API; Preview at the staging API (§7). |

Not `NEXT_PUBLIC_` — see §4.

### Never set `DATABASE_URL` in CI

`.github/workflows/ci.yml` deliberately does not set it, and setting it **breaks** that job rather
than helping it: `packages/infrastructure` guards a suite with `skipIf(!DATABASE_URL)`, so the
variable's presence stops it skipping and it then tries to reach a database CI does not have.
`turbo.json` declares `DATABASE_URL` as `env` on `@collega/infrastructure#test` so a cached result
from a run without a database is never reused for a run with one. Leave all three alone.

---

## 7. Previews and staging

- **Production** — `main`. `collega-web` production → `collega-api` production → production
  database.
- **Preview** — every other branch, including `dev`. All previews of `collega-web` point at **one
  shared staging API**, backed by **one shared staging database**.

A preview API deployment gets a unique hostname per commit, which a web preview cannot know. The
stable address is the API project's **branch alias for `dev`**:

```
COLLEGA_API_URL = https://collega-api-git-dev-<team-slug>.vercel.app/api/v1   (Preview)
```

**The accepted cost, stated plainly:** two pull requests changing the API at the same time share
one backend, and a web preview is tested against `dev`'s API rather than against its own branch's.
For a product with no users yet that is the right trade; when it stops being, the answer is a
Vercel custom environment for staging, not per-PR databases.

**Deployment Protection is the trap here.** With Vercel Authentication on, a preview (and, on some
settings, the production deployment URL) answers an SSO redirect instead of the API — and
`apps/web`'s server-side fetch has no browser session to satisfy it, so every call fails with HTML
where JSON was expected. The API authenticates its own callers; **turn Vercel Authentication off
for `collega-api`**, or issue a Protection Bypass for Automation token and send it as
`x-vercel-protection-bypass` (which would be a change to `apps/web/lib/api/client.ts`, currently
unwritten). Leave protection on for `collega-web` if you want previews private.

---

## 8. The first administrator

**This is the part that decides whether a fresh deployment is usable at all.**

The demo seed throws when `NODE_ENV=production` (`packages/infrastructure/prisma/seed/index.ts`),
so a production database created by `migrate deploy` has **zero users** and a login screen nobody
can pass. `apps/api` reads `SITE_ADMIN_EMAIL` and `SITE_ADMIN_PASSWORD` and **refuses to boot
without them, but never acts on them** — the account was only ever created by the .NET
`StartupSeeder` and, in the new stack, by the demo seed's tenth user.

`SPEC/20-feature-auth.md` requirement 8 says the Site Admin is created on first run and requirement
9 says it must change that credential on first login. On serverless, boot is the wrong place to
honour it — "first run" happens on every cold start — so **it runs once per deploy instead**:

```
packages/infrastructure/prisma/seed/bootstrap-site-admin.ts
pnpm --filter @collega/infrastructure db:bootstrap-admin
```

It creates exactly one account, from the environment, with `must_change_password` set, and it is
in the API project's build command after `db:migrate`. It can also be run by hand by anyone holding
`DATABASE_URL`, which is useful for bootstrapping a database that was created outside a deploy.

Four properties that make it safe to leave in a build command that runs on every deploy:

- **Idempotent.** An account already owning that email is reported and left exactly as it is, so a
  password the administrator has since changed is never reset to the environment's value.
- **Concurrency-safe.** The existence check and the insert are not one transaction, and two preview
  builds starting a second apart against the shared staging database will both see "absent". The
  insert catches the resulting unique violation (`P2002`) and treats it as the already-exists
  branch, because losing that race is the same outcome as never having raced. Before this was
  handled, the loser exited non-zero — and because `db:bootstrap-admin` is the last link in an `&&`
  chain, a non-zero exit **fails the whole Vercel build**.
- **It invents nothing.** With either variable unset it logs and exits 0 rather than making up a
  credential. **No credential is ever committed** — the values live only in Vercel's environment
  variables and your local `.env`, both untracked.
- **It shares the demo seed's id derivation**, so a development database that has seen both the
  demo seed and this bootstrap holds one row rather than colliding on the unique email index.

After the first login and password change, `SITE_ADMIN_PASSWORD` can be deleted from the project.

### When the address is owned by an account that cannot administer anything

Leaving an existing row alone is right — re-granting `SiteAdmin` to whoever owns the configured
address would make this script a privilege-escalation path for anyone able to set an environment
variable — but leaving it alone *quietly* was wrong. A `SITE_ADMIN_EMAIL` owned by a `ReadOnly` or
`Inactive` account used to print "already exists … left untouched" and exit 0: the deploy went
green and shipped an application nobody could administer.

The row is still never modified. But when the account found is not both `role = SiteAdmin` and
`status = Active`, the script prints what it found and **exits 1, failing the build**. Recovery is
to fix that account directly against the database, or to point `SITE_ADMIN_EMAIL` at an address
nothing owns yet — not to re-run this script, which by design will not touch it.

**This script is not a lockout recovery.** A locked-out, deactivated, demoted or
password-forgotten administrator is precisely the case the idempotency guard refuses to act on;
running it by hand will print a message and change nothing. Recovering a lost administrator means a
direct write with `DATABASE_URL` in hand — clear `locked_until_utc` and `failed_login_count`, or
set `status`/`role` back, or set `password_hash` to a fresh PBKDF2 hash in the format
`packages/infrastructure/src/security/pbkdf2-password-hasher.ts` produces together with
`must_change_password = true` and a new `security_stamp` (changing the stamp is what invalidates
any session the previous state left outstanding). Know that before the incident; the alternative
during one is to point `SITE_ADMIN_EMAIL` at a fresh address and redeploy, which does work and
leaves the broken account behind to clean up later.

---

## 9. What "deployed" looks like

```
                    browser
                       │  https
                       ▼
          ┌────────────────────────┐
          │  collega-web (Next)    │   apps/web  ·  no database
          │  session cookie on     │
          │  its own origin        │
          └───────────┬────────────┘
                      │  server-side fetch, COLLEGA_API_URL,
                      │  forwards the session cookie
                      ▼
          ┌────────────────────────┐
          │  collega-api (Nest)    │   apps/api  ·  server.js → dist/main.js
          │  /api/v1/*             │   one function, listen() captured
          └───────────┬────────────┘
                      │  Prisma
                      ▼
              Prisma Postgres
        production  ·  staging (all previews)
```

---

## 10. Rollback posture

**The rollback unit is the database, not a previous stack.** `SPEC/50-typescript-migration.md` §7
settled this: the .NET stack was never deployed, so there is nothing to fall back to, and after F6
there is no .NET code either. What follows is that statement made operational.

- **Code rolls back instantly and by itself.** Vercel keeps every deployment; Instant Rollback
  repoints production at the previous one in seconds, per project. Roll back `collega-web` and
  `collega-api` **together** unless you know the pair is compatible.
- **The database does not roll back with it.** A rollback restores code against a schema that has
  already moved. So: **every migration must be backward-compatible with the deployment before it**
  — add columns and tables, do not drop or rename them in the same release that stops using them.
  Drop in a later, separate deployment, once the rollback window has closed. A migration that
  breaks this rule is the point of no return for that release, and should be announced as one
  rather than discovered.
- **Restoring data is Prisma Postgres's backup, and nothing in this repository.** Confirm the
  retention and point-in-time window on the plan you provision, and know it before the first
  release rather than during an incident.
- **Recreating from scratch is a real option here, and cheap.** `dropdb`, `db:migrate`,
  `db:seed` rebuilds a full demo database in under four seconds (`SPEC/decisions.md` 2026-09-09),
  and `db:bootstrap-admin` is the production equivalent of its last step. Until real user data
  exists, "restore" and "rebuild" are the same conversation — which is also why F3 may not be a
  slice at all.

---

## 11. What has not been verified, and how to verify it

Everything in §1–§10 that lives in the repository was exercised locally: a clean
`pnpm turbo run build --filter=@collega/api` from deleted `dist/` directories, `prisma generate`,
`apps/api/server.js` booting and answering `GET /api/v1/auth/me` with `401`, the production
fail-fast refusing to boot without a signing key and booting with one, `db:bootstrap-admin` on both
its create and its already-exists paths, a real login as the account it created returning
`requiresPasswordChange: true`, and `pnpm check` at 23/23.

**Nothing on Vercel has been verified**, because the session that wrote this had no access to the
account. In rough order of how likely each is to be the thing that bites:

| Unverified | How it would show up | What it takes |
|---|---|---|
| That Vercel resolves `server.js` as the entrypoint | Build error naming the `functions` pattern, or a deployment that 404s every route | The first API deployment's build log |
| That `@vercel/nft` traces the Prisma query engine out of `packages/infrastructure/dist/generated/prisma/` | Runtime error about a missing query engine on the first database call | One request to any authenticated endpoint |
| That the `prisma+postgres://` URL works with the pinned client | Boot failure naming the datasource protocol | Swap to the direct `postgresql://` string (§5) |
| Node 24 selection on the build image | `Invalid Node.js Version` during install | Set the project's Node.js Version to 24.x |
| Deployment Protection on the API (§7) | Web previews receiving HTML from every API call | Turn Vercel Authentication off for `collega-api` |
| That preview builds see Preview-scoped variables at build time | `db:migrate` failing or migrating the wrong database | The first preview build's log — **check which database it touched** |

---

## 12. Handoff checklist

Ordered, and written to be followed without reading anything above. Steps 1–9 are Vercel and the
database; step 10 is verification.

1. **Provision Prisma Postgres**, two databases: `collega-production` and `collega-staging`. Put
   them in the region you will use for the functions — the config files say `iad1` (US East); if
   you provision elsewhere, change `regions` in both `vercel.json` files to match.
2. **Copy each connection string** somewhere safe. Prefer the direct `postgresql://` string if the
   console offers both.
3. **Generate two signing keys** — `openssl rand -base64 48`, once for production, once for
   staging. They are not interchangeable and neither is ever committed.
4. **Create the web project.** New Project → this repository → **Root Directory `apps/web`** →
   Framework **Next.js**. Do not override the build or install commands; `apps/web/vercel.json`
   already sets them.
5. **Create the API project.** New Project → the same repository → **Root Directory `apps/api`** →
   Framework **Nest.js**. Same: the commands come from `apps/api/vercel.json`.
   *(The existing `georgemschaffers-projects/collega` project has no root directory set, which is
   why every push fails. Repoint it at `apps/web` and it becomes the web project, or delete it.)*
6. **Turn Vercel Authentication off for the API project** (Settings → Deployment Protection).
   `apps/web` calls it server-side and cannot satisfy an SSO redirect.
7. **Set the API project's variables:**

   | Variable | Production | Preview |
   |---|---|---|
   | `DATABASE_URL` | production string | **staging** string |
   | `ACCESS_TOKEN_SIGNING_KEY` | key 1 | key 2 |
   | `SITE_ADMIN_EMAIL` | the real address | anything you can sign in as |
   | `SITE_ADMIN_PASSWORD` | a strong one-time password | as above |

   Leave `ANTHROPIC_API_KEY` unset unless you want AI assist configured. Never set `POSTGRES_*`.
8. **Deploy the API** (push, or Redeploy). The build runs the migration and creates the Site Admin;
   the log ends with either `created Site Admin …` or `… already exists`. Note the deployment's
   hostname.
9. **Set the web project's variables**, then deploy it:

   | Variable | Production | Preview |
   |---|---|---|
   | `COLLEGA_API_URL` | `https://<api production host>/api/v1` | `https://collega-api-git-dev-<team>.vercel.app/api/v1` |

   No trailing slash, and keep the `/api/v1`.
10. **Verify, in this order:**
    - `curl -i https://<api host>/api/v1/auth/me` → **401** with a JSON problem document. Anything
      else — HTML, 404, a redirect — means §11's first two rows, not a code bug.
    - Open the web app, sign in as `SITE_ADMIN_EMAIL`. It must **force a password change**; that is
      requirement 9 working, not a bug.
    - Change the password, then create an organization. That exercises a write through Prisma.
    - Optionally delete `SITE_ADMIN_PASSWORD` from the API project. Nothing resets the account
      afterwards.

If something fails, §11 names the six candidates and where each shows itself. **Do not fix a
cross-origin symptom by adding CORS** (§4), and do not set `DATABASE_URL` in the GitHub Actions
workflow (§6).
