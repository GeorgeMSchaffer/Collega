# 05 — What survives `prisma db pull` from this schema

Findings for conversion ticket `05`. Answered 2026-09-04 by running it, not by
reading documentation: `prisma db pull` against a real PostgreSQL 16 database
carrying the schema the five EF migrations produce, then applying the result to a
second database and diffing the two.

(**Five**, not the eleven `map.md` and `RESUME.md` report — that is the raw `.cs`
count in `Persistence/Migrations/`, which includes five `.Designer.cs` files and
the model snapshot. The migrations are `InitialCreate`, `AddImpersonationSessions`,
`AddAiUsageRecords`, `AddOrganizationAiScopeStatement` and `AddAiPromptVersions`.)

**Headline: introspection is far better than the ticket feared, and the one thing
it loses is worse than the thing the ticket predicted.**

- The risk the ticket told us to check first — organization scoping hidden in an
  EF global query filter — **does not exist**. There are no global query filters
  in this codebase at all.
- What is lost is **three partial unique indexes**, and each of them enforces an
  invariant the application relies on. They vanish silently, and Prisma's
  migration engine cannot see them well enough to warn you.

## How this was measured

```bash
prisma db pull                     # against the live EF-produced schema

# the DDL Prisma would generate from what it introspected
prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > fresh.sql
psql -d prisma_roundtrip -f fresh.sql   # apply it to an empty database

# then diff pg_indexes and information_schema.columns between the two databases

# and the claim below about silence — introspected schema vs. the database it came from
prisma migrate diff --from-schema-datamodel prisma/schema.prisma --from-schema-datasource prisma/schema.prisma
# → "This is an empty migration."  The three partial indexes are missing from one side
#    and the engine reports no difference, because it does not model them.
```

Reproducible: Postgres 16, Prisma CLI 6.19.3, the schema at `dev` as of
`edb87ab`. The scratch database was `prisma_roundtrip`.

## What survives

| Carried across | Evidence |
|---|---|
| **All 25 tables**, including `__EFMigrationsHistory` | 25 models introspected |
| **Every column**: type, length, nullability, default | `information_schema.columns` diffs **empty** between the real database and one built from the introspected schema |
| Primary keys, including composite ones | 25 PK constraints regenerated |
| **All 12 plain unique indexes** and every non-unique index | index diff shows only the three below missing |
| Foreign keys and their delete behaviour | 30 FKs; the one that differs from Prisma's default is annotated correctly — see below |
| `timestamptz(6)`, `uuid`, `bytea`, `varchar(n)` | round-tripped exactly |

**Foreign key behaviour is right, including the case that could have been wrong.**
Prisma defaults a required relation to `Restrict` and an *optional* one to
`SetNull`. Exactly one nullable FK in this schema uses `RESTRICT`
(`FK_users_organizations_organization_id` — a user's organization), where
Prisma's default would have been `SetNull` and quietly orphaned users instead of
refusing the delete. Introspection annotated it `onDelete: Restrict` precisely
because it differs from the default. Nothing else in the 30 relies on a default
that disagrees with the database.

## What is lost, and why it matters

**Three partial unique indexes. Introspection drops them, and a database created
from the introspected schema does not have them.** Verified by diffing
`pg_indexes` between the real database and the round-tripped one — these three
are the *entire* difference:

| Index | What it enforces | Consequence if lost |
|---|---|---|
| `ux_impersonation_sessions_real_user_id_open` on `(real_user_id) WHERE ended_at_utc IS NULL` | **One open View As session per user.** | Concurrent impersonation sessions for one administrator become possible. The audit trail's "acting as X on behalf of Y" stops being unambiguous, and session end has more than one thing to end. This is the security-relevant one. |
| `ux_field_definitions_organization_id_normalized_name` on `(organization_id, normalized_name) WHERE is_deleted = false` | Field names unique per organization **among live rows**, so a deleted name can be reused. | Duplicate active field names. A plain unique index is *not* a substitute — it would forbid reusing the name of a soft-deleted field, which is a behaviour change in the other direction. |
| `ux_ai_prompt_versions_active` on `(is_active) WHERE is_active` | Exactly one active AI system prompt. | Two active prompt versions; which one compiles into a turn becomes arbitrary. |

**The failure is silent in both directions**, which is what makes it dangerous:

- `prisma db pull` reports success and says nothing about the indexes it did not
  model.
- `prisma migrate diff` between the introspected schema and the live database
  reports **"This is an empty migration"** — the engine does not model partial
  indexes, so it neither preserves them nor warns that they exist. There is no
  point at which a normal Prisma workflow tells you they are gone.

Prisma has no schema syntax for a partial index. They have to be reintroduced as
raw SQL in a migration and re-applied on every environment, which means they are
also invisible to `prisma migrate dev`'s drift detection.

## What introspection cannot see, and what that costs here

The ticket's real question — what EF expresses that has no schema representation.
Measured against the source:

| EF feature | Present? | Impact |
|---|---|---|
| **Global query filters** (`HasQueryFilter`) | **None. Zero occurrences.** | The predicted catastrophe is not there. Organization scoping is explicit in the Application layer (`EnsureOrganizationScope`, plus `.Where(x => x.OrganizationId == …)` in repositories), so it ports as ordinary code that a reviewer can see. Soft-delete filtering is likewise explicit (`!x.IsDeleted` in each query). |
| **Owned types / `ToJson()`** | None | — |
| **Check constraints** | None | — |
| **Value converters** | **9, all enums** | See below — the one genuine reshape decision. |

**Enums are stored two different ways, and introspection flattens both.** Seven
are converted to `string` (`User.Role`, `User.Status`, `Idea.Priority`,
`ImpersonationSession` status, `NotificationEvent` type, two on `AiUsageRecord`)
and two to `int` (`FieldDefinition.FieldType`, `IdeaType`'s). Introspection gives
`String @db.VarChar(50)` and `Int` respectively, with nothing to say either is an
enum.

The `int` pair is the more dangerous: a column that reads as a plain `Int` where
`0`, `1`, `2` carry meaning defined only in C#. Whoever ports
`FieldDefinition.FieldType` has to know that mapping exists to get it right, and
nothing in the schema will tell them.

This is a `06` (schema reshape) decision, and the obvious one: promote all nine
to native Postgres enums or to Prisma enums backed by the existing storage. The
`int` columns need a data migration either way — the point is that F3 already
rewrites every row, so doing it there costs a `CASE` expression, while doing it
afterwards costs a migration of its own against live data.

## Collation and case sensitivity

**Not an issue on the schema side.** The database is `C.UTF-8` and **no column
carries an explicit collation** (`information_schema.columns.collation_name` is
null for all of them), so there is nothing for introspection to lose.

Sprint 5's collation work lives in *queries*, not in the schema: after the
SQL Server → Postgres move, case-insensitive matching is done with `lower()` on
both sides (`LikePattern.ContainsCaseInsensitive`, and `EfUserRepository`'s
comment saying the old collation cannot be relied on). Those comments mark where
the risk is for whoever ports the queries — `LikePattern.cs` and the search paths
in `EfUserRepository`, `EfIdeaRepository` and `FieldDefinitionConfiguration` —
but none of it is schema, so `db pull` was never going to carry it and its loss
is not silent: the code has to be rewritten deliberately.
`EfOrganizationRepository` uses `ContainsCaseInsensitive` too and belongs on that
list of ports to review.

`FieldDefinitionConfiguration.cs:66` documents the same trap for uniqueness: the
normalized-name column exists *because* Postgres compares case-sensitively.
Prisma keeps the column, so that mechanism ports intact.

## `__EFMigrationsHistory`

Introspected as an ordinary model named `EFMigrationsHistory`. It is EF's
bookkeeping and means nothing to Prisma.

Clean handover: drop the table as part of F3's data migration and let Prisma's
`_prisma_migrations` be the only history. Do not carry it across — a schema with
two migration-history tables invites someone to run the wrong tool at it. The
cutover is big-bang, so there is no window in which both need to be true.

## What this means for ticket `06`

1. **Introspect, then reshape** (charting decision 7) is sound. The starting
   point is faithful for tables, columns, keys, FKs and ordinary indexes.
2. **The three partial indexes must be re-added by hand as raw SQL**, in the
   first migration, with a test that fails if any is absent. They are database
   invariants, and the only reason to accept losing them would be moving each
   into application code — which for the impersonation one means a race a
   database constraint currently forecloses.
3. **Decide enum representation during the reshape**, all nine together.
4. Relation field names from introspection are unusable as-is —
   `impersonation_sessions_impersonation_sessions_real_user_idTousers` is a real
   generated name. Renaming them with `@relation`/`@map` is cosmetic but touches
   every query, so do it before Wave B rather than during it.
5. Budget: the reshape's risk is **not** rediscovering hidden EF behaviour, since
   there is almost none. It is the three indexes and the enum decision. That is a
   smaller and better-defined job than the ticket assumed.

## Confidence, and what would change these findings

Everything above is measured against a live database except one claim worth
flagging: that dropping the partial indexes matters is a *reading* of what the
application does, not something the schema proves. The impersonation one is
backed by `SPEC/20-feature-view-as.md`'s single-session rule; the other two by
the code paths that create field definitions and publish prompt versions.

These findings describe the schema at `edb87ab`. Sprint 7.5 and Sprint 8 land
before the conversion starts; **if either adds a migration, re-run this** — it is
about ten minutes of work and the commands are above.
