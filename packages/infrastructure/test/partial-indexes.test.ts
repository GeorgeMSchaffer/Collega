// The three partial unique indexes must survive in the baseline migration.
//
// Prisma cannot model a partial index. `prisma db pull` drops these silently and
// `prisma migrate diff` reports an empty migration, so the ordinary way to lose them is
// to regenerate the baseline and not notice - the tooling reports success either way.
// These tests are the thing that notices.
//
// The file is parsed into statements rather than scanned with one big regex. An earlier
// version used /CREATE UNIQUE INDEX[\s\S]*?WHERE[\s\S]*?;/g, which happily matched from
// one generated statement across a comment into the WHERE of a later one - it counted
// three matches, none of them these indexes, and passed while the indexes were absent.
//
// SPEC/typescript-conversion-map/findings/05-prisma-introspection.md

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const MIGRATION = resolve(
  fileURLToPath(import.meta.url),
  '../../prisma/migrations/00000000000000_baseline/migration.sql',
)

/** Index name -> the table, columns and predicate it must carry. */
const REQUIRED = {
  ux_field_definitions_organization_id_normalized_name: {
    table: 'field_definitions',
    columns: ['organization_id', 'normalized_name'],
    predicate: /"is_deleted"\s*=\s*false/i,
    why: 'a field definition name is unique per organization only among rows not soft-deleted, so a deleted name can be reused',
  },
  ux_impersonation_sessions_real_user_id_open: {
    table: 'impersonation_sessions',
    columns: ['real_user_id'],
    predicate: /"ended_at_utc"\s+IS\s+NULL/i,
    why: 'this is what makes "at most one open View As session per user" a database guarantee rather than a race between two concurrent requests',
  },
  ux_ai_prompt_versions_active: {
    table: 'ai_prompt_versions',
    columns: ['is_active'],
    predicate: /WHERE\s+"is_active"/i,
    why: 'at most one active AI prompt version, globally',
  },
} as const

/** Statements, with `-- comment` lines stripped so they cannot be mistaken for SQL. */
function statements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

const ALL = statements(readFileSync(MIGRATION, 'utf8'))

/** Statements that are a unique index carrying a WHERE predicate - i.e. partial. */
const PARTIAL_UNIQUE = ALL.filter(
  (s) => /^CREATE\s+UNIQUE\s+INDEX\b/i.test(s) && /\bWHERE\b/i.test(s),
)

describe('partial unique indexes in the baseline migration', () => {
  for (const [name, spec] of Object.entries(REQUIRED)) {
    describe(name, () => {
      const statement = PARTIAL_UNIQUE.find((s) => s.includes(`"${name}"`))

      it('is declared, as a partial unique index', () => {
        expect(
          statement,
          `${name} is missing from the baseline migration, or is no longer a UNIQUE index ` +
            `with a WHERE clause. Prisma will not regenerate it - it must be hand-written. ` +
            `Why it exists: ${spec.why}.`,
        ).toBeDefined()
      })

      it('is on the right table and columns', () => {
        expect(statement).toBeDefined()
        expect(statement).toContain(`"${spec.table}"`)
        for (const column of spec.columns) {
          expect(statement).toContain(`"${column}"`)
        }
      })

      it('keeps its WHERE predicate, which is the whole point', () => {
        expect(statement).toBeDefined()
        // Without the predicate this is an ordinary unique index with a different meaning:
        // it would reject a name reused after a soft delete, or a second closed session.
        expect(statement).toMatch(spec.predicate)
      })
    })
  }

  it('has exactly the three we know about', () => {
    expect(
      PARTIAL_UNIQUE.map((s) => /"(\w+)"/.exec(s)?.[1]).sort(),
      'A fourth partial unique index appeared, or one was removed. Introspection cannot ' +
        'see these, so the set is maintained by hand and this test is the reminder.',
    ).toEqual(Object.keys(REQUIRED).sort())
  })
})
