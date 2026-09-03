# 05 — What survives `prisma db pull` from this schema?

Type: research
Status: open
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
