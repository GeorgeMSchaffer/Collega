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

## What runs today

| | |
|---|---|
| **`apps/web`** | **Runs.** `pnpm dev` → http://localhost:3000. Sign-in, desk shell, boards, ideas, the docked inspector and the settings surfaces, all against fixtures. |
| `apps/api` | **Does not run.** The Nest host exists; feature controllers are Wave D, in progress. |
| Data | Hard-coded in [`apps/web/lib/mock.ts`](apps/web/lib/mock.ts), mirroring the demo seed. When the API lands, that file is the only thing deleted. |

So the web app is real and clickable but talks to nothing yet. For a **complete working product with
real data**, the frozen .NET app is still the only option — see [`DOTNET.md`](DOTNET.md).

Wave-by-wave status lives in
[`SPEC/implementation-agent-tracker.md`](SPEC/implementation-agent-tracker.md).

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node **≥ 24.20** | |
| pnpm **≥ 12.3.4** | `corepack enable && corepack prepare pnpm@12.3.4 --activate` |
| Docker Desktop | Runs the local PostgreSQL 16 container |

---

## Setup

### 1. Create your local `.env`

`.env` is gitignored. Copy the template and set real values:

```bash
cp .env.example .env
```

```dotenv
POSTGRES_USER=collega
POSTGRES_PASSWORD=<your-password>
POSTGRES_HOST_PORT=5432

SITE_ADMIN_EMAIL=admin@collega.local
SITE_ADMIN_PASSWORD=<your-password>

# Optional. Empty is a supported state, not a misconfiguration.
ANTHROPIC_API_KEY=
```

`POSTGRES_USER` is **`collega`**, not `postgres` — the container creates exactly one login role and
names it `collega`, so local, in-cluster and application connection strings all name the same role.
It is still the container's superuser. `psql -U postgres` fails with `role "postgres" does not exist`.

`ANTHROPIC_API_KEY` powers AI-assisted idea drafting. Leaving it empty runs the feature **dark** —
the brainstorm falls back to scripted prompts and the API answers "unavailable" rather than erroring
([`SPEC/20-feature-ai-idea-assist.md`](SPEC/20-feature-ai-idea-assist.md) rule 31). One
deployment-level key is shared by every organization. Node 24 reads `.env` natively, so no loader is
needed.

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
docker inspect -f '{{.State.Health.Status}}' collega-postgres
```

The healthcheck runs `pg_isready`, which proves the server accepts connections but does **not**
authenticate — a healthy container is not evidence your password is right. Data persists in the
named volume `collega_postgres-data`.

### 3. Install and run

```bash
pnpm install
pnpm dev          # apps/web on http://localhost:3000
```

`pnpm install` generates the Prisma client as a postinstall step.

---

## Commands

```bash
pnpm dev          # apps/web on http://localhost:3000
pnpm check        # lint + typecheck + test — the gate
pnpm build
pnpm test         # every package except the Playwright suite
pnpm test:e2e     # Playwright; needs a running app
pnpm lint:fix     # Biome, with fixes applied
```

**`pnpm check` is what "green" means** — Biome (lint, format, and the layer-boundary rules), `tsc`
across every package, and Vitest. Run it before calling anything done. A single package:
`pnpm --filter @collega/api test`.

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

`DATABASE_URL` is optional locally — leave it unset and the config module composes the URL from the
`POSTGRES_*` parts, so a password has one home. In deployment it is set verbatim, which is the shape
Prisma Postgres hands over.

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
  golden                   Capture/replay harness — the conversion's only oracle
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

The demo seed creates two organizations with one account per role each, all at password `Abc123!`.
The full roster — every address, display name and role — is [`demo.md`](demo.md).

Those accounts are seeded by the frozen .NET app. `apps/web` currently uses the fixture identity in
`apps/web/lib/mock.ts`; sign-in becomes real when Wave D lands.

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
A running `next dev` rewrites that generated file in a style Biome rejects.
`git checkout -- apps/web/next-env.d.ts` and re-run.

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
