# Collega

Organization-scoped collaboration and idea tracking. Organizations contain users, boards, statuses
and ideas; boards arrange ideas by status in swimlanes.

**Stack:** TypeScript · Next.js · Nest.js · Prisma · PostgreSQL 16 · Tailwind v4 + shadcn/ui ·
Vitest + Playwright · pnpm workspaces + Turborepo

> **Mid-conversion.** The product is being re-expressed from .NET into TypeScript in one cutover
> ([`SPEC/50-typescript-migration.md`](SPEC/50-typescript-migration.md)). `apps/` and `packages/` are
> the application. The .NET code in `src/` and `tests/` is **frozen** — not maintained, deleted in
> conversion slice F6 — and its instructions no longer apply: [`DOTNET.md`](DOTNET.md).

---

## Run it

```bash
pnpm install
pnpm start
```

That is the whole thing: Next on http://localhost:3000, Nest on
http://localhost:3001/api/v1, a migrated and seeded PostgreSQL behind them. Ctrl+C stops both.

[`tools/local/start.ts`](tools/local/start.ts) is what it runs, and it is idempotent — copy `.env`
from the example if it is missing, start the `postgres` compose service **only** if nothing is
already listening at the host and port `DATABASE_URL` names, build, `prisma migrate deploy`, seed,
then run both halves. Run it as often as you like. It reloads the web app on save; **re-run it after
changing `apps/api`**, which it runs as built output rather than under a watcher.

You need Node **≥ 24.20**, pnpm **≥ 12.3.4** (`corepack enable && corepack prepare pnpm@12.3.4
--activate`), and — unless you already run a PostgreSQL 16 — **Docker**, which is what the database
container needs. Point `DATABASE_URL` at a cluster you already run **on this machine** and Docker is
not involved at all.

It refuses to run against anything else. The script migrates and seeds whatever `DATABASE_URL`
names, so a host that is not loopback stops it before the first write with the address it read;
`COLLEGA_ALLOW_REMOTE_DATABASE=1` is the way to say you meant it. Nothing here is a substitute for
that being your own database — the seed upserts demo organizations and users.

`.env` is gitignored and copied from [`.env.example`](.env.example), whose defaults are placeholders
for a throwaway local container. Two are worth knowing about: `POSTGRES_USER` is **`collega`**, not
`postgres` — the container creates exactly one login role, so `psql -U postgres` fails with `role
"postgres" does not exist` — and `ANTHROPIC_API_KEY` may be left empty, which runs AI-assisted idea
drafting **dark** rather than broken ([`SPEC/20-feature-ai-idea-assist.md`](SPEC/20-feature-ai-idea-assist.md)
rule 31).

### What works, and what is still a fixture

| | |
|---|---|
| `apps/api` | **Runs.** Every feature controller, against the real database. |
| Sign-in, boards, board detail | **Live.** Real identity, real boards, real cards — and the board writes: author an idea, move a card between lanes, toggle an upvote. |
| The ideas list, the idea inspector, delivery, settings | **Fixtures**, from [`apps/web/lib/mock.ts`](apps/web/lib/mock.ts). Clickable, but not talking to anything. |

So the board is the screen to look at. Which of the two a screen gets is decided in
[`apps/web/lib/data/`](apps/web/lib/data) and nowhere else — a reader there is either a `fetch` or a
fixture, and the call sites cannot tell. Where a fixture reader would otherwise be joined against
real rows it is named `getFixture*`, so `grep getFixture` finds the screens that are waiting on a
conversion rather than merely unconverted. Wave-by-wave status lives in
[`SPEC/implementation-agent-tracker.md`](SPEC/implementation-agent-tracker.md).

For the parts nothing has replaced yet, the frozen .NET app is still the only place to see how a
screen behaved — see [`DOTNET.md`](DOTNET.md).

---

## Commands

```bash
pnpm start        # the whole application — API, web, database
pnpm dev          # apps/web alone, against whatever API is already running
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

## Database

Prisma owns the schema ([`packages/infrastructure/prisma/schema.prisma`](packages/infrastructure/prisma/schema.prisma)),
frozen at conversion slice S0.2 — 25 models, 9 enums.

```bash
pnpm --filter @collega/infrastructure db:generate   # regenerate the client
pnpm --filter @collega/infrastructure db:migrate    # apply migrations
pnpm --filter @collega/infrastructure db:seed
```

The Nest host composes `DATABASE_URL` from the `POSTGRES_*` parts when it is unset, so a password has
one home. **The Prisma CLI cannot** — `migrate`, `db pull` and `studio` read `env("DATABASE_URL")`
straight out of the schema — which is why `pnpm start` writes the composed value back into `.env` the
first time. In deployment it is set verbatim, which is the shape Prisma Postgres hands over.

To start over (**destroys all local data**): `docker compose down -v`, then `pnpm start`. The seed
rebuilds the demo data from committed code in under four seconds, so there is nothing in the local
database worth protecting.

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
  boundaries  arch         Architecture tests over the layer rules

SPEC/                      Canonical specs — the source of truth
SPEC/mockups/              UI comps; comp-q-*.html is the locked reference rendering

src/  tests/               FROZEN .NET application — see DOTNET.md. Deleted in slice F6.
```

Dependencies flow inward, and the boundaries are **enforced rather than conventional**:
`biome.json`'s `noRestrictedImports` overrides fail the lint run on a cross-layer import, and
`tools/boundaries` is an architecture test over those rules. `apps/web` reaching into
`packages/application` is a lint error, deliberately.

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

`pnpm start` seeds two organizations with one account per role each, and gives all of them the same
development-only password — `DEMO_PASSWORD` in
[`packages/infrastructure/prisma/seed/modules/scenario.ts`](packages/infrastructure/prisma/seed/modules/scenario.ts),
which the seed refuses to run in production. The three worth signing in as:

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

**`pnpm start` says something is already on 3000 or 3001**
A previous run was killed hard enough that its servers outlived it. `pnpm start` puts each server in
its own process group and signals the group, so Ctrl+C leaves nothing behind; `kill -9` on the
launcher does not.

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
