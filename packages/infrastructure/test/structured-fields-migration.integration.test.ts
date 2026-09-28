// The rule 2a backfill in `20260927010000_add_structured_idea_fields` (SPEC/20-feature-ideas-and-
// engagement.md rule 2a), run as written against a database that holds ideas from before it.
//
// The migration touches `ideas.description` and nothing else, so the throwaway database holds only
// that much of `ideas`: an id and the old NOT NULL description. The migration file itself is sent
// through `prisma db execute`, which is what `migrate deploy` would send. Skipped unless
// `DATABASE_URL` is set; the throwaway database is created beside it and dropped afterwards.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'

const DATABASE_URL = process.env.DATABASE_URL
const MIGRATION = fileURLToPath(
  new URL(
    '../prisma/migrations/20260927010000_add_structured_idea_fields/migration.sql',
    import.meta.url,
  ),
)
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js')
const NOT_CAPTURED = 'Not captured before 2026-09-27.'

const WITH_DESCRIPTION = '10000000-0000-0000-0000-000000000001'
const BLANK_DESCRIPTION = '10000000-0000-0000-0000-000000000002'
const LONG_DESCRIPTION = '10000000-0000-0000-0000-000000000003'
const PADDED_DESCRIPTION = '10000000-0000-0000-0000-000000000004'

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

describe.skipIf(!DATABASE_URL)('Structured idea fields migration backfill', () => {
  const database = `collega_mig_probe_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const admin = new PrismaClient()
  let probe: PrismaClient

  type Row = {
    id: string
    description: string | null
    problem: string
    proposed_solutions: string[]
    impact_rationale: string
  }
  let rows: Map<string, Row>

  beforeAll(async () => {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
    const url = withDatabase(DATABASE_URL as string, database)
    probe = new PrismaClient({ datasourceUrl: url })

    await probe.$executeRawUnsafe(
      'CREATE TABLE ideas (id UUID PRIMARY KEY, description VARCHAR(4000) NOT NULL)',
    )
    await probe.$executeRaw`INSERT INTO ideas (id, description) VALUES
      (${WITH_DESCRIPTION}::uuid, 'Printers jam every morning.'),
      (${BLANK_DESCRIPTION}::uuid, '   '),
      (${LONG_DESCRIPTION}::uuid, ${'x'.repeat(2500)}),
      (${PADDED_DESCRIPTION}::uuid, ${`  ${'y'.repeat(1999)}z  `})`

    execFileSync(
      process.execPath,
      [PRISMA_CLI, 'db', 'execute', '--url', url, '--file', MIGRATION],
      {
        stdio: 'pipe',
      },
    )

    const read = await probe.$queryRaw<Row[]>`
      SELECT i.id::text AS id, i.description, i.problem, i.proposed_solutions, i.impact_rationale
      FROM ideas i`
    rows = new Map(read.map((row) => [row.id, row]))
  }, 60_000)

  afterAll(async () => {
    await probe?.$disconnect()
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`)
    await admin.$disconnect()
  })

  it('backfills Problem from the description, trimmed', () => {
    expect(rows.get(WITH_DESCRIPTION)).toMatchObject({
      problem: 'Printers jam every morning.',
      proposed_solutions: [NOT_CAPTURED],
      impact_rationale: NOT_CAPTURED,
    })
  })

  it('writes the not-captured text into all three fields when the description is blank', () => {
    expect(rows.get(BLANK_DESCRIPTION)).toMatchObject({
      problem: NOT_CAPTURED,
      proposed_solutions: [NOT_CAPTURED],
      impact_rationale: NOT_CAPTURED,
    })
  })

  it('cuts a description longer than Problem allows to its first 2000 characters', () => {
    expect(rows.get(LONG_DESCRIPTION)?.problem).toBe('x'.repeat(2000))
    expect(rows.get(LONG_DESCRIPTION)?.description).toHaveLength(2500)
  })

  it('trims before cutting, so surrounding whitespace does not cost characters', () => {
    expect(rows.get(PADDED_DESCRIPTION)?.problem).toBe(`${'y'.repeat(1999)}z`)
  })

  it('leaves the three columns NOT NULL and the description nullable', async () => {
    const columns = await probe.$queryRaw<{ column_name: string; is_nullable: string }[]>`
      SELECT c.column_name, c.is_nullable
      FROM information_schema.columns c
      WHERE c.table_name = 'ideas'
      ORDER BY c.column_name`
    expect(Object.fromEntries(columns.map((c) => [c.column_name, c.is_nullable]))).toEqual({
      description: 'YES',
      id: 'NO',
      impact_rationale: 'NO',
      problem: 'NO',
      proposed_solutions: 'NO',
    })
  })
})
