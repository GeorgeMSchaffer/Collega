# Demo accounts and data

Everything below is created by [`StartupSeeder`](src/Collega.Infrastructure/Seeding/StartupSeeder.cs)
on startup. It exists so you can sign in and click around without reading the seeder.

> **This is the frozen .NET app** ([`SPEC/decisions.md`](SPEC/decisions.md) 2026-09-06). It is kept
> runnable until slice F6 because it is still the only complete working product — the reference for
> how a screen behaved, and the source a golden fixture is re-recorded from. Do not build on it. The
> TypeScript client (`pnpm dev`) will grow its own seed as Waves D and E land.

The seed is **idempotent** and re-checks each account on every boot, so it is safe to rerun — and
deleting a demo account is undone by the next restart.

## Sign in

Every account in the table below uses the password **`Abc123!`**, and none is forced to change it.

| Role | Email | Name | Organization |
|---|---|---|---|
| Site Admin | `siteadmin@demo.collega.test` | Sam Sitewide | *(global — none)* |
| Org Admin | `orgadmin@acme-robotics.demo.collega.test` | Olivia Administer | Acme Robotics |
| User | `user@acme-robotics.demo.collega.test` | Noah Contributor | Acme Robotics |
| User | `user2@acme-robotics.demo.collega.test` | Maya Collaborator | Acme Robotics |
| Read Only | `readonly@acme-robotics.demo.collega.test` | Rosa Observer | Acme Robotics |
| Org Admin | `orgadmin@blue-harbor.demo.collega.test` | Olivia Administer | Blue Harbor Logistics |
| User | `user@blue-harbor.demo.collega.test` | Noah Contributor | Blue Harbor Logistics |
| User | `user2@blue-harbor.demo.collega.test` | Maya Collaborator | Blue Harbor Logistics |
| Read Only | `readonly@blue-harbor.demo.collega.test` | Rosa Observer | Blue Harbor Logistics |

Both organizations reuse the same four display names, so the email domain is the only thing telling
two accounts called "Olivia Administer" apart. All four product roles are covered once per
organization, which is the point — every permission perspective is reachable.

Client at http://localhost:5098, API at http://localhost:5103. Or straight against the API:

```bash
curl -s -X POST http://localhost:5103/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"orgadmin@acme-robotics.demo.collega.test","password":"Abc123!"}'
```

### The configured Site Admin is not in that table

A second Site Admin is seeded from `SITE_ADMIN_EMAIL` / `SITE_ADMIN_PASSWORD` — your own values, from
the gitignored `.env` under Docker, or user-secrets for `dotnet run`. Those are deployment
credentials, so they are deliberately not written down here.

It is also created with `MustChangePassword: true`, so signing in as it forces a password change
before anything else works. Use `siteadmin@demo.collega.test` above instead — it exists precisely so
the platform-admin perspective is testable without that secret and without the forced change.

Locked yourself out of the configured account? `dotnet run --project ./src/Collega.API -- --seed:auth=reset`
recreates it from configuration.

## What the demo data contains

Two organizations, each provisioned with the default statuses, idea types and business impacts:

| Organization | Boards |
|---|---|
| Acme Robotics — *industrial robotics and automation manufacturer* | `Ideas` (assembly cell reliability), `Opportunities` (field service enablement) |
| Blue Harbor Logistics — *regional freight and warehousing operator* | `Ideas` (warehouse throughput), `Opportunities` (route and delivery performance) |

Every board holds **11 ideas** spread `3/2/2/1/3` across the five swimlanes in canonical status order,
with tags, priorities, due dates, assignees, mentions and upvotes varied across them. Three comments
sit on the first two ideas of each board. Ideas are stamped a minute apart, oldest first, so the board
order is deterministic rather than a database tie-break.

Authorship is limited to the Org Admin and the two `User` accounts — the Read Only account writes
nothing, which is what makes it a genuine read-only perspective.

## Getting the data

Demo seeding runs automatically under the `Development` environment:

```bash
docker compose up -d postgres
dotnet run --project src/Collega.API/Collega.API.csproj
```

To force it in any environment, name the seed explicitly:

```bash
dotnet run --project src/Collega.API/Collega.API.csproj -- --seed:demo
```

Naming any `--seed:*` flag switches to explicit mode: only the seeds you name run. So `--seed:demo`
alone skips the Site Admin seed, and `--seed:auth` alone suppresses demo data even in Development.

## Related

- [`src/Collega.API/CLAUDE.md`](src/Collega.API/CLAUDE.md#seeding-flags) — full `--seed:*` semantics
- [`src/Collega.Infrastructure/CLAUDE.md`](src/Collega.Infrastructure/CLAUDE.md#seeding) — seeding mechanics and the local PostgreSQL container
- [`README.md`](README.md) — first-time setup
