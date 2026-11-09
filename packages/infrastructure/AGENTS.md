# Infrastructure

Implements application/domain ports with Prisma persistence on PostgreSQL, seeds and external
integrations. It may import domain and application packages, not apps or the design system.

- The Prisma schema is frozen at S0.2. Ask before changing its shape; that requires an approved
  spec decision.
- Repositories map Prisma records to domain shapes. No Prisma type crosses into application.
- Translate database constraint failures through `src/persistence/constraint-errors.ts` to
  application kernel errors; raw Prisma errors such as `P2002` must not escape.
- Prisma Client output in `src/generated/` is generated, ignored and never edited. Keep
  feature-subpath imports.
- Demo seed data is disposable: change seed modules rather than patching rows. The composed seed
  must remain deterministic and idempotent; derive IDs and content from names, with dates relative
  to the run day.
- Migration integration tests create a throwaway database; the `DATABASE_URL` role needs
  `CREATEDB`.
