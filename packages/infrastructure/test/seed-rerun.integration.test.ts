// The demo seed re-runs cleanly after a board's lanes were saved (the Bug Triage item slice 106
// closed): saving lanes rewrites `board_swimlanes` under fresh ids, and a seed that upserted by its
// own derived id then tried to insert a second row for the same (board, status) and failed with
// P2002 on `ux_board_swimlanes_board_id_status_id`.
//
// Skipped unless `DATABASE_URL` is set; needs the demo seed already applied. It edits one seeded
// board's lanes the way a save does - same statuses, same order, fresh ids - so nothing another
// suite reads changes. Point `DATABASE_URL` at a scratch database: it rewrites seeded lane ids
// permanently.

import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { runDemoSeed } from '../src/demo-seed/index.js'
import { DEMO_ORGANIZATIONS, seedId } from '../src/demo-seed/modules/scenario.js'
import { PrismaClient } from '../src/generated/prisma/index.js'

const DATABASE_URL = process.env.DATABASE_URL

describe.skipIf(!DATABASE_URL)('Demo seed re-run against a live database', () => {
  const prisma = new PrismaClient()

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('succeeds after a seeded board has had its lanes saved under fresh ids', async () => {
    const scenario = DEMO_ORGANIZATIONS[0]
    if (!scenario) throw new Error('No demo organization in the scenario.')
    const board = await prisma.boards.findFirst({
      where: { organization_id: seedId('organization', scenario.slug) },
      select: {
        id: true,
        board_swimlanes: {
          select: { status_id: true, display_order: true },
          orderBy: { display_order: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
    if (!board || board.board_swimlanes.length === 0) {
      throw new Error('Fixture requires the demo seed, with lanes on its boards.')
    }

    const lanes = board.board_swimlanes
    const freshIds = lanes.map(() => randomUUID())
    await prisma.$transaction([
      prisma.board_swimlanes.deleteMany({ where: { board_id: board.id } }),
      prisma.board_swimlanes.createMany({
        data: lanes.map((lane, i) => ({
          id: freshIds[i] as string,
          board_id: board.id,
          status_id: lane.status_id,
          display_order: lane.display_order,
        })),
      }),
    ])

    await expect(runDemoSeed(prisma)).resolves.toBeDefined()
    await expect(runDemoSeed(prisma)).resolves.toBeDefined()

    const after = await prisma.board_swimlanes.findMany({
      where: { board_id: board.id },
      select: { id: true, status_id: true, display_order: true },
      orderBy: { display_order: 'asc' },
    })
    expect(after.map((lane) => lane.id)).toEqual(freshIds)
    expect(after.map(({ status_id, display_order }) => ({ status_id, display_order }))).toEqual(
      lanes,
    )
  }, 60_000)

  it('rebuilds the same idea followers from nothing, equal to each idea’s author and assignees', async () => {
    const organizationIds = DEMO_ORGANIZATIONS.map((org) => seedId('organization', org.slug))
    const read = () =>
      prisma.$queryRaw<{ follower_id: string; idea_id: string; user_id: string }[]>`
        SELECT f.id::text AS follower_id, f.idea_id::text AS idea_id, f.user_id::text AS user_id
        FROM idea_followers f
        JOIN ideas i ON i.id = f.idea_id
        WHERE i.organization_id = ANY(${organizationIds}::uuid[])
        ORDER BY f.id`

    const before = await read()
    // Cleared first, so what is compared is what the seed itself makes, not rows an earlier seed left.
    await prisma.$executeRaw`
      DELETE FROM idea_followers f USING ideas i
      WHERE i.id = f.idea_id AND i.organization_id = ANY(${organizationIds}::uuid[])`
    expect(await read()).toEqual([])
    await runDemoSeed(prisma)
    const after = await read()

    expect(after).toEqual(before)
    expect(before.length).toBeGreaterThan(0)

    // The same pairs the migration's backfill would have made for these ideas.
    const expected = await prisma.$queryRaw<{ idea_id: string; user_id: string }[]>`
      SELECT i.id::text AS idea_id, i.author_user_id::text AS user_id
      FROM ideas i
      WHERE i.organization_id = ANY(${organizationIds}::uuid[]) AND i.is_deleted = FALSE
      UNION
      SELECT ia.idea_id::text, ia.user_id::text
      FROM idea_assignees ia
      JOIN ideas i ON i.id = ia.idea_id
      WHERE i.organization_id = ANY(${organizationIds}::uuid[]) AND i.is_deleted = FALSE`
    const live = await prisma.$queryRaw<{ idea_id: string }[]>`
      SELECT i.id::text AS idea_id FROM ideas i
      WHERE i.organization_id = ANY(${organizationIds}::uuid[]) AND i.is_deleted = FALSE`
    const liveIds = new Set(live.map((row) => row.idea_id))
    const key = (row: { idea_id: string; user_id: string }) => `${row.idea_id}|${row.user_id}`
    expect(new Set(after.filter((row) => liveIds.has(row.idea_id)).map(key))).toEqual(
      new Set(expected.map(key)),
    )
  }, 60_000)
})
