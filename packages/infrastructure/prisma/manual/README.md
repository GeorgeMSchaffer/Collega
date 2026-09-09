# Manual migrations

One-off SQL run by hand against a specific database. **Not part of the Prisma migration chain** —
nothing here replays on a fresh database, and nothing here should be moved into
`prisma/migrations/`.

## `2026-09-08-ef-enum-drift.sql`

Repairs the EF-migrated database described in `SPEC/decisions.md` 2026-09-07: zero user-defined enum
types where `schema.prisma` declares nine, so **every Prisma write through those nine columns
fails**. Five columns are `character varying`, four are `integer`.

**The chosen path is a rebuild** (decided 2026-09-09, `SPEC/decisions.md`). The migration below
is the exception, kept for a database someone would rather not lose.

### The decision — rebuild

```bash
dropdb Collega && createdb Collega
pnpm --filter @collega/infrastructure db:migrate   # baseline; creates all nine types correctly
pnpm --filter @collega/infrastructure db:seed      # 2 orgs, 10 users, 4 boards, 44 ideas
```

**Verified 2026-09-09: 3.7 seconds end to end**, `db:check-enums` reporting `0 of 9 columns need
migrating` and the live-database suite passing 28/28 against the result. Correct by construction
rather than repaired. This only became possible when the demo seed landed on 2026-09-08 — before
that, the database was the only copy of its own contents.

It **loses anything hand-created**: data entered while testing, an organization someone set up by
hand. There was none worth keeping when this was decided.

### The exception — migrate in place

Still the right move for a pre-existing developer database holding local work, since the drift is in
every one of them:

```bash
pg_dump -Fc "$DATABASE_URL" > collega-before-enum-migration.dump   # do this first
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 2026-09-08-ef-enum-drift.sql
pnpm --filter @collega/infrastructure db:check-enums               # expect 0 of 9
```

Converts each column from whichever shape it is actually in, preserving every row.

### How this was verified

Not against the live database — nobody had access to it from where this was written. Instead a
scratch database was built from the baseline, seeded, given a `field_definitions` row for each of
the seven field types, and then **deliberately drifted into the recorded EF shape**: five columns to
`varchar`, four to `integer`, all nine types dropped, matching the decision's table exactly. Against
that:

- every row kept its identity — the fourteen `field_definitions` rows were inserted with `name` set
  to their own field type, and all fourteen still agree after conversion, which is what catches an
  off-by-one that counts alone cannot;
- ordinal counts mapped through correctly, including the asymmetric `Priority` spread
  (`0→Low ×12, 1→Medium ×12, 2→High ×12, 3→Critical ×8`);
- `db:check-enums` reports `0 of 9 columns need migrating`;
- **Prisma writes through `users.role`, `users.status` and `field_definitions.field_type` succeed** —
  the thing the decision says is broken;
- a re-run skips all nine columns, and a fresh database is a no-op: 0 conversions, 0 types created.

### The trap this file exists to defend against

`FieldType` is **1-based** (`Text = 1 … Url = 7`). Every other enum here is 0-based. A single
ordinal map shifts every field type by one **and still commits**, because 1..7 are all valid indexes
into a seven-label array — it relabels Text as Number and keeps going. That is why the mapping is a
data table with an explicit `base` column rather than nine hand-written casts.
