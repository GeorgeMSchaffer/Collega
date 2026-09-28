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
})
