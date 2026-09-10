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

The build command's shape is not improvised: `cd ../.. && turbo run build --filter=<package>` is
what Vercel's own Turborepo page documents for a project whose Root Directory is a workspace
member.

### The ignore step, and why it is not `npx turbo-ignore`

```
turbo query affected --base=$VERCEL_GIT_PREVIOUS_SHA --packages @collega/api --exit-code || exit 1
```

It skips a project's build when nothing in its dependency graph changed — a `SPEC/`-only commit
stops burning two builds and two red checks.

**Vercel's Turborepo page documents two forms for this field, and we use the second one
deliberately.** The first, `npx turbo-ignore --fallback=HEAD^1`, is the one most repositories
copy — and `npx` with no version resolves and downloads whatever was published most recently, on
every build, outside `pnpm-lock.yaml`. That happens in a container holding `DATABASE_URL`,
`ACCESS_TOKEN_SIGNING_KEY` and `SITE_ADMIN_PASSWORD`, with write access to the artifact about to
deploy. Two lines below it, `--frozen-lockfile` exists precisely so a package that disagrees with
the lockfile fails the deploy instead of resolving silently; running an unpinned package above it
exempts one dependency from the guarantee the line below is there to give. So we use the second
documented form, `turbo query affected`, which invokes a `turbo` already present on the build image
and fetches nothing. **A future reader should not "fix" this back to the `npx` snippet** — the
deviation is the point.

Exit codes, verified against `turbo` 2.10.12 (the version the root `devDependencies` pins):

| Case | `turbo query affected` exits | Vercel does |
|---|---|---|
| The package's graph changed | 1 | builds |
| Nothing changed | 0 | **skips** |
| Any error — bad ref, missing base, `turbo` not on `PATH` | 2, or 127 | builds |

`ignoreCommand`'s semantics are inverted and unforgiving: **0 means skip, anything else means
build.** The trailing `|| exit 1` normalizes every error exit to a plain 1, because Vercel's own
wording ("code 0 ignores the build, while code 1 continues it") does not say what it does with a 2,
and the cost of guessing wrong is a first deployment that silently skips itself.

Two known ways it errs toward building, both harmless:

- **The first deployment of a project.** `VERCEL_GIT_PREVIOUS_SHA` is only exposed once an Ignored
  Build Step is configured *and* a previous deployment exists, so on the first one `--base=` is
  empty, `turbo` reports a query error, and the build runs. That is the right answer.
- **The shallow clone.** Vercel clones with `--depth=10`; a previous SHA older than that is not in
  the history, `turbo` cannot resolve it, and the build runs. `turbo-ignore` handles this more
  gracefully with `--fallback=HEAD^1`, which `turbo query affected` has no equivalent for. The
  cost is builds that were not strictly necessary — never a build that was needed and skipped.

If the first build log shows `turbo: command not found`, the skip is simply not working: builds
still run and deploy correctly, they just always run. The fallback then is the *pinned* form,
`npx --yes turbo-ignore@2.10.12 --fallback=HEAD^1` — pinned to the root `turbo` version, since
`turbo-ignore` ships from the same repository at the same version — and never the unpinned one.

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

**Established:** Vercel's Node runtime captures `listen()`, and the `functions` glob in
`apps/api/vercel.json` must match a real serverless function or the build fails naming the pattern.
**Expected, not documented:** that Vercel resolves an entrypoint named `app` / `index` / `server` /
`main` at the project root ahead of anything under `src/`. That ordering is how the presets are
observed to behave and it is why this file is named `server.js` and sits where it does, but no
Vercel document states it. Vercel publishes an entrypoint escape hatch for its **Python** presets
(`[tool.vercel] entrypoint = …`) and nothing equivalent for Node, so there is no setting to force
the matter either. Treat the file's placement as a well-founded expectation to be confirmed by the
first build log (§11), not as a guarantee.

```js
// apps/api/server.js
import './dist/main.js'
```

`apps/api/vercel.json` names `server.js` in its `functions` block (`maxDuration: 60`), which
doubles as the assertion: if Vercel resolved a different entrypoint, the pattern matches nothing and
the build says so rather than deploying the wrong file.

### If the build says `server.js` matched no function

```
The pattern "server.js" defined in 'functions' doesn't match any Serverless Functions
```

This is the expected first failure, and the likeliest cause is the most benign one: the `nestjs`
preset resolved `dist/main.js` directly, which exists because that is where Nest apps compile.
Nothing is wrong with the deployment except the glob.

**Point the glob at the entrypoint the log names. Do not rename `server.js` to match the glob,
and do not delete the `functions` block.** Renaming chases a moving target and can only be
confirmed by another failed build; deleting the block makes the error go away and takes
`maxDuration: 60` silently with it, leaving the API on the default timeout with nothing in the diff
to say so. Read the build log for the file Vercel chose, put that path in `functions`, keep
`maxDuration`, and — if the chosen entrypoint is already `dist/`-backed — `server.js` becomes dead
weight to delete in a follow-up rather than something to fix under pressure.

**Do not set `framework` to `null`.** It was considered and rejected: with no preset, Vercel still
needs some rule to turn `apps/api` into a function at all, and the "Other" preset has historically
meant static output — a deployment that produced no function would be a worse and more confusing
first result than a glob error that names its own fix. Keep `nestjs` for the first deploy and
change it only with a build log to justify it.

---

## 4. Cross-origin: there is none, and that is the design

**The browser never calls `apps/api`.** `apps/api/src/main.ts` calls no `enableCors()`, and
`apps/web` reaches the API server-side through `COLLEGA_API_URL` (`apps/web/lib/api/config.ts`),
forwarding the session cookie and re-issuing it on its own origin. `COLLEGA_API_URL` is
deliberately **not** `NEXT_PUBLIC_`: that would inline the API's address into the client bundle and
invite exactly the call CORS would then have to permit.

Do not add CORS to make something work. If a browser request to the API host is being blocked,
something is calling the API from the wrong side of the app.

### Security headers

`apps/web/vercel.json` sets four response headers on every path. Vercel supplies HSTS on its own
(`Strict-Transport-Security`, §12 needs nothing for it); nothing supplies the rest.

| Header | Value | Why |
|---|---|---|
| `X-Frame-Options` | `DENY` | The app has no embeddable surface. Clickjacking on a board is a real action, not a page view. |
| `X-Content-Type-Options` | `nosniff` | Portraits are user-uploaded bytes served back (`portrait_png`); sniffing is how those become script. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Board and idea ids live in the path; the origin is all any third party needs. |
| `Permissions-Policy` | camera, microphone, geolocation, interest-cohort off | Nothing in the product asks for them, so nothing embedded in it should be able to. |

`apps/api` gets none: it is never reached by a browser (above), so a header aimed at browser
behaviour has no reader there.

**A Content-Security-Policy is owed and deliberately not shipped yet.** Next injects inline
bootstrap scripts, so `script-src 'self'` breaks the app on the first load and `'unsafe-inline'`
would leave a policy that permits the attack it is named for. Doing it properly means a nonce
generated per request in middleware and threaded through `next.config.ts` — real work, worth its
own slice, and worth doing after there is a deployment to test it against. Until then the app has
no CSP; say so rather than assuming one is there. Whoever writes it should start from Vercel's own
allowances for its toolbar (`vercel.live`, `ws-us3.pusher.com`), which previews load.

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
| `ACCESS_TOKEN_SIGNING_KEY` | Production, Preview | **yes** | The API **refuses to boot** (see below), and refuses again if it is shorter than 32 characters. Generate with `openssl rand -base64 48`, which gives 64; a different value per environment. |
| `SITE_ADMIN_EMAIL` | Production, Preview | **yes** | The API refuses to boot, and nothing creates the first administrator (§8). |
| `SITE_ADMIN_PASSWORD` | Production, Preview | **yes** | Same, and **not removable** — `siteAdminFragment` reads it through `required()`, so deleting it after the first login takes the API down on the next cold start. Nothing reads the value: the bootstrap script reads `process.env` directly, so the fragment's only effect is to refuse boot. See the note under §8. |
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

**A short key is rejected on the same terms.** HS256 signs and verifies with the same secret, so
`ACCESS_TOKEN_SIGNING_KEY=changeme` is eight guessable bytes standing between an attacker and a
token this API will accept. What that buys is bounded — `TokenAuthenticationService` re-checks the
token's `sstamp` claim against the live user row, so forging a session for someone else needs a
security stamp the attacker does not have — but a forged token still carries an `exp` of the
attacker's choosing, which is the 8h lifetime made optional. The fragment refuses anything under 32
characters in production; §12 step 3 already asks for 48 bytes of base64, so this only enforces the
handoff.

### `collega-web`

| Variable | Environments | Required | What breaks without it |
|---|---|---|---|
| `COLLEGA_API_URL` | Production, Preview | **yes in deployment** | Falls back to `http://127.0.0.1:3001/api/v1` and every server-side call fails. Include the `/api/v1` prefix and no trailing slash. Production points at `api.collega-ai.com`, a custom domain bound to the API project; Preview at the staging API (§7). A custom domain covers production only, so Preview keeps the branch alias. |

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

**Production is a custom domain, `api.collega-ai.com`,** bound to the API project — decided
2026-09-10. Vercel's generated hostname is derived from the project name, so it changes if the
project is renamed or recreated, and the web app would keep pointing at a host that no longer
answers. A domain we own removes that coupling. Nothing about the cookie changes: the browser never
sees the API, because `apps/web` re-issues the session on its own origin (§4), so the API living on
a different registrable domain costs nothing.

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

> **Open choice, and it needs one.** `SITE_ADMIN_EMAIL` and `SITE_ADMIN_PASSWORD` are read through
> `required()` in `apps/api/src/common/config/fragments/site-admin.ts`, so the API will not start
> without them — yet **nothing consumes `config.siteAdmin`**. The bootstrap script reads
> `process.env` directly, so the fragment's entire effect is to refuse boot. That leaves an
> administrator's password sitting in the environment forever, long after the account has changed
> it, and an earlier version of §12 compounded it by telling the operator to delete the variable,
> which would have taken the deployment down on the next cold start.
>
> Two ways out, and they are not equivalent. **Stop requiring them** — delete the dead fragment, and
> the credential becomes genuinely removable once the account exists; the cost is losing a guard
> that today guarantees a first deploy cannot finish without the means to create an administrator.
> **Or keep the requirement** and accept that the variable is permanent, which is what §12 now says.
> The first is probably right, but it changes boot-time behaviour and should land as its own change
> rather than riding along with deployment configuration.

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
| That preview builds see Preview-scoped variables at build time | `db:migrate` failing or migrating the wrong database | The first preview build's log — **check which database it touched** (§12 step 10, required) |
| **Observed, not hypothetical:** stale settings on a project repointed rather than created | Build fails asking you to remove the `public` output directory so the Next.js build output can be used | Clear the Output Directory override *and* set Root Directory — see below |

### Stale project settings on a repointed project

This one has already happened, on the pre-existing `collega` project. It was created pointing at
the **repository root**, auto-detected as the "Other" preset, and given `public` as its Output
Directory. Every line of configuration in this document postdates it, and none of it helps.

**`vercel.json` cannot fix this, and reaching for it is the natural first instinct.**
`outputDirectory` can only *set* an override — there is no value meaning "go back to
auto-detecting" — so a stale project-level override beats the file's silence. Clear it at the
project:

```bash
vercel project update <name> --auto-detect output-directory
```

or switch the override off under **Settings → Build & Development Settings**.

**Clearing it is not enough on its own.** The output directory is the symptom; the project is
building the wrong directory altogether. Three settings move together, in this order:

1. **Root Directory → `apps/web`.** Until this is right, Vercel never even reads
   `apps/web/vercel.json`, so nothing this repository says is in play.
2. **Output Directory → override off.** As above, and only the project can do it.
3. **Framework → follows.** Once Root Directory is right, the preset self-corrects, because
   `apps/web/vercel.json` declares `nextjs` itself. Nothing to set by hand.

A project created fresh at the correct Root Directory carries none of this. That is the argument
for deleting and recreating rather than repointing, if repointing turns into more than these three.

### The one failure that is silent, and how to recognise it

Every row above announces itself. This one does not, and it is the reason §3 insists on
`dist/`-backed output.

If Vercel's preset compiles `apps/api/src/main.ts` with its own toolchain instead of running the
`tsc` output, `emitDecoratorMetadata` is lost — esbuild does not implement it — and the build
succeeds. The first request then 500s with:

```
Nest can't resolve dependencies of the IdeasController (?)
```

**The `?` in that dependency list is the missing metadata.** Nest is not saying the provider is
unregistered; it is saying it has no type to look up. Do not go hunting for a missing module
import — the module graph is fine, the artifact is wrong.

Its build-log tell, visible before any request: a build that **succeeds without ever mentioning
`server.js`**, plus a compile or bundle step appearing *after* the custom `buildCommand` has
already finished. Both mean the preset built its own thing. Fix it in §3's terms — point the
`functions` glob at whatever the log names, having confirmed it is `dist/`-backed.

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

   *Or repoint the existing one.* `georgemschaffers-projects/collega` has no Root Directory set,
   which is why every push fails. It can become the web project, but **it carries settings a fresh
   project would not have** — it was auto-detected as "Other" at the repository root, so its Output
   Directory is pinned to `public` and its build fails asking you to remove it. Fix all three:
   Root Directory → `apps/web`; Output Directory → override **off**
   (`vercel project update collega --auto-detect output-directory`, or Settings → Build &
   Development Settings — `vercel.json` cannot express this); Framework then corrects itself from
   the file. §11 has the full symptom. Deleting it and creating fresh is the shorter path if you
   have no attachment to the project's history.
5. **Create the API project.** New Project → the same repository → **Root Directory `apps/api`** →
   Framework **Nest.js**. Same: the commands come from `apps/api/vercel.json`. Create this one
   fresh — there is no existing project to repoint, and nothing to inherit.
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

   > **Add `DATABASE_URL` one environment at a time, and do not accept the default.** Vercel's
   > "Add New" form pre-selects Production, Preview *and* Development, and a `DATABASE_URL` saved
   > with all three ticked points every preview build at the production database. The build command
   > is byte-identical in every environment — it runs `prisma migrate deploy` and then
   > `db:bootstrap-admin` unconditionally — so nothing downstream can tell staging from production,
   > and nothing in the code can be made to. **This scoping is the only thing separating the two
   > databases.** Save the production string with Production ticked and the other two clear, then
   > save the staging string with Preview ticked and the other two clear. Verify by reopening each
   > entry: the environment badges are shown on the row.
8. **Deploy the API** (push, or Redeploy). The build runs the migration and creates the Site Admin;
   the log ends with either `created Site Admin …` or `… already exists`. Note the deployment's
   hostname.
9. **Set the web project's variables**, then deploy it:

   | Variable | Production | Preview |
   |---|---|---|
   | `COLLEGA_API_URL` | `https://api.collega-ai.com/api/v1` | `https://collega-api-git-dev-<team>.vercel.app/api/v1` |

   No trailing slash, and keep the `/api/v1`.
10. **Verify, in this order:**
    - **Open the first preview build's log and confirm which database `db:migrate` touched.** This
      is required, not optional. It is the only evidence that step 7's per-environment scoping took
      — a `DATABASE_URL` saved with all three environments ticked produces a preview build that
      migrates and bootstraps *production*, and it does so with a green check and no other symptom.
      Check it once per project; after that the scoping is proven.
    - `curl -i https://<api host>/api/v1/auth/me` → **401** with a JSON problem document. Anything
      else — HTML, 404, a redirect — means §11's first two rows, not a code bug.
    - Open the web app, sign in as `SITE_ADMIN_EMAIL`. It must **force a password change**; that is
      requirement 9 working, not a bug.
    - Change the password, then create an organization. That exercises a write through Prisma.
    - **Leave `SITE_ADMIN_PASSWORD` in place.** An earlier draft of this checklist said it could be
      deleted once the password had been changed. It cannot: the API refuses to boot without it, so
      deleting it works until the next cold start and then takes the deployment down. That the
      credential outlives its usefulness is a real wart — §8 records the choice it needs.

If something fails, §11 names the six candidates and where each shows itself. **Do not fix a
cross-origin symptom by adding CORS** (§4), and do not set `DATABASE_URL` in the GitHub Actions
workflow (§6).
