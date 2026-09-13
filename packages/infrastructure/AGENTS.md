# packages/infrastructure

Persistence via Prisma on PostgreSQL, the seed modules, and external integrations. Implements the
ports declared in `packages/application/src/*/ports.ts`. May import `@collega/domain` and
`@collega/application`; may not import `apps/*` or `@collega/design-system`.

## Layout

| Path | Holds |
|---|---|
| `src/repositories/` | One `<thing>.repository.ts` per port — the bulk of the package |
| `src/persistence/` | `prisma-client.ts`, `unit-of-work.ts`, `constraint-errors.ts` |
| `src/security/` | `pbkdf2-password-hasher.ts`, `jwt-access-token.service.ts` |
| `src/integrations/` | `ai`, `csv`, `image-processing`, `organizations` |
| `src/generated/` | Prisma Client output — **generated, git-ignored, never edited** |
| `prisma/schema.prisma` | The schema, frozen at S0.2 |
| `prisma/migrations/` | Applied migrations |
| `prisma/seed/` | `index.ts`, `compose.ts`, and `modules/` — the demo data, as code |
| `test/` | Vitest, mirroring `src/` |

## Commands

```bash
pnpm --filter @collega/infrastructure db:migrate   # prisma migrate deploy
pnpm --filter @collega/infrastructure db:seed      # rebuild the demo data
pnpm --filter @collega/infrastructure db:generate  # regenerate the client (also runs on install)
pnpm --filter @collega/infrastructure db:check-enums
```

A full `dropdb` → migrate → seed cycle takes about four seconds, which is why the database is no
longer something cutover has to preserve (`SPEC/decisions.md` 2026-09-09). Treat it as disposable:
if a change needs different data, change the seed module, don't patch rows.

## Conventions

- **The schema is frozen at S0.2.** A migration that reshapes it is a spec question, not a slice
  decision — ask first.
- **Repositories return domain shapes, not Prisma rows.** Mapping lives here; no Prisma type may
  reach `packages/application`.
- **Translate database constraint violations through `persistence/constraint-errors.ts`** into the
  application kernel's errors. A raw `P2002` must never escape this package.
- Write SQL as the house style has it: UPPERCASE keywords, lowercase identifiers, no `SELECT *`,
  meaningful aliases.
- Seeding is composed (`compose.ts`) from per-area modules and must stay deterministic and
  idempotent — no clock, no randomness.

`src/index.ts` is still the Wave 0 placeholder; the package is consumed through subpaths.
