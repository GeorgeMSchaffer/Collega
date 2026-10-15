// The Board References migration (20261015000000_add_board_references), run as written against a
// database that already holds boards, lanes, ideas and sprints. The probe database holds only the
// columns the migration alters or references. The migration file is sent through `prisma db
// execute`, which is what `migrate deploy` would send. Skipped unless `DATABASE_URL` is set.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'

const DATABASE_URL = process.env.DATABASE_URL
const MIGRATION = fileURLToPath(
  new URL(
    '../prisma/migrations/20261015000000_add_board_references/migration.sql',
    import.meta.url,
  ),
)
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js')

const id = (n: number) => `30000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const [ORG_A, ORG_B] = [id(1), id(2)] as const
const [BOARD_CI, BOARD_IMPL, BOARD_OTHER_ORG] = [id(11), id(12), id(13)] as const
const [LANE_CI, LANE_IMPL] = [id(21), id(22)] as const
const [PARENT, TASK, TASK_TWO] = [id(31), id(32), id(33)] as const
const SPRINT = id(41)
const STATUS = id(51)
const NOW = '2026-10-15T00:00:00Z'

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

describe.skipIf(!DATABASE_URL)('Board References migration', () => {
  // The tests share one database and must run in file order: the board-delete test relies on the
  // reference made by 'lets a lane reference another board', and the dependency test deletes an
  // idea and must stay last.
  const database = `collega_mig_probe_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const admin = new PrismaClient()
  let probe: PrismaClient

  beforeAll(async () => {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
    const url = withDatabase(DATABASE_URL as string, database)
    probe = new PrismaClient({ datasourceUrl: url })

    for (const statement of [
      'CREATE TABLE boards (id UUID PRIMARY KEY, organization_id UUID NOT NULL)',
      // ON DELETE CASCADE on board_id (as in the real schema) so that only the migration's own
      // references_board_id constraint can block a board delete.
      'CREATE TABLE board_swimlanes (id UUID PRIMARY KEY, board_id UUID NOT NULL REFERENCES boards (id) ON DELETE CASCADE, status_id UUID NOT NULL)',
      'CREATE TABLE ideas (id UUID PRIMARY KEY, board_id UUID)',
      'CREATE TABLE sprints (id UUID PRIMARY KEY, state TEXT NOT NULL)',
    ]) {
      await probe.$executeRawUnsafe(statement)
    }
    await probe.$executeRaw`INSERT INTO boards (id, organization_id) VALUES
      (${BOARD_CI}::uuid, ${ORG_A}::uuid), (${BOARD_IMPL}::uuid, ${ORG_A}::uuid),
      (${BOARD_OTHER_ORG}::uuid, ${ORG_B}::uuid)`
    await probe.$executeRaw`INSERT INTO board_swimlanes (id, board_id, status_id) VALUES
      (${LANE_CI}::uuid, ${BOARD_CI}::uuid, ${STATUS}::uuid),
      (${LANE_IMPL}::uuid, ${BOARD_IMPL}::uuid, ${STATUS}::uuid)`
    await probe.$executeRaw`INSERT INTO ideas (id, board_id) VALUES
      (${PARENT}::uuid, ${BOARD_CI}::uuid), (${TASK}::uuid, ${BOARD_IMPL}::uuid),
      (${TASK_TWO}::uuid, ${BOARD_IMPL}::uuid)`
    await probe.$executeRaw`INSERT INTO sprints (id, state) VALUES (${SPRINT}::uuid, 'Active')`

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

  it('leaves existing rows untouched and applies the defaults', async () => {
    const boards = await probe.$queryRaw<
      {
        sprints_enabled: boolean
        idea_features_enabled: boolean
        key_prefix: string | null
        next_item_number: number
      }[]
    >`SELECT sprints_enabled, idea_features_enabled, key_prefix, next_item_number FROM boards WHERE id = ${BOARD_CI}::uuid`
    expect(boards[0]).toEqual({
      sprints_enabled: false,
      idea_features_enabled: true,
      key_prefix: null,
      next_item_number: 1,
    })
    const lanes = await probe.$queryRaw<
      { is_final: boolean; references_board_id: string | null }[]
    >`
      SELECT is_final, references_board_id::text AS references_board_id FROM board_swimlanes WHERE id = ${LANE_CI}::uuid`
    expect(lanes[0]).toEqual({ is_final: false, references_board_id: null })
    const sprints = await probe.$queryRaw<{ board_id: string | null }[]>`
      SELECT board_id::text AS board_id FROM sprints WHERE id = ${SPRINT}::uuid`
    expect(sprints[0]?.board_id).toBeNull()
  })

  it('lets a lane reference another board, and two lanes reference the same target', async () => {
    await probe.$executeRaw`UPDATE board_swimlanes SET references_board_id = ${BOARD_IMPL}::uuid WHERE id = ${LANE_CI}::uuid`
    await probe.$executeRaw`INSERT INTO board_swimlanes (id, board_id, status_id, references_board_id)
      VALUES (${id(23)}::uuid, ${BOARD_OTHER_ORG}::uuid, ${STATUS}::uuid, ${BOARD_IMPL}::uuid)`
    const rows = await probe.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM board_swimlanes WHERE references_board_id = ${BOARD_IMPL}::uuid`
    expect(Number(rows[0]?.n)).toBe(2)
  })

  it('refuses a lane that references its own board', async () => {
    await expect(
      probe.$executeRaw`UPDATE board_swimlanes SET references_board_id = ${BOARD_IMPL}::uuid WHERE id = ${LANE_IMPL}::uuid`,
    ).rejects.toThrow(/ck_board_swimlanes_no_self_reference/)
  })

  it('refuses to delete a board a lane still references', async () => {
    await expect(
      probe.$executeRaw`DELETE FROM boards WHERE id = ${BOARD_IMPL}::uuid`,
    ).rejects.toThrow(/FK_board_swimlanes_boards_references_board_id/)
  })

  it('refuses an idea that is its own parent, and accepts a real parent', async () => {
    await expect(
      probe.$executeRaw`UPDATE ideas SET parent_idea_id = id WHERE id = ${TASK}::uuid`,
    ).rejects.toThrow(/ck_ideas_no_self_parent/)
    await probe.$executeRaw`UPDATE ideas SET parent_idea_id = ${PARENT}::uuid WHERE id = ${TASK}::uuid`
  })

  it('numbers items uniquely per board but lets the same number appear on two boards', async () => {
    await probe.$executeRaw`UPDATE ideas SET item_number = 1 WHERE id = ${PARENT}::uuid`
    await probe.$executeRaw`UPDATE ideas SET item_number = 1 WHERE id = ${TASK}::uuid`
    await expect(
      probe.$executeRaw`UPDATE ideas SET item_number = 1 WHERE id = ${TASK_TWO}::uuid`,
    ).rejects.toThrow(/23505.*Key \(board_id, item_number\)=/s)
  })

  it('keeps a key prefix unique within an organization only, and lets unprefixed boards coexist', async () => {
    const unprefixed = await probe.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM boards WHERE organization_id = ${ORG_A}::uuid AND key_prefix IS NULL`
    expect(Number(unprefixed[0]?.n)).toBe(2)
    await probe.$executeRaw`UPDATE boards SET key_prefix = 'CI' WHERE id = ${BOARD_CI}::uuid`
    await probe.$executeRaw`UPDATE boards SET key_prefix = 'CI' WHERE id = ${BOARD_OTHER_ORG}::uuid`
    await expect(
      probe.$executeRaw`UPDATE boards SET key_prefix = 'CI' WHERE id = ${BOARD_IMPL}::uuid`,
    ).rejects.toThrow(/23505.*Key \(organization_id, key_prefix\)=/s)
  })

  it('refuses a dependency on itself and removes dependencies with either idea', async () => {
    await expect(
      probe.$executeRaw`INSERT INTO idea_dependencies (blocked_idea_id, blocker_idea_id, created_at_utc)
        VALUES (${TASK}::uuid, ${TASK}::uuid, ${NOW}::timestamptz)`,
    ).rejects.toThrow(/ck_idea_dependencies_no_self/)

    await probe.$executeRaw`INSERT INTO idea_dependencies (blocked_idea_id, blocker_idea_id, created_at_utc)
      VALUES (${TASK_TWO}::uuid, ${TASK}::uuid, ${NOW}::timestamptz),
        (${TASK}::uuid, ${PARENT}::uuid, ${NOW}::timestamptz),
        (${TASK_TWO}::uuid, ${PARENT}::uuid, ${NOW}::timestamptz)`
    await probe.$executeRaw`DELETE FROM ideas WHERE id = ${TASK}::uuid`
    const left = await probe.$queryRaw<{ blocked: string; blocker: string }[]>`
      SELECT blocked_idea_id::text AS blocked, blocker_idea_id::text AS blocker FROM idea_dependencies`
    expect(left).toEqual([{ blocked: TASK_TWO, blocker: PARENT }])
  })
})
