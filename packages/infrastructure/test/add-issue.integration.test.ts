// An Issue added directly (SPEC/contracts/delivery.md `POST /organizations/{organizationId}/issues`)
// against a live Postgres: IdeaService stages one idea row that is already a Delivery-phase,
// board-less idea, plus the author's follow row, and commits them with ONE unit-of-work flush. What
// only a database shows: the row lands with every promotion column set and no board, and a flush
// that fails on the sprint foreign key leaves nothing behind - no idea row, no follower row - so
// the "never a stray Discovery idea" guarantee holds at the storage layer too.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards;
// run it only against a disposable database.

import { randomUUID } from 'node:crypto'
import {
  DeliveryStatus,
  EffortLevel,
  IdeaPhase,
  Priority,
  SprintState,
} from '@collega/domain/enums'
import { createIdeaFollower } from '@collega/domain/followers'
import { createIdea, promoteIdeaToIssue } from '@collega/domain/ideas'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'
import { PrismaIdeaFollowerRepository } from '../src/repositories/idea-follower.repository.js'
import { type ProbeOrg, probeOrg } from './support/following-probe.js'

const DATABASE_URL = process.env.DATABASE_URL
const T0 = new Date('2026-10-15T10:00:00.000Z')

describe.skipIf(!DATABASE_URL)('An Issue added directly, against a live database', () => {
  const prisma = new PrismaClient()
  let org: ProbeOrg
  let author: string
  let sprintId: string

  /** What IdeaService.addIssue stages: a board-less idea, promoted before `add`, plus its follower. */
  async function stageIssue(options: { sprintId: string | null }) {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
    const followers = new PrismaIdeaFollowerRepository(prisma, unitOfWork)
    const created = createIdea({
      id: randomUUID(),
      organizationId: org.organizationId,
      boardId: null,
      statusId: org.statusId,
      title: 'Added straight to the backlog',
      description: null,
      problem: 'A problem.',
      proposedSolutions: ['A solution.'],
      impactRationale: 'A rationale.',
      priority: Priority.Medium,
      ideaTypeId: org.ideaTypeId,
      businessImpactId: org.impactId,
      dueDate: null,
      authorUserId: author,
      assigneeUserIds: [],
      tagIds: [],
      mentionedUserIds: [],
      nowUtc: T0,
    })
    const issue = promoteIdeaToIssue(
      created,
      { effort: EffortLevel.High, sprintId: options.sprintId, currentUpvoteCount: 0 },
      T0,
      author,
    )
    await ideas.add(issue)
    await followers.add([
      createIdeaFollower({ id: randomUUID(), ideaId: issue.id, userId: author, nowUtc: T0 }),
    ])
    return { issue, unitOfWork, ideas }
  }

  beforeAll(async () => {
    org = probeOrg(prisma)
    await org.setUp()
    author = await org.newUser('author')
    sprintId = randomUUID()
    await prisma.sprints.create({
      data: {
        id: sprintId,
        organization_id: org.organizationId,
        name: 'Probe sprint',
        start_date: new Date('2026-10-01'),
        end_date: new Date('2026-10-14'),
        state: SprintState.Planned,
        is_deleted: false,
        created_at_utc: T0,
        updated_at_utc: T0,
      },
    })
  })

  afterAll(async () => {
    await prisma.ideas.deleteMany({ where: { organization_id: org.organizationId } })
    await prisma.sprints.deleteMany({ where: { organization_id: org.organizationId } })
    await org.remove()
    await prisma.$disconnect()
  })

  it('persists a board-less Delivery-phase idea with every promotion column set, in one flush', async () => {
    const { issue, unitOfWork, ideas } = await stageIssue({ sprintId })
    expect(await prisma.ideas.count({ where: { id: issue.id } })).toBe(0)

    await unitOfWork.saveChanges()

    expect(
      await prisma.ideas.findUniqueOrThrow({
        where: { id: issue.id },
        select: {
          board_id: true,
          phase: true,
          delivery_status: true,
          effort: true,
          sprint_id: true,
          promoted_at_utc: true,
          promoted_by_user_id: true,
          upvote_count_at_promotion: true,
        },
      }),
    ).toEqual({
      board_id: null,
      phase: IdeaPhase.Delivery,
      delivery_status: DeliveryStatus.Pending,
      effort: EffortLevel.High,
      sprint_id: sprintId,
      promoted_at_utc: T0,
      promoted_by_user_id: author,
      upvote_count_at_promotion: 0,
    })
    expect(
      await prisma.idea_followers.count({ where: { idea_id: issue.id, user_id: author } }),
    ).toBe(1)
    const readBack = await ideas.getById(issue.id)
    expect(readBack).toMatchObject({ boardId: null, phase: IdeaPhase.Delivery, sprintId })
  })

  it('stores a backlog Issue with no sprint', async () => {
    const { issue, unitOfWork } = await stageIssue({ sprintId: null })

    await unitOfWork.saveChanges()

    const row = await prisma.ideas.findUniqueOrThrow({
      where: { id: issue.id },
      select: { sprint_id: true, phase: true },
    })
    expect(row).toEqual({ sprint_id: null, phase: IdeaPhase.Delivery })
  })

  it('leaves no idea row and no follower row when the sprint assignment fails', async () => {
    const { issue, unitOfWork } = await stageIssue({ sprintId: randomUUID() })

    await expect(unitOfWork.saveChanges()).rejects.toThrow()

    expect(await prisma.ideas.count({ where: { id: issue.id } })).toBe(0)
    expect(await prisma.idea_followers.count({ where: { idea_id: issue.id } })).toBe(0)
  })

  it('rolls an earlier staged create back when a later staged sprint assignment fails', async () => {
    // The two-step shape (create in Discovery, then promote into a sprint) is what the single
    // unit of work exists to rule out; this pins the rollback that makes it safe either way.
    const { issue, unitOfWork, ideas } = await stageIssue({ sprintId: null })
    await ideas.update({ ...issue, sprintId: randomUUID() })

    await expect(unitOfWork.saveChanges()).rejects.toThrow()

    expect(await prisma.ideas.count({ where: { id: issue.id } })).toBe(0)
  })
})
