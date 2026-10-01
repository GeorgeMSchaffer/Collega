// The rule 39 backfill in `20261001000000_add_idea_followers_and_inbox` (SPEC/20-feature-idea-
// following.md rules 36-39), run as written against a database that holds ideas from before it:
// the author and every current assignee of each idea that is not soft-deleted become followers,
// and nothing else does. The same file also adds the read-state columns, swaps the recipient index
// and adds the `IdeaEdited` value, which are checked on the same probe.
//
// The migration touches `ideas`, `users`, `idea_assignees` and `notification_events`, so the
// throwaway database holds only the columns it reads. The migration file itself is sent through
// `prisma db execute`, which is what `migrate deploy` would send. Skipped unless `DATABASE_URL` is
// set; the throwaway database is created beside it and dropped afterwards.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'

const DATABASE_URL = process.env.DATABASE_URL
const MIGRATION = fileURLToPath(
  new URL(
    '../prisma/migrations/20261001000000_add_idea_followers_and_inbox/migration.sql',
    import.meta.url,
  ),
)
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js')

const id = (n: number) => `20000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const [AUTHOR, ASSIGNEE, SECOND_ASSIGNEE, INACTIVE_AUTHOR, ORPHAN_AUTHOR_ID, OTHER] = [
  id(1),
  id(2),
  id(3),
  id(4),
  id(5),
  id(6),
] as const
const [
  PLAIN,
  ASSIGNED,
  AUTHOR_ASSIGNED_TO_SELF,
  DELETED,
  NO_AUTHOR_ROW,
  INACTIVE_AUTHORED,
  DELETED_ONLY_ASSIGNEE,
] = [id(101), id(102), id(103), id(104), id(105), id(106), id(107)] as const

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

describe.skipIf(!DATABASE_URL)('Idea followers migration and backfill', () => {
  const database = `collega_mig_probe_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const admin = new PrismaClient()
  let probe: PrismaClient
  let pairs: Set<string>
  let totalRows: number

  const pair = (ideaId: string, userId: string) => `${ideaId}|${userId}`

  beforeAll(async () => {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
    const url = withDatabase(DATABASE_URL as string, database)
    probe = new PrismaClient({ datasourceUrl: url })

    for (const statement of [
      `CREATE TYPE "NotificationEventType" AS ENUM ('IdeaMention', 'CommentMention', 'CommentAdded', 'IdeaStatusChanged', 'IdeaPromoted', 'IssueDeliveryStatusChanged', 'IssueTaskAssigned')`,
      'CREATE TABLE users (id UUID PRIMARY KEY, status TEXT NOT NULL)',
      'CREATE TABLE ideas (id UUID PRIMARY KEY, author_user_id UUID NOT NULL, is_deleted BOOLEAN NOT NULL)',
      'CREATE TABLE idea_assignees (idea_id UUID NOT NULL REFERENCES ideas (id), user_id UUID NOT NULL REFERENCES users (id))',
      `CREATE TABLE notification_events (
         id UUID PRIMARY KEY,
         event_type "NotificationEventType" NOT NULL,
         recipient_user_id UUID NOT NULL,
         occurred_at_utc TIMESTAMPTZ(6) NOT NULL)`,
      'CREATE INDEX ix_notification_events_recipient_user_id ON notification_events (recipient_user_id)',
    ]) {
      await probe.$executeRawUnsafe(statement)
    }

    await probe.$executeRaw`INSERT INTO users (id, status) VALUES
      (${AUTHOR}::uuid, 'Active'), (${ASSIGNEE}::uuid, 'Active'), (${SECOND_ASSIGNEE}::uuid, 'Active'),
      (${INACTIVE_AUTHOR}::uuid, 'Inactive'), (${OTHER}::uuid, 'Active')`
    // ORPHAN_AUTHOR_ID has no users row: `ideas.author_user_id` carries no foreign key.
    await probe.$executeRaw`INSERT INTO ideas (id, author_user_id, is_deleted) VALUES
      (${PLAIN}::uuid, ${AUTHOR}::uuid, FALSE),
      (${ASSIGNED}::uuid, ${AUTHOR}::uuid, FALSE),
      (${AUTHOR_ASSIGNED_TO_SELF}::uuid, ${AUTHOR}::uuid, FALSE),
      (${DELETED}::uuid, ${AUTHOR}::uuid, TRUE),
      (${NO_AUTHOR_ROW}::uuid, ${ORPHAN_AUTHOR_ID}::uuid, FALSE),
      (${INACTIVE_AUTHORED}::uuid, ${INACTIVE_AUTHOR}::uuid, FALSE),
      (${DELETED_ONLY_ASSIGNEE}::uuid, ${OTHER}::uuid, TRUE)`
    await probe.$executeRaw`INSERT INTO idea_assignees (idea_id, user_id) VALUES
      (${ASSIGNED}::uuid, ${ASSIGNEE}::uuid),
      (${ASSIGNED}::uuid, ${SECOND_ASSIGNEE}::uuid),
      (${AUTHOR_ASSIGNED_TO_SELF}::uuid, ${AUTHOR}::uuid),
      (${DELETED}::uuid, ${ASSIGNEE}::uuid),
      (${NO_AUTHOR_ROW}::uuid, ${ASSIGNEE}::uuid),
      (${DELETED_ONLY_ASSIGNEE}::uuid, ${ASSIGNEE}::uuid)`
    await probe.$executeRaw`INSERT INTO notification_events (id, event_type, recipient_user_id, occurred_at_utc) VALUES
      (${id(201)}::uuid, 'CommentAdded', ${AUTHOR}::uuid, '2026-09-01T00:00:00Z'),
      (${id(202)}::uuid, 'IdeaMention', ${ASSIGNEE}::uuid, '2026-09-02T00:00:00Z')`

    execFileSync(
      process.execPath,
      [PRISMA_CLI, 'db', 'execute', '--url', url, '--file', MIGRATION],
      { stdio: 'pipe' },
    )

    const read = await probe.$queryRaw<{ idea_id: string; user_id: string }[]>`
      SELECT f.idea_id::text AS idea_id, f.user_id::text AS user_id FROM idea_followers f`
    totalRows = read.length
    pairs = new Set(read.map((row) => pair(row.idea_id, row.user_id)))
  }, 60_000)

  afterAll(async () => {
    await probe?.$disconnect()
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`)
    await admin.$disconnect()
  })

  it('backfills exactly the author and assignee pairs of ideas that are not soft-deleted', () => {
    expect(pairs).toEqual(
      new Set([
        pair(PLAIN, AUTHOR),
        pair(ASSIGNED, AUTHOR),
        pair(ASSIGNED, ASSIGNEE),
        pair(ASSIGNED, SECOND_ASSIGNEE),
        pair(AUTHOR_ASSIGNED_TO_SELF, AUTHOR),
        pair(NO_AUTHOR_ROW, ASSIGNEE),
        pair(INACTIVE_AUTHORED, INACTIVE_AUTHOR),
      ]),
    )
  })

  it('writes one row per pair when someone is both author and assignee', () => {
    expect(totalRows).toBe(pairs.size)
  })

  it('makes nobody follow a soft-deleted idea, author or assignee', async () => {
    const rows = await probe.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM idea_followers f
      WHERE f.idea_id IN (${DELETED}::uuid, ${DELETED_ONLY_ASSIGNEE}::uuid)`
    expect(rows[0]?.n).toBe(0)
  })

  it('skips an author with no users row, but keeps that idea’s assignees', () => {
    expect(pairs.has(pair(NO_AUTHOR_ROW, ORPHAN_AUTHOR_ID))).toBe(false)
    expect(pairs.has(pair(NO_AUTHOR_ROW, ASSIGNEE))).toBe(true)
  })

  it('does not make an assignee follow ideas they are not assigned to', () => {
    expect(pairs.has(pair(PLAIN, ASSIGNEE))).toBe(false)
  })

  it('gives each row a distinct generated id and a creation time', async () => {
    const rows = await probe.$queryRaw<{ ids: number; stamped: number }[]>`
      SELECT COUNT(DISTINCT f.id)::int AS ids,
             COUNT(f.created_at_utc)::int AS stamped
      FROM idea_followers f`
    expect(rows[0]).toEqual({ ids: totalRows, stamped: totalRows })
  })

  it('leaves existing notifications unread with no status name', async () => {
    const rows = await probe.$queryRaw<{ read_at_utc: Date | null; status_name: string | null }[]>`
      SELECT n.read_at_utc, n.status_name FROM notification_events n`
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.read_at_utc === null && row.status_name === null)).toBe(true)
  })

  it('replaces the recipient-only index with the recipient and newest-first one', async () => {
    const rows = await probe.$queryRaw<{ indexname: string }[]>`
      SELECT i.indexname FROM pg_indexes i WHERE i.tablename = 'notification_events'`
    const names = rows.map((row) => row.indexname)
    expect(names).toContain('ix_notification_events_recipient_user_id_occurred_at_utc')
    expect(names).not.toContain('ix_notification_events_recipient_user_id')
  })

  it('adds IdeaEdited to the event type enum', async () => {
    const rows = await probe.$queryRaw<{ label: string }[]>`
      SELECT e.enumlabel AS label FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'NotificationEventType'`
    expect(rows.map((row) => row.label)).toContain('IdeaEdited')
  })

  it('enforces one row per (idea, person) after the backfill', async () => {
    await expect(
      probe.$executeRaw`INSERT INTO idea_followers (id, idea_id, user_id, created_at_utc)
        VALUES (${randomUUID()}::uuid, ${PLAIN}::uuid, ${AUTHOR}::uuid, now())`,
    ).rejects.toThrow()
  })
})
