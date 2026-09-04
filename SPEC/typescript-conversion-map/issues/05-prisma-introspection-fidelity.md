# 05 — What survives `prisma db pull` from this schema?

> **Answered 2026-09-04; findings in [`../findings/05-prisma-introspection.md`](../findings/05-prisma-introspection.md).**
> Run against a live Postgres 16 carrying the schema the migrations produce, not from
> documentation. (There are **five** migrations, not the eleven this file and `map.md` say —
> that count includes the `.Designer.cs` files and the model snapshot.) Short version: the risk this ticket told us to check first — organization
> scoping hidden in a global query filter — **does not exist**; there are zero `HasQueryFilter`
> occurrences. Tables, columns, keys, FKs and plain indexes round-trip exactly. What is lost is
> **three partial unique indexes**, silently and in both directions, and the enum storage split
> (seven as string, two as int) that `06` has to decide. This file is kept as written.

Type: research
Status: answered 2026-09-04 — see `findings/05-prisma-introspection.md`
Blocked by: —

## Question

AFK research. Charting decision 7 is "introspect, then reshape" — but introspection fidelity is a fact, not a preference, and the reshape conversation (`06`) cannot be had without it.

Against the actual schema produced by the 11 EF migrations in `src/Collega.Infrastructure/Persistence/Migrations`, determine what `prisma db pull` does and does not carry across:

- Check constraints, unique filtered/partial indexes, composite keys
- **Column collation** — Sprint 5's Postgres cutover produced deliberate collation decisions. Do they survive introspection, and does Prisma preserve them on subsequent `migrate` runs?
- `LIKE` wildcard and case-sensitivity behavior the code depends on. The repo deliberately keeps SQL-Server-era comments flagging exactly these; they are a map of where the risk lives.
- Index byte-limit workarounds, also flagged in those comments
- Enum mapping: EF enums-as-int versus Prisma native Postgres enums
- The `__EFMigrationsHistory` table — what happens to it, and what a clean handover of migration ownership looks like
- **Anything EF expresses in `OnModelCreating` that has no schema representation at all** — global query filters, value converters, owned types. These are invisible to introspection, so they will silently not appear in `schema.prisma`. This is the real risk and the main reason this ticket exists.

Organization scoping is very likely implemented as an EF global query filter. If so, it vanishes on introspection and every Prisma query needs it reapplied by hand — a silent, security-relevant regression. **Check this first.**

**Resolve by:** a findings document on a throwaway `research/prisma-introspection` branch, linked here. Run it against a real Postgres container, not from documentation alone — the local `collega-postgres` container and the standard demo seed exist for this.
