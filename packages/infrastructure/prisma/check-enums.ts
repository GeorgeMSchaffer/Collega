/**
 * Reports what the live database actually stores in the nine enum columns.
 *
 * Run before writing or re-running the enum migration:
 *   pnpm --filter @collega/infrastructure db:check-enums
 *
 * `SPEC/decisions.md` 2026-09-07 recorded seven mismatched columns. The schema declares nine
 * enums across nine columns, so two were never characterised, and the two it did characterise as
 * `integer` matter more than the rest: text-to-enum casts itself by name, integer does not, and a
 * wrong ordinal map silently rewrites every row rather than failing. This prints ground truth
 * instead of asking anyone to trust that note.
 *
 * Read-only. It runs no DDL and writes nothing.
 */

import { PrismaClient } from '../src/generated/prisma/client.js'

/** column -> the Postgres enum type the schema wants it to be. */
const EXPECTED: ReadonlyArray<{ table: string; column: string; type: string }> = [
  { table: 'users', column: 'role', type: 'Role' },
  { table: 'users', column: 'status', type: 'UserStatus' },
  { table: 'notification_events', column: 'event_type', type: 'NotificationEventType' },
  { table: 'ai_usage_records', column: 'outcome', type: 'AiCallOutcome' },
  { table: 'ai_usage_records', column: 'key_source', type: 'AiKeySource' },
  { table: 'field_definitions', column: 'field_type', type: 'FieldType' },
  { table: 'idea_types', column: 'field_mode', type: 'IdeaTypeFieldMode' },
  { table: 'ideas', column: 'priority', type: 'Priority' },
  { table: 'impersonation_sessions', column: 'end_reason', type: 'ImpersonationEndReason' },
]

type ColumnRow = { table_name: string; column_name: string; data_type: string; udt_name: string }
type TypeRow = { typname: string }
type MigrationRow = { exists: boolean }

async function main(): Promise<void> {
  const prisma = new PrismaClient()
  try {
    const types = await prisma.$queryRawUnsafe<TypeRow[]>(
      `SELECT t.typname FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE t.typtype = 'e' AND n.nspname = 'public'
       ORDER BY t.typname`,
    )
    console.log(`user-defined enum types present: ${types.length}`)
    for (const t of types) console.log(`  ${t.typname}`)

    const columns = await prisma.$queryRawUnsafe<ColumnRow[]>(
      `SELECT table_name, column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, column_name`,
    )
    const found = new Map(columns.map((c) => [`${c.table_name}.${c.column_name}`, c]))

    console.log('\ncolumn                                   live type        wanted')
    let mismatched = 0
    for (const want of EXPECTED) {
      const key = `${want.table}.${want.column}`
      const live = found.get(key)
      const liveType = live
        ? live.data_type === 'USER-DEFINED'
          ? live.udt_name
          : live.data_type
        : 'MISSING'
      const ok = live?.data_type === 'USER-DEFINED' && live.udt_name === want.type
      if (!ok) mismatched += 1
      console.log(`${ok ? ' ok ' : 'MISM'} ${key.padEnd(38)} ${liveType.padEnd(16)} ${want.type}`)
    }

    // An EF-migrated database has no Prisma history, so `migrate deploy` would try to apply the
    // baseline over existing tables. It needs `migrate resolve --applied` first.
    const [history] = await prisma.$queryRawUnsafe<MigrationRow[]>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
       ) AS exists`,
    )
    console.log(`\n_prisma_migrations table: ${history?.exists ? 'present' : 'ABSENT'}`)
    if (!history?.exists) {
      console.log(
        '  -> run `prisma migrate resolve --applied 00000000000000_baseline` before deploy',
      )
    }

    // Row counts for the two integer columns: an ordinal map is only as safe as the values it
    // actually has to cover, and an empty table needs no CASE arm defended.
    for (const t of ['field_definitions', 'idea_types', 'ideas', 'users']) {
      const [row] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT COUNT(*)::bigint AS n FROM "${t}"`,
      )
      console.log(`rows in ${t}: ${row?.n ?? 0}`)
    }

    console.log(`\n${mismatched} of ${EXPECTED.length} columns need migrating.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
