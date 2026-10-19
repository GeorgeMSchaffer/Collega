// Live-database QA for `itemKey` on the Outcome idea reads (SPEC/contracts/outcomes.md, owner
// decision 2026-10-19; slice 284): `<board keyPrefix>-<itemNumber>` on the grouped read and the
// ungrouped read, and `null` when the board has no prefix, the item has no number, or there is no
// board. The key is built in SQL, so only a real Postgres can say whether it means what it reads as.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaOutcomeRepository } from '../src/repositories/outcome.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const AT = new Date('2026-10-15T09:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Outcome itemKey against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const orgId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const statusId = randomUUID()
  const prefixedBoard = randomUUID()
  const plainBoard = randomUUID()
  const outcomeId = randomUUID()
  const stamps = { created_at_utc: AT, updated_at_utc: AT }
  const ids = {
    keyed: randomUUID(),
    keyedTwoDigits: randomUUID(),
    noNumber: randomUUID(),
    noPrefix: randomUUID(),
    noBoard: randomUUID(),
    freeKeyed: randomUUID(),
    freeNoNumber: randomUUID(),
    freeNoPrefix: randomUUID(),
    freeNoBoard: randomUUID(),
  }

  async function newIdea(
    id: string,
    board: string | null,
    itemNumber: number | null,
    grouped: boolean,
  ): Promise<void> {
    await prisma.ideas.create({
      data: {
        id,
        organization_id: orgId,
        board_id: board,
        item_number: itemNumber,
        outcome_id: grouped ? outcomeId : null,
        status_id: statusId,
        title: `Probe ${id.slice(0, 8)}`,
        problem: 'Probe problem.',
        proposed_solutions: ['Probe solution.'],
        impact_rationale: 'Probe rationale.',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: false,
        phase: 'Discovery',
        ...stamps,
      },
    })
  }

  const repo = () => new PrismaOutcomeRepository(prisma, new PrismaUnitOfWork(prisma))

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: orgId,
        title: `probe-org-${marker}`,
        description: 'Outcome itemKey probe.',
        invite_code: `probe-${marker}`,
        is_archived: false,
        ...stamps,
      },
    })
    await prisma.users.create({
      data: {
        id: adminId,
        organization_id: orgId,
        first_name: 'Probe',
        last_name: 'Admin',
        email: `probe-admin-${marker}@example.test`,
        normalized_email: `PROBE-ADMIN-${marker}@EXAMPLE.TEST`,
        password_hash: 'not-a-real-hash',
        role: 'OrgAdmin',
        status: 'Active',
        must_change_password: false,
        failed_login_count: 0,
        security_stamp: marker,
        ...stamps,
      },
    })
    await prisma.statuses.create({
      data: {
        id: statusId,
        organization_id: orgId,
        name: 'Open',
        color: '#123456',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    await prisma.idea_types.create({
      data: {
        id: ideaTypeId,
        organization_id: orgId,
        name: 'Probe type',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    await prisma.business_impacts.create({
      data: {
        id: impactId,
        organization_id: orgId,
        name: 'Probe impact',
        color: '#123456',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    for (const [id, keyPrefix] of [
      [prefixedBoard, 'PRJ'],
      [plainBoard, null],
    ] as const) {
      await prisma.boards.create({
        data: {
          id,
          organization_id: orgId,
          name: `Board ${id.slice(0, 8)}`,
          key_prefix: keyPrefix,
          allow_user_status_update: true,
          ...stamps,
          board_swimlanes: {
            create: [{ id: randomUUID(), status_id: statusId, display_order: 0, is_final: false }],
          },
        },
      })
    }
    await prisma.outcomes.create({
      data: {
        id: outcomeId,
        organization_id: orgId,
        name: 'Probe outcome',
        target_start_date: new Date('2026-10-01T00:00:00.000Z'),
        target_end_date: new Date('2026-12-31T00:00:00.000Z'),
        sort_order: 0,
        color: '#112233',
        is_deleted: false,
        ...stamps,
      },
    })
    await newIdea(ids.keyed, prefixedBoard, 7, true)
    await newIdea(ids.keyedTwoDigits, prefixedBoard, 12, true)
    await newIdea(ids.noNumber, prefixedBoard, null, true)
    await newIdea(ids.noPrefix, plainBoard, 3, true)
    await newIdea(ids.noBoard, null, null, true)
    await newIdea(ids.freeKeyed, prefixedBoard, 21, false)
    await newIdea(ids.freeNoNumber, prefixedBoard, null, false)
    await newIdea(ids.freeNoPrefix, plainBoard, 4, false)
    await newIdea(ids.freeNoBoard, null, null, false)
  })

  afterAll(async () => {
    const mine = { organization_id: orgId }
    await prisma.ideas.deleteMany({ where: mine })
    await prisma.outcomes.deleteMany({ where: mine })
    await prisma.board_swimlanes.deleteMany({ where: { boards: mine } })
    await prisma.boards.deleteMany({ where: mine })
    await prisma.idea_types.deleteMany({ where: mine })
    await prisma.business_impacts.deleteMany({ where: mine })
    await prisma.statuses.deleteMany({ where: mine })
    await prisma.users.deleteMany({ where: mine })
    await prisma.organizations.deleteMany({ where: { id: orgId } })
    await prisma.$disconnect()
  })

  it('builds <keyPrefix>-<itemNumber> on a grouped item, unpadded', async () => {
    const grouped = (await repo().ideasByOutcomeIds([outcomeId])).get(outcomeId) ?? []
    const keyOf = (id: string) => grouped.find((i) => i.ideaId === id)?.itemKey

    expect(keyOf(ids.keyed)).toBe('PRJ-7')
    expect(keyOf(ids.keyedTwoDigits)).toBe('PRJ-12')
  })

  it('is null on a grouped item whose board has no prefix, with no number, or on no board', async () => {
    const grouped = (await repo().ideasByOutcomeIds([outcomeId])).get(outcomeId) ?? []
    const keyOf = (id: string) => grouped.find((i) => i.ideaId === id)?.itemKey

    expect(keyOf(ids.noNumber)).toBeNull()
    expect(keyOf(ids.noPrefix)).toBeNull()
    expect(keyOf(ids.noBoard)).toBeNull()
  })

  it('answers every grouped item with an itemKey field, never undefined', async () => {
    const grouped = (await repo().ideasByOutcomeIds([outcomeId])).get(outcomeId) ?? []

    expect(grouped).toHaveLength(5)
    for (const item of grouped) {
      expect(item.itemKey === null || typeof item.itemKey === 'string').toBe(true)
    }
  })

  it('does the same on the ungrouped list: a real key, and null in the three null cases', async () => {
    const ungrouped = await repo().listUngroupedIdeas(orgId)
    const keyOf = (id: string) => ungrouped.find((i) => i.ideaId === id)?.itemKey

    expect(ungrouped).toHaveLength(4)
    expect(keyOf(ids.freeKeyed)).toBe('PRJ-21')
    expect(keyOf(ids.freeNoNumber)).toBeNull()
    expect(keyOf(ids.freeNoPrefix)).toBeNull()
    expect(keyOf(ids.freeNoBoard)).toBeNull()
  })
})
