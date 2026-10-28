// QA for pulling items onto a board (SPEC/20-feature-board-pull-in.md rules 9 to 18): every refusal,
// atomicity, the role matrix, placement, what an Issue keeps, audit shapes and the picker scope.
// In-memory ports, fixed clock and ids.

import { createBoard } from '@collega/domain/boards'
import { EffortLevel, IdeaPhase, Priority, Role } from '@collega/domain/enums'
import { createIdea, type Idea, promoteIdeaToIssue } from '@collega/domain/ideas'
import { createStatus } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { AutoCreateTaskPort } from '../../src/boards/index.js'
import type { SwimlaneInput } from '../../src/boards/models.js'
import type { BoardRepository, IdeaReassignment } from '../../src/boards/ports.js'
import type { CurrentUserContext } from '../../src/common/index.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../src/common/index.js'
import type { IdeaRepository } from '../../src/ideas/ports.js'
import type { StatusRepository } from '../../src/statuses/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  impersonating,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const S1 = 'status-1'
const S2 = 'status-2'
const S3 = 'status-3'
const OTHER_BOARD = 'other-board'
const TARGET = 'target-board'
const MEMBER_ID = 'user-1'
const ADMIN_ID = 'org-admin-1'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function status(statusId: string) {
  return createStatus({
    id: statusId,
    organizationId: ORG_A,
    name: statusId,
    color: '#123456',
    sortOrder: 1,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

function targetBoard() {
  return createBoard({
    id: TARGET,
    organizationId: ORG_A,
    name: 'Target',
    allowUserStatusUpdate: false,
    orderedLanes: [
      { statusId: S1, isFinal: false, referencesBoardId: null },
      { statusId: S2, isFinal: true, referencesBoardId: null },
    ],
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

function item(n: number, overrides: Partial<Idea> = {}): Idea {
  return {
    ...createIdea({
      id: id(n),
      organizationId: ORG_A,
      boardId: null,
      statusId: S2,
      title: `Item ${n}`,
      description: null,
      problem: 'p',
      proposedSolutions: ['s'],
      impactRationale: 'r',
      priority: Priority.Medium,
      ideaTypeId: 't',
      businessImpactId: 'i',
      dueDate: null,
      authorUserId: MEMBER_ID,
      assigneeUserIds: [],
      tagIds: [],
      mentionedUserIds: [],
      nowUtc: new Date(NOW.getTime() - n * 1000),
    }),
    ...overrides,
  }
}

function issue(n: number, overrides: Partial<Idea> = {}): Idea {
  const promoted = promoteIdeaToIssue(
    item(n, { boardId: OTHER_BOARD }),
    { effort: EffortLevel.High, sprintId: null, currentUpvoteCount: 7 },
    new Date('2026-09-01T00:00:00.000Z'),
    'promoter',
  )
  return { ...promoted, ...overrides }
}

function setup(
  user: CurrentUserContext,
  ideas: readonly Idea[] = [],
  archived = false,
  laneIdeas: { ideaId: string; title: string; statusId: string; effort: null }[] = [],
) {
  const order: string[] = []
  const added: unknown[] = []
  const saved: unknown[] = []
  const reassigned: IdeaReassignment[][] = []
  const moves: unknown[] = []
  const pickerFilters: unknown[] = []
  const uow = countingUnitOfWork()
  const audit = recordingAudit()
  const boards = {
    async add(b: unknown) {
      added.push(b)
    },
    async save(b: unknown) {
      saved.push(b)
    },
    async getById(boardId: string) {
      return boardId === TARGET ? { ...targetBoard(), isArchived: archived } : null
    },
    async listByOrganization() {
      return []
    },
    async countIdeasByBoardAndStatus() {
      return []
    },
    async listLaneIdeas(_b: string, statusIds: readonly string[]) {
      return laneIdeas.filter((l) => statusIds.includes(l.statusId))
    },
    async moveIdeas(...args: unknown[]) {
      order.push('moveIdeas')
      moves.push(args)
    },
    async reassignIdeas(_b: string, items: IdeaReassignment[]) {
      order.push('reassignIdeas')
      reassigned.push(items)
    },
    async listPullCandidates(filter: unknown) {
      pickerFilters.push(filter)
      return { items: [], page: 1, pageSize: 25, totalCount: 0 }
    },
    async visibleBoardIds() {
      return [TARGET, OTHER_BOARD]
    },
  } as unknown as BoardRepository
  const statuses = {
    async listByOrganization() {
      return [status(S1), status(S2), status(S3)]
    },
  } as unknown as StatusRepository
  const service = new BoardService(
    boards,
    statuses,
    {
      async existsById(orgId: string) {
        return orgId === ORG_A
      },
    },
    uow,
    audit,
    user,
    fixedClock(),
    {
      async getById(ideaId: string) {
        return ideas.find((i) => i.id === ideaId) ?? null
      },
    } as unknown as IdeaRepository,
    {} as AutoCreateTaskPort,
  )
  return { order, service, added, saved, reassigned, moves, pickerFilters, uow, audit }
}

const LANES: SwimlaneInput[] = [
  { statusId: S1, order: 0 },
  { statusId: S2, order: 1 },
]
const create = (s: BoardService, pullItemIds: string[], swimlanes = LANES) =>
  s.create(ORG_A, { name: 'New', allowUserStatusUpdate: false, swimlanes, pullItemIds })
const update = (s: BoardService, pullItemIds: string[], swimlanes = LANES) =>
  s.update(TARGET, { name: 'Target', allowUserStatusUpdate: false, swimlanes, pullItemIds })

async function pullMessages(promise: Promise<unknown>): Promise<readonly string[]> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError)
    return (error as ValidationError).failures.pullItemIds ?? []
  }
  throw new Error('expected the pull to be refused')
}

const meta = (e: { metadataJson?: string | null } | undefined) =>
  JSON.parse(e?.metadataJson ?? 'null') as Record<string, unknown> | null

function expectNothingSaved(h: ReturnType<typeof setup>) {
  expect(h.added).toHaveLength(0)
  expect(h.saved).toHaveLength(0)
  expect(h.reassigned).toHaveLength(0)
  expect(h.uow.saves).toBe(0)
  expect(h.audit.events).toHaveLength(0)
}

describe('pull refusals (rules 10 to 12) leave nothing behind', () => {
  it('refuses 101 ids and 100 is accepted', async () => {
    const ideas = Array.from({ length: 100 }, (_, n) => item(n + 1))
    const ok = setup(orgAdmin(), ideas)
    await create(
      ok.service,
      ideas.map((i) => i.id),
    )
    expect(ok.reassigned[0]).toHaveLength(100)

    const h = setup(orgAdmin(), ideas)
    const ids = [...ideas.map((i) => i.id), id(999)]
    expect(await pullMessages(create(h.service, ids))).toEqual([
      'At most 100 items can be pulled in one save.',
    ])
    expectNothingSaved(h)
  })

  it('refuses a malformed id', async () => {
    const h = setup(orgAdmin())
    expect(await pullMessages(create(h.service, ['not-a-uuid']))).toEqual([
      "'not-a-uuid' is not a valid item id.",
    ])
    expectNothingSaved(h)
  })

  it('refuses an id named twice, case-insensitively', async () => {
    const h = setup(orgAdmin(), [item(1)])
    const upper = id(1).toUpperCase()
    expect(await pullMessages(create(h.service, [id(1), upper]))).toEqual([
      'An item can be named only once.',
    ])
    expectNothingSaved(h)
  })

  it('refuses an item that does not exist', async () => {
    const h = setup(orgAdmin())
    expect(await pullMessages(create(h.service, [id(1)]))).toEqual([
      `Item '${id(1)}' was not found.`,
    ])
    expectNothingSaved(h)
  })

  it("refuses another organization's item as not found, not as forbidden", async () => {
    const h = setup(orgAdmin(), [item(1, { organizationId: ORG_B })])
    expect(await pullMessages(create(h.service, [id(1)]))).toEqual([
      `Item '${id(1)}' was not found.`,
    ])
    expectNothingSaved(h)
  })

  it('refuses a deleted item', async () => {
    const h = setup(orgAdmin(), [item(1, { isDeleted: true })])
    expect(await pullMessages(create(h.service, [id(1)]))).toEqual([
      "'Item 1' is no longer available.",
    ])
    expectNothingSaved(h)
  })

  it('refuses an Issue in a sprint, even for an Org Admin', async () => {
    const h = setup(orgAdmin(), [issue(1, { sprintId: 'sprint-1' })])
    expect(await pullMessages(create(h.service, [id(1)]))).toEqual([
      "'Item 1' is in a sprint, so it cannot be pulled. Move it back to the backlog first.",
    ])
    expectNothingSaved(h)
  })

  it('refuses an idea already on the edited board', async () => {
    const h = setup(orgAdmin(), [item(1, { boardId: TARGET })])
    expect(await pullMessages(update(h.service, [id(1)]))).toEqual([
      "'Item 1' is already on this board.",
    ])
    expectNothingSaved(h)
  })

  it('reports every problem at once and saves nothing when only one item is bad', async () => {
    const h = setup(orgAdmin(), [item(1), item(2, { isDeleted: true })])
    expect(await pullMessages(create(h.service, [id(1), id(2), id(3)]))).toEqual([
      "'Item 2' is no longer available.",
      `Item '${id(3)}' was not found.`,
    ])
    expectNothingSaved(h)
  })

  it('refuses an edit that names items on an archived board before touching anything', async () => {
    const h = setup(orgAdmin(), [item(1)], true)
    await expect(update(h.service, [id(1)])).rejects.toBeInstanceOf(ConflictError)
    expectNothingSaved(h)
  })
})

describe('who may pull (rule 11)', () => {
  const own = item(1)
  const others = item(2, { authorUserId: 'someone-else' })

  it("lets an Org Admin pull anyone's Discovery idea and a backlog Issue", async () => {
    const h = setup(orgAdmin(), [others, issue(3)])
    const created = await create(h.service, [id(2), id(3)])
    expect(created.pulledItems?.map((p) => p.ideaId).sort()).toEqual([id(2), id(3)])
  })

  it('lets a User pull their own idea from the pool or from another board', async () => {
    const h = setup(member(), [own, item(4, { boardId: OTHER_BOARD })])
    const created = await create(h.service, [id(1), id(4)])
    expect(created.pulledItems).toHaveLength(2)
  })

  it("refuses a User someone else's idea and names it, with the User's own idea named too saving nothing", async () => {
    const h = setup(member(), [own, others])
    expect(await pullMessages(create(h.service, [id(1), id(2)]))).toEqual([
      "You can pull only ideas you created; 'Item 2' was created by someone else.",
    ])
    expectNothingSaved(h)
  })

  it('refuses a User a backlog Issue even when they authored it', async () => {
    const h = setup(member(), [issue(5, { authorUserId: MEMBER_ID })])
    expect(await pullMessages(create(h.service, [id(5)]))).toEqual([
      "'Item 5' is an issue, and only an Org Admin can pull issues.",
    ])
    expectNothingSaved(h)
  })

  it('refuses a Read Only user at the door, with nothing saved', async () => {
    const h = setup(readOnly(), [own])
    await expect(create(h.service, [id(1)])).rejects.toBeInstanceOf(ForbiddenError)
    expectNothingSaved(h)
  })

  it('refuses a Site Admin acting as themselves', async () => {
    const h = setup(siteAdmin(), [own])
    await expect(create(h.service, [id(1)])).rejects.toBeInstanceOf(ForbiddenError)
    expectNothingSaved(h)
  })

  it('lets a Site Admin viewing as an Org Admin pull, with the audit on behalf of the target', async () => {
    const viewAs = impersonating({
      targetUserId: ADMIN_ID,
      targetRole: Role.OrgAdmin,
      targetOrganizationId: ORG_A,
      realUserId: 'site-admin-9',
    })
    const h = setup(viewAs, [others])
    await create(h.service, [id(2)])
    const events = h.audit.events.filter((e) => e.eventType === 'IdeaBoardChanged')
    expect(events).toHaveLength(1)
    expect(events[0]?.attribution).toMatchObject({ actorUserId: 'site-admin-9' })
    expect(JSON.stringify(events[0]?.attribution)).toContain(ADMIN_ID)
  })

  it('refuses a User editing a board at all (edits are Org Admin only)', async () => {
    const h = setup(member(), [own])
    await expect(update(h.service, [id(1)])).rejects.toBeInstanceOf(ForbiddenError)
    expectNothingSaved(h)
  })

  it('answers 404 when an Org Admin of another organization creates a board in this one', async () => {
    const h = setup(orgAdmin(ORG_B), [own])
    await expect(create(h.service, [id(1)])).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('placement (rule 13)', () => {
  it('keeps the status when the board has a lane for it', async () => {
    const h = setup(orgAdmin(), [item(1, { statusId: S2 })])
    const created = await create(h.service, [id(1)])
    expect(created.pulledItems).toEqual([{ ideaId: id(1), fromBoardId: null, statusId: S2 }])
    expect(h.reassigned[0]?.[0]?.toStatusId).toBe(S2)
  })

  it('lands in the leftmost lane when the board has no lane for the status', async () => {
    const h = setup(orgAdmin(), [item(1, { statusId: S3 })])
    const created = await create(h.service, [id(1)])
    expect(created.pulledItems?.[0]?.statusId).toBe(S1)
  })

  it('judges leftmost by display order, not by the order lanes are listed', async () => {
    const h = setup(orgAdmin(), [item(1, { statusId: S3 })])
    const created = await create(
      h.service,
      [id(1)],
      [
        { statusId: S2, order: 1 },
        { statusId: S1, order: 0 },
      ],
    )
    expect(created.pulledItems?.[0]?.statusId).toBe(S1)
  })

  it('places against the lanes the same save leaves: a status whose lane is being removed is not kept', async () => {
    const h = setup(orgAdmin(), [item(1, { statusId: S2 })])
    const updated = await update(
      h.service,
      [id(1)],
      [
        { statusId: S1, order: 0 },
        { statusId: S3, order: 1 },
      ],
    )
    expect(updated.pulledItems?.[0]?.statusId).toBe(S1)
  })

  it('reports the previous board as fromBoardId', async () => {
    const h = setup(orgAdmin(), [item(1, { boardId: OTHER_BOARD })])
    const created = await create(h.service, [id(1)])
    expect(created.pulledItems?.[0]?.fromBoardId).toBe(OTHER_BOARD)
  })

  it('breaks a creation-time tie by id', async () => {
    const same = new Date(NOW.getTime() - 5000)
    const h = setup(orgAdmin(), [
      item(2, { createdAtUtc: same }),
      item(1, { createdAtUtc: same }),
      item(3, { createdAtUtc: same }),
    ])
    await create(h.service, [id(3), id(2), id(1)])
    expect(h.reassigned[0]?.map((r) => r.ideaId)).toEqual([id(1), id(2), id(3)])
  })

  it('stages items oldest first', async () => {
    // item(n) is created n seconds before NOW, so a higher n is older.
    const h = setup(orgAdmin(), [item(1), item(2), item(3)])
    await create(h.service, [id(1), id(2), id(3)])
    expect(h.reassigned[0]?.map((r) => r.ideaId)).toEqual([id(3), id(2), id(1)])
  })
})

describe('a pull in the same save as a lane removal (rule 9)', () => {
  it('applies the ideaMoves before the pull stages its items', async () => {
    const h = setup(orgAdmin(), [item(1, { statusId: S1 })], false, [
      { ideaId: 'resident', title: 'Resident', statusId: S2, effort: null },
    ])
    await h.service.update(TARGET, {
      name: 'Target',
      allowUserStatusUpdate: false,
      swimlanes: [
        { statusId: S1, order: 0 },
        { statusId: S3, order: 1 },
      ],
      ideaMoves: [{ fromStatusId: S2, toStatusId: S3 }],
      pullItemIds: [id(1)],
    })
    expect(h.order).toEqual(['moveIdeas', 'reassignIdeas'])
  })
})

describe('a returned Issue (rule 14)', () => {
  it('is staged as returning to Discovery and keeps effort and the promotion snapshot', async () => {
    const before = issue(1)
    const h = setup(orgAdmin(), [before])
    await create(h.service, [id(1)])

    const staged = h.reassigned[0]?.[0]
    expect(staged?.returnsToDiscovery).toBe(true)
    expect(staged?.from.phase).toBe(IdeaPhase.Delivery)
    // The reassignment names no effort or snapshot column, so the repository cannot touch them.
    expect(Object.keys(staged ?? {}).sort()).toEqual(
      ['from', 'ideaId', 'returnsToDiscovery', 'title', 'toStatusId'].sort(),
    )
    expect(before.effort).toBe(EffortLevel.High)
    expect(before.upvoteCountAtPromotion).toBe(7)
  })

  it('does not refuse an Issue whose current board is archived', async () => {
    const h = setup(orgAdmin(), [issue(1, { boardId: 'archived-board' })])
    await expect(create(h.service, [id(1)])).resolves.toBeDefined()
  })
})

describe('audit and side effects (rules 15 and 18)', () => {
  it('writes the board entry with counts first, then per item entries', async () => {
    const h = setup(orgAdmin(), [
      item(1, { statusId: S3, boardId: OTHER_BOARD }),
      issue(2, { statusId: S1 }),
    ])
    await create(h.service, [id(1), id(2)])

    const types = h.audit.events.map((e) => e.eventType)
    expect(types[0]).toBe('BoardCreated')
    expect(meta(h.audit.events[0])).toMatchObject({ pulledItemCount: 2, returnedIssueCount: 1 })

    const boardChanged = h.audit.events.filter((e) => e.eventType === 'IdeaBoardChanged')
    expect(boardChanged.map((e) => [e.entityId, meta(e)])).toEqual([
      [id(2), { fromBoardId: OTHER_BOARD, toBoardId: expect.any(String) }],
      [id(1), { fromBoardId: OTHER_BOARD, toBoardId: expect.any(String) }],
    ])
    expect(types.filter((t) => t === 'IdeaBoardChanged')).toHaveLength(2)

    const statusChanged = h.audit.events.filter((e) => e.eventType === 'IdeaStatusChanged')
    expect(statusChanged).toHaveLength(1)
    expect(statusChanged[0]?.entityId).toBe(id(1))
    expect(meta(statusChanged[0])).toEqual({ fromStatusId: S3, toStatusId: S1 })

    const returned = h.audit.events.filter((e) => e.eventType === 'IssueReturnedToDiscovery')
    expect(returned.map((e) => e.entityId)).toEqual([id(2)])
  })

  it('writes IdeaBoardChanged with a null fromBoardId for a pool idea', async () => {
    const h = setup(orgAdmin(), [item(1)])
    await create(h.service, [id(1)])
    const event = h.audit.events.find((e) => e.eventType === 'IdeaBoardChanged')
    expect(meta(event)).toMatchObject({ fromBoardId: null })
  })

  it('writes no IdeaStatusChanged when the status is kept', async () => {
    const h = setup(orgAdmin(), [item(1, { statusId: S2 })])
    await create(h.service, [id(1)])
    expect(h.audit.events.map((e) => e.eventType)).not.toContain('IdeaStatusChanged')
  })

  it('adds no pull counts when nothing is pulled', async () => {
    const h = setup(orgAdmin())
    await create(h.service, [])
    expect(meta(h.audit.events[0])).not.toHaveProperty('pulledItemCount')
  })

  it('commits once, and the board edit audit carries the counts', async () => {
    const h = setup(orgAdmin(), [item(1)])
    await update(h.service, [id(1)])
    expect(h.uow.saves).toBe(1)
    expect(h.audit.events[0]?.eventType).toBe('BoardUpdated')
    expect(meta(h.audit.events[0])).toMatchObject({ pulledItemCount: 1, returnedIssueCount: 0 })
  })

  it('sends no notification: the service has no notification port and writes no notification audit', async () => {
    const h = setup(orgAdmin(), [item(1)])
    await create(h.service, [id(1)])
    expect(h.audit.events.map((e) => e.eventType).filter((t) => /notif/i.test(t))).toEqual([])
  })
})

describe('listPullCandidates scope (rules 9 and 11)', () => {
  const query = (source: string | null, authorUserId: string | null = null) => ({
    source,
    excludeBoardId: null,
    search: null,
    tags: ['  Red ', 'red', ''],
    authorUserId,
    page: null,
    pageSize: null,
  })

  it('forces a User to their own ideas whatever author was asked', async () => {
    const h = setup(member())
    await h.service.listPullCandidates(ORG_A, query('unassigned', 'someone-else'))
    expect(h.pickerFilters[0]).toMatchObject({ authorUserId: MEMBER_ID, currentUserId: MEMBER_ID })
  })

  it('lets an Org Admin filter by any author, or none', async () => {
    const h = setup(orgAdmin())
    await h.service.listPullCandidates(ORG_A, query('boards', 'someone-else'))
    await h.service.listPullCandidates(ORG_A, query('boards'))
    expect(h.pickerFilters).toMatchObject([
      { authorUserId: 'someone-else' },
      { authorUserId: null },
    ])
  })

  it('refuses the backlog tab to a User and allows it to an Org Admin', async () => {
    await expect(
      setup(member()).service.listPullCandidates(ORG_A, query('backlog')),
    ).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      setup(orgAdmin()).service.listPullCandidates(ORG_A, query('backlog')),
    ).resolves.toBeDefined()
  })

  it.each([
    ['Read Only', readOnly()],
    ['a direct Site Admin', siteAdmin()],
  ])('refuses %s', async (_label, user) => {
    await expect(
      setup(user).service.listPullCandidates(ORG_A, query('unassigned')),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('answers not found for another organization', async () => {
    await expect(
      setup(orgAdmin()).service.listPullCandidates(ORG_B, query('unassigned')),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it.each([[null], ['everything'], ['']])(
    'rejects source %j as a 400 on source',
    async (source) => {
      await expect(
        setup(orgAdmin()).service.listPullCandidates(ORG_A, query(source)),
      ).rejects.toMatchObject({
        failures: { source: expect.any(Array) },
      })
    },
  )

  it('normalizes and de-duplicates the tag filter', async () => {
    const h = setup(orgAdmin())
    await h.service.listPullCandidates(ORG_A, query('unassigned'))
    expect(h.pickerFilters[0]).toMatchObject({ tags: ['red'] })
  })
})
