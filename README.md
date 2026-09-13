# Collega

Organization-scoped collaboration and idea tracking. Organizations contain users, boards, statuses
and ideas; boards arrange ideas by status in swimlanes, and an idea promoted out of a board becomes
an issue that moves through sprints.

**Stack:** TypeScript · Next.js · Nest.js · Prisma · PostgreSQL 16 · Tailwind v4 + shadcn/ui ·
Vitest + Playwright · pnpm workspaces + Turborepo · deployed on Vercel

---

## Install

```bash
corepack enable && corepack prepare pnpm@12.3.4 --activate
pnpm install
```

You need **Node ≥ 24.20** and **pnpm ≥ 12.3.4**. `pnpm install` fails on an engine mismatch rather
than installing something that will not run.

Unless you already run a PostgreSQL 16 on this machine, you also need **Docker** — that is the only
thing the database container needs. Point `DATABASE_URL` at a cluster you already run locally and
Docker is not involved at all. If you can run neither, see
[Working without a local database](#working-without-a-local-database).

`packages/infrastructure` runs `prisma generate` on postinstall, so the Prisma client is built for
you. It reads the schema and does not need a reachable database.

---

## Run it locally

```bash
pnpm start
```

That is the whole thing: Next on http://localhost:3000, Nest on http://localhost:3001/api/v1, and a
migrated and seeded PostgreSQL behind them. Ctrl+C stops both.

[`tools/local/start.ts`](tools/local/start.ts) is what it runs, and it is idempotent — copy `.env`
from the example if it is missing, start the `postgres` compose service **only** if nothing is
already listening at the host and port `DATABASE_URL` names, build, `prisma migrate deploy`, seed,
then run both halves. Run it as often as you like. It reloads the web app on save; **re-run it after
changing `apps/api`**, which it runs as built output rather than under a watcher.

It refuses to run against anything but your own machine. The script migrates and seeds whatever
`DATABASE_URL` names, so a host that is not loopback stops it before the first write, quoting the
address it read. `COLLEGA_ALLOW_REMOTE_DATABASE=1` is how you say you meant it.

`.env` is gitignored and copied from [`.env.example`](.env.example), whose defaults are placeholders
for a throwaway local container. Two are worth knowing about:

- `POSTGRES_USER` is **`collega`**, not `postgres`. The container creates exactly one login role, so
  `psql -U postgres` fails with `role "postgres" does not exist`.
- `ANTHROPIC_API_KEY` may be left empty, which runs AI-assisted idea drafting **dark** rather than
  broken ([`SPEC/20-feature-ai-idea-assist.md`](SPEC/20-feature-ai-idea-assist.md) rule 31).

### What is real, and what is still a fixture

Nearly everything reads the API. Sign-in, boards and board detail, the ideas list and the idea
inspector, delivery, and the settings screens are all live against the real database, including the
writes: author an idea, move a card between lanes, toggle an upvote, promote an idea to an issue.

Two things are not:

| | |
|---|---|
| The **AI-assist admin screens** — prompt editor, probes, usage | Fixtures, from [`apps/web/lib/mock.ts`](apps/web/lib/mock.ts). The API side exists; the web side is not wired to it yet. |
| **Outcomes and the roadmap** | Empty, deliberately. They are Slice 2 of Issues-and-Delivery: no table, no entity, no route. [`SPEC/30-Contracts.md`](SPEC/30-Contracts.md) says so outright, and `apps/web/lib/data/delivery.ts` explains why empty beats invented. |

Which of the two a screen gets is decided in [`apps/web/lib/data/`](apps/web/lib/data) and nowhere
else — a reader there is either a `fetch` or a fixture, and the call sites cannot tell. Wave-by-wave
status lives in [`SPEC/implementation-agent-tracker.md`](SPEC/implementation-agent-tracker.md).

---

## Commands

```bash
pnpm start        # the whole application — API, web, database
pnpm dev          # an alias for `pnpm start`; there is no web-only mode
pnpm check        # lint + typecheck + test + build — the gate
pnpm build
pnpm test         # every package except the Playwright suite
pnpm test:e2e     # Playwright; needs a running app
pnpm lint:fix     # Biome, with fixes applied
```

**`pnpm check` is what "green" means** — Biome (lint, format, and the layer-boundary rules), `tsc`
across every package, Vitest, and `next build`. Run it before calling anything done. A single
package: `pnpm --filter @collega/api test`.

The build is in the gate because `tsc` cannot stand in for it: a `'use client'` file that reaches a
server-only module through a barrel typechecks cleanly and then fails to build. Turbo caches it, so
a second run costs nothing.

Turborepo caches aggressively, and a cached pass has twice hidden a real regression in this
repository. When you need a result you can trust, force it:

```bash
pnpm check --force
```

That reports `0 cached` and is the only form worth quoting as evidence.

---

## Database and seeding

Prisma owns the schema
([`packages/infrastructure/prisma/schema.prisma`](packages/infrastructure/prisma/schema.prisma)) —
25 models, 9 enums, frozen at conversion slice S0.2.

```bash
pnpm --filter @collega/infrastructure db:generate   # regenerate the client from the schema
pnpm --filter @collega/infrastructure db:migrate    # prisma migrate deploy
pnpm --filter @collega/infrastructure db:seed       # the demo data
```

`pnpm start` runs all three for you. You only need them by hand when working against a database it
did not create.

### Three seeds, for three different jobs

| | | |
|---|---|---|
| `db:seed` | The demo data — two organizations, one account per role each, boards, ideas, comments, sprints and issues | **Refuses to run when `NODE_ENV=production`.** |
| `db:bootstrap-admin` | One Site Admin, so a fresh deployment is reachable at all | Safe in production; it is what the API's deploy build runs |
| `db:bootstrap-organization` | One empty organization with an admin | Safe in production |

The demo seed rebuilds from committed code in about four seconds, which is why nothing in a local
database is worth protecting. To start over (**destroys all local data**): `docker compose down -v`,
then `pnpm start`.

The Nest host composes `DATABASE_URL` from the `POSTGRES_*` parts when it is unset, so a password has
one home. **The Prisma CLI cannot** — `migrate`, `db pull` and `studio` read `env("DATABASE_URL")`
straight out of the schema — which is why `pnpm start` writes the composed value back into `.env` the
first time. In deployment it is set verbatim, which is the shape Prisma Postgres hands over.

---

## Deployment

Two Vercel projects from this one repository, each rooted at its own app directory, each with its own
`vercel.json`:

| Project | Root directory | Framework |
|---|---|---|
| `collega` | `apps/web` | Next.js |
| `collega-api` | `apps/api` | Nest.js |

Both install and build from the workspace root (`cd ../.. && pnpm install --frozen-lockfile`), so
Turborepo resolves the package graph exactly as it does locally. The API's build command also runs
`db:migrate` and `db:bootstrap-admin`, which is what makes a newly provisioned database usable
without a manual step.

### Environment variables

| Variable | Where | Notes |
|---|---|---|
| `DATABASE_URL` | `collega-api` | Set verbatim; the Prisma CLI cannot compose it from parts |
| `COLLEGA_API_URL` | `collega` | The API's origin. The web app is HTTP-only and reaches the API through this and nothing else |
| `SITE_ADMIN_EMAIL`, `SITE_ADMIN_PASSWORD` | `collega-api` | Consumed by `db:bootstrap-admin` at build time |
| `ANTHROPIC_API_KEY` | `collega-api` | Optional. Absent means the AI feature runs dark |

### Environments and their databases

Three environments, and the thing worth getting right is which database each one writes to.

| Environment | Database | Who reaches it |
|---|---|---|
| **Production** | The production Prisma Postgres | `collega-api` on `main` |
| **Preview** | A separate staging database | Preview deployments, and a developer with no local PostgreSQL |
| **Local** | A `postgres:16` container, via `docker compose` | `pnpm start` |

**Status: the staging database is not provisioned yet.** Until it is, Preview shares Production's
database — so every schema change already lands there from a preview build, which is the reason to
do this before the next migration rather than after. To provision it:

```bash
npm i -g vercel && vercel login
cd apps/api && vercel link                                      # link to collega-api
vercel install prisma-postgres --name collega-dev --environment preview
```

**Two things will bite otherwise.**

**The staging database gets Production's Site Admin.** The API's build command ends with
`db:bootstrap-admin`, so the first preview build after provisioning migrates and bootstraps the new
database on its own — which is what you want. But that script reads `SITE_ADMIN_EMAIL` and
`SITE_ADMIN_PASSWORD`, and unless those are scoped per-environment it installs the production
credential into staging, which is the separation you were trying to create. Set Preview-scoped
throwaway values first.

**The demo seed will never run on Vercel, by design.** `prisma/seed/index.ts` throws when
`NODE_ENV === 'production'`, and Vercel sets that for *every* build, preview included. So a freshly
provisioned staging database comes up with the bootstrap admin and nothing else: no organizations,
no boards, no ideas. Demo data goes in from a shell where `NODE_ENV` is unset — yours:

```bash
vercel env pull .env.local --environment=preview     # the URL, without reading it yourself
DATABASE_URL='<the pulled URL>' pnpm --filter @collega/infrastructure db:seed
```

### Working without a local database

A machine that cannot run a database server — no Docker, or a locked-down host — runs against the
staging database instead:

```bash
COLLEGA_ALLOW_REMOTE_DATABASE=1 DATABASE_URL='<staging URL>' pnpm start
```

`tools/local/start.ts` refuses a non-loopback host by default, because it migrates and seeds whatever
it is given and a shared cluster should not be that by accident. `COLLEGA_ALLOW_REMOTE_DATABASE=1` is
how you say you meant it; the script then skips Docker entirely, since starting a container here
would not be the database the connection string names.

Note what that command does: it **migrates and seeds** the remote database, demo organizations and
users included. That is correct for a staging database and wrong for a production one. The guard is
the only thing standing between those two outcomes, so do not export the variable in a shell profile.

### Two things that are load-bearing and invisible

**The API's entrypoint is `apps/api/server.js`, and the bootstrap is `src/bootstrap.ts` — not
`src/main.ts`.** Vercel's NestJS preset resolves an entrypoint in a fixed order, and every `src/`
candidate (`main`, `app`, `index`, `server`) outranks every root-level one. While `src/main.ts`
existed, the preset compiled it with its own toolchain and `server.js` was never consulted.
Reintroducing `src/main.ts`, or renaming `server.js`, silently hands the deployment back to a
source-compiled artifact. The file's own header comment says this too; read it before touching
either name.

**`maxDuration` lives in the project's settings, not in `vercel.json`.** A `functions` block is
rejected before the build starts unless its patterns match source files inside an `api/` directory,
which this layout has none of.

### The ignore step

Both projects set an `ignoreCommand` that asks Turborepo whether the app is affected by the commit.
It reasons correctly on source changes — a commit touching only `packages/application` genuinely
does not affect `apps/web`, which cannot import it. The gap is **environment-variable changes**: they
leave no diff, so the ignore step sees an unaffected app and cancels a build you actually wanted.
Push an empty commit to force one.

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `pnpm check` on every pull request and on
pushes to `dev` and `main`. It deliberately does **not** set `DATABASE_URL`: `packages/infrastructure`
guards a suite with `skipIf(!DATABASE_URL)`, so the variable's mere presence stops it skipping and it
then tries to reach a database CI does not have.

Branches flow `feature/<NNN>-<short-description>` → `dev` → `main`.

---

## Workspace layout

```
apps/
  web                      Next.js client — HTTP only, imports @collega/design-system and nothing else
  api                      Nest.js host — the only thing that talks to the database
packages/
  domain                   Entities, enums, value objects, invariants — depends on nothing
  application              Use cases, authorization, validation — depends on domain
  infrastructure           Prisma persistence, integrations — implements domain/application ports
  design-system            Comp P tokens and primitives, on Tailwind v4 + shadcn/ui
e2e/                       Playwright suite
tools/
  local/start.ts           `pnpm start` — database, API and web in one command
  golden                   Capture/replay harness — the conversion's regression detector
  boundaries               Architecture tests over the layer rules
  demo-shots               Screenshots the demo deck is built from
  prompt-eval              The AI-assist evaluation corpus (data only; its runner is gone)
SPEC/                      Canonical specs — the source of truth
SPEC/mockups/              UI comps; comp-q-*.html is the locked reference rendering
```

Dependencies flow inward, and the boundaries are **enforced rather than conventional**:
`biome.json`'s `noRestrictedImports` overrides fail the lint run on a cross-layer import, and
`tools/boundaries` is an architecture test over those rules — it writes probe files and confirms
Biome reports them, because a lint config that looks right and enforces nothing is the failure mode
that actually happened here. `apps/web` reaching into `packages/application` is a lint error,
deliberately.

Business rules live in `domain` and `application` — never in controllers or React components.

---

## Design

The UI is locked to **comp P**, rendered as **comp Q** on Tailwind v4 + shadcn/ui. Structure is
settled; the palette is open. `SPEC/mockups/comp-q-*.html` are self-contained pages you can open in
a browser — they are the reference, and the theme in
[`apps/web/app/globals.css`](apps/web/app/globals.css) is carried over from
`SPEC/mockups/_build/q.css`. Change the palette in both or the comps stop being a reference.

If a page's layout is not settled, produce a throwaway comp in `SPEC/mockups/` for review before
writing production React against an undecided design.

---

## Accounts

`pnpm start` seeds two organizations with one account per role each, all sharing the same
development-only password — `DEMO_PASSWORD` in
[`packages/infrastructure/prisma/seed/modules/scenario.ts`](packages/infrastructure/prisma/seed/modules/scenario.ts).
The three worth signing in as:

| | |
|---|---|
| `orgadmin@acme-robotics.demo.collega.test` | Creates, moves and administers |
| `user@acme-robotics.demo.collega.test` | Creates and moves, subject to the board's own setting |
| `readonly@acme-robotics.demo.collega.test` | Reads and upvotes; authoring is refused, with the reason shown |

The full roster — every address, display name and role — is [`demo.md`](demo.md).

---

## Troubleshooting

**`password authentication failed for user "collega"` even though `.env` is correct**
`POSTGRES_PASSWORD` is applied **only when the data directory is first initialized**, so an old
credential survives in an existing volume. Reset it in place without losing data — the official image
initializes `pg_hba.conf` with `local all all trust`, so this needs no password:

```bash
docker exec -it collega-postgres \
  psql -U collega -d postgres -c "ALTER USER collega WITH PASSWORD '<your-password>';"
```

`-d postgres` is not optional: `psql` defaults to a database named after the connecting user, and no
`collega` database exists — the application's is `Collega`. To start over instead
(**destroys all local data**): `docker compose down -v`.

**`pnpm check` fails on `apps/web/next-env.d.ts`**
That file is generated, and `next dev` and `next build` write different versions of it, so a dev
server left running rewrites it under you. `git checkout -- apps/web/next-env.d.ts` and re-run.

**`pnpm check` fails with `EPIPE` or `EPERM` on a Prisma engine, on Windows**
A running app holds `packages/infrastructure/dist/generated/prisma` open. Stop `pnpm start` before
running the gate, and do not run two `pnpm` commands against this workspace at once.

**`pnpm start` says something is already on 3000 or 3001**
A previous run was killed hard enough that its servers outlived it. `pnpm start` puts each server in
its own process group and signals the group, so Ctrl+C leaves nothing behind; `kill -9` on the
launcher does not.

**`prisma migrate deploy` fails with `P3005` — "the database schema is not empty"**
The database has tables Prisma did not create. Drop it and let `pnpm start` rebuild it; the seed
makes that cheap.

**`pnpm install` fails on an engine version** — the workspace requires Node ≥ 24.20 and
pnpm ≥ 12.3.4. `corepack prepare pnpm@12.3.4 --activate`.

---

## Contributing

- `SPEC/*.md` is the source of truth. If behaviour changes, update the canonical spec first, then
  tests, then implementation.
- Ask before implementing anything ambiguous, or where two canonical specs conflict.
- Feature branches: `feature/<NNN>-<short-description>`, merged into `dev`.
- An agent does not write tests for its own code; a separate QA pass does.
- Do not add dependencies without approval. Never commit secrets.

[`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md) carry the full working rules, coding standards
and the multi-agent worktree workflow.

## License

See [LICENSE](LICENSE).
