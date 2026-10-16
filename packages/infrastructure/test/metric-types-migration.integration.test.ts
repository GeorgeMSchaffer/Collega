// The metric-types migration (20261016000000_add_metric_types), run as written against a database
// that already holds organizations, ideas and lanes. The probe database holds only the columns the
// migration alters or references. The migration file is sent through `prisma db execute`, which is
// what `migrate deploy` would send. Skipped unless `DATABASE_URL` is set.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'

const DATABASE_URL = process.env.DATABASE_URL
const MIGRATION = fileURLToPath(
  new URL('../prisma/migrations/20261016000000_add_metric_types/migration.sql', import.meta.url),
)
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js')

const id = (n: number) => `40000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const ORG = id(1)
const [BOARD, LANE, IDEA, IDEA_TWO] = [id(11), id(21), id(31), id(32)] as const
const [TYPE_COST, TYPE_HOURS] = [id(41), id(42)] as const
const STATUS = id(51)
const NOW = '2026-10-16T00:00:00Z'

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

describe.skipIf(!DATABASE_URL)('Metric types migration', () => {
  // The tests share one database and run in file order: the type-delete test relies on the values
  // written by the earlier ones, and the idea-delete test must stay last.
  const database = `collega_mig_probe_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const admin = new PrismaClient()
  let probe: PrismaClient

  beforeAll(async () => {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
    const url = withDatabase(DATABASE_URL as string, database)
    probe = new PrismaClient({ datasourceUrl: url })

    for (const statement of [
      'CREATE TABLE organizations (id UUID PRIMARY KEY)',
      'CREATE TABLE boards (id UUID PRIMARY KEY)',
      'CREATE TABLE board_swimlanes (id UUID PRIMARY KEY, board_id UUID NOT NULL REFERENCES boards (id), status_id UUID NOT NULL)',
      'CREATE TABLE ideas (id UUID PRIMARY KEY)',
    ]) {
      await probe.$executeRawUnsafe(statement)
    }
    await probe.$executeRaw`INSERT INTO organizations (id) VALUES (${ORG}::uuid)`
    await probe.$executeRaw`INSERT INTO boards (id) VALUES (${BOARD}::uuid)`
    await probe.$executeRaw`INSERT INTO board_swimlanes (id, board_id, status_id)
      VALUES (${LANE}::uuid, ${BOARD}::uuid, ${STATUS}::uuid)`
    await probe.$executeRaw`INSERT INTO ideas (id) VALUES (${IDEA}::uuid), (${IDEA_TWO}::uuid)`

    execFileSync(
      process.execPath,
      [PRISMA_CLI, 'db', 'execute', '--url', url, '--file', MIGRATION],
      { stdio: 'pipe' },
    )
  }, 60_000)

  afterAll(async () => {
    await probe?.$disconnect()
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`)
    await admin.$disconnect()
  })

  it('defaults auto_create_task to false on existing lanes', async () => {
    const lanes = await probe.$queryRaw<{ auto_create_task: boolean }[]>`
      SELECT auto_create_task FROM board_swimlanes WHERE id = ${LANE}::uuid`
    expect(lanes[0]).toEqual({ auto_create_task: false })
  })

  it('creates metric types that are active by default and may share a name', async () => {
    await probe.$executeRaw`INSERT INTO metric_types (metric_type_id, organization_id, name, created_at_utc, updated_at_utc)
      VALUES (${TYPE_COST}::uuid, ${ORG}::uuid, 'Cost saved', ${NOW}::timestamptz, ${NOW}::timestamptz),
        (${TYPE_HOURS}::uuid, ${ORG}::uuid, 'Cost saved', ${NOW}::timestamptz, ${NOW}::timestamptz)`
    const rows = await probe.$queryRaw<{ is_archived: boolean; unit: string | null }[]>`
      SELECT is_archived, unit FROM metric_types WHERE metric_type_id = ${TYPE_COST}::uuid`
    expect(rows[0]).toEqual({ is_archived: false, unit: null })
  })

  it('refuses a metric type for an unknown organization', async () => {
    await expect(
      probe.$executeRaw`INSERT INTO metric_types (metric_type_id, organization_id, name, created_at_utc, updated_at_utc)
        VALUES (${id(43)}::uuid, ${id(99)}::uuid, 'Orphan', ${NOW}::timestamptz, ${NOW}::timestamptz)`,
    ).rejects.toThrow(/FK_metric_types_organizations_organization_id/)
  })

  it('stores two-decimal values, allows nulls, and keeps one row per idea and type', async () => {
    await probe.$executeRaw`INSERT INTO idea_metric_values (idea_id, metric_type_id, projected, realized)
      VALUES (${IDEA}::uuid, ${TYPE_COST}::uuid, -1234.5, NULL),
        (${IDEA}::uuid, ${TYPE_HOURS}::uuid, NULL, 7)`
    const rows = await probe.$queryRaw<{ projected: string | null }[]>`
      SELECT projected::text AS projected FROM idea_metric_values
      WHERE idea_id = ${IDEA}::uuid AND metric_type_id = ${TYPE_COST}::uuid`
    expect(rows[0]?.projected).toBe('-1234.50')
    await expect(
      probe.$executeRaw`INSERT INTO idea_metric_values (idea_id, metric_type_id)
        VALUES (${IDEA}::uuid, ${TYPE_COST}::uuid)`,
    ).rejects.toThrow(/23505.*Key \(idea_id, metric_type_id\)=/s)
  })

  it('refuses a value above 10^15 in magnitude', async () => {
    await expect(
      probe.$executeRaw`INSERT INTO idea_metric_values (idea_id, metric_type_id, projected)
        VALUES (${IDEA_TWO}::uuid, ${TYPE_COST}::uuid, 1000000000000000)`,
    ).rejects.toThrow(/numeric field overflow/)
  })

  it('refuses to delete a metric type that still has values', async () => {
    await expect(
      probe.$executeRaw`DELETE FROM metric_types WHERE metric_type_id = ${TYPE_COST}::uuid`,
    ).rejects.toThrow(/FK_idea_metric_values_metric_types_metric_type_id/)
  })

  it('removes the values of a deleted idea', async () => {
    await probe.$executeRaw`DELETE FROM ideas WHERE id = ${IDEA}::uuid`
    const rows = await probe.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM idea_metric_values`
    expect(Number(rows[0]?.n)).toBe(0)
  })
})
