// Board References, lane and flag rules (SPEC/contracts/boards.md "Board References"): the
// cross-board checks BoardService makes against the organization's stored boards.

import { type Board, createBoard } from '@collega/domain/boards'
import { EffortLevel, Priority } from '@collega/domain/enums'
import { createIdea, type Idea } from '@collega/domain/ideas'
import { createStatus, type Status } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { SwimlaneInput } from '../../src/boards/models.js'
import type { BoardRepository, BoardStatusIdeaCount } from '../../src/boards/ports.js'
import { ConflictError, UnprocessableError, ValidationError } from '../../src/common/index.js'
import type { IdeaRepository } from '../../src/ideas/ports.js'
import type { StatusRepository } from '../../src/statuses/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  recordingAudit,
} from '../support/fixtures.js'

const S1 = 'status-1'
const S2 = 'status-2'

function status(id: string): Status {
  return createStatus({
    id,
    organizationId: ORG_A,
    name: id,
    color: '#123456',
    sortOrder: 1,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

function board(
  id: string,
  extra: {
    organizationId?: string
    referencesBoardId?: string | null
    keyPrefix?: string
    nextItemNumber?: number
  } = {},
): Board {
  const created = createBoard({
    id,
    organizationId: extra.organizationId ?? ORG_A,
    name: id,
    allowUserStatusUpdate: false,
    orderedLanes: [
      { statusId: S1, isFinal: false, referencesBoardId: extra.referencesBoardId ?? null },
      { statusId: S2, isFinal: true, referencesBoardId: null },
    ],
    keyPrefix: extra.keyPrefix,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
  return { ...created, nextItemNumber: extra.nextItemNumber ?? 1 }
}

const LANES: SwimlaneInput[] = [
  { statusId: S1, order: 0 },
  { statusId: S2, order: 1 },
]

function lanesReferencing(boardId: string | null): SwimlaneInput[] {
  return [
    { statusId: S1, order: 0, referencesBoardId: boardId },
    { statusId: S2, order: 1 },
  ]
}

function harness(
  boards: readonly Board[],
  statusCounts: readonly BoardStatusIdeaCount[] = [],
  laneIdeas: readonly {
    ideaId: string
    title: string
    statusId: string
    effort: EffortLevel | null
  }[] = [],
  ideas: readonly Idea[] = [],
) {
  const byId = new Map(boards.map((b) => [b.id, b]))
  const saved: Board[] = []
  const added: Board[] = []
  const moved: unknown[] = []
  const repository = {
    async add(b: Board) {
      added.push(b)
    },
    async save(b: Board) {
      saved.push(b)
    },
    async getById(id: string) {
      return byId.get(id) ?? null
    },
    async listByOrganization(organizationId: string) {
      return [...byId.values()].filter((b) => b.organizationId === organizationId)
    },
    async countIdeasByBoardAndStatus() {
      return statusCounts
    },
    async listLaneIdeas(_boardId: string, statusIds: readonly string[]) {
      return laneIdeas.filter((idea) => statusIds.includes(idea.statusId))
    },
    async moveIdeas() {},
    async reassignIdeas(_boardId: string, items: readonly unknown[]) {
      moved.push(...items)
    },
  } as unknown as BoardRepository
  const allStatuses = [status(S1), status(S2), status('status-3')]
  const statuses = {
    async listByOrganization() {
      return allStatuses
    },
  } as unknown as StatusRepository
  const service = new BoardService(
    repository,
    statuses,
    {
      async existsById() {
        return true
      },
    },
    countingUnitOfWork(),
    recordingAudit(),
    orgAdmin(ORG_A),
    fixedClock(),
    {
      async getById(id: string) {
        return ideas.find((i) => i.id === id) ?? null
      },
    } as unknown as IdeaRepository,
  )
  return { service, saved, added, moved }
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof UnprocessableError) {
      return error.code
    }
    if (error instanceof ConflictError) {
      return error.message
    }
    throw error
  }
  return 'none'
}

const update = (service: BoardService, id: string, swimlanes: SwimlaneInput[], extra = {}) =>
  service.update(id, { name: id, allowUserStatusUpdate: false, swimlanes, ...extra })

describe('lane references', () => {
  it('refuses a lane that references its own board', async () => {
    const { service } = harness([board('a'), board('b')])

    expect(await codeOf(update(service, 'a', lanesReferencing('a')))).toBe('laneReferencesOwnBoard')
  })

  it.each([
    ['missing', 'nope', [board('a')]],
    ['archived', 'b', [board('a'), { ...board('b'), isArchived: true }]],
    ['in another organization', 'b', [board('a'), board('b', { organizationId: ORG_B })]],
  ])('refuses a %s target as referencesBoardInvalid', async (_label, target, boards) => {
    const { service } = harness(boards)

    expect(await codeOf(update(service, 'a', lanesReferencing(target)))).toBe(
      'referencesBoardInvalid',
    )
  })

  it('refuses a target that itself has a reference lane', async () => {
    const { service } = harness([board('a'), board('b', { referencesBoardId: 'c' }), board('c')])

    expect(await codeOf(update(service, 'a', lanesReferencing('b')))).toBe(
      'referenceChainNotAllowed',
    )
  })

  it('refuses a reference lane on a board that is already a target', async () => {
    const { service } = harness([board('a'), board('b', { referencesBoardId: 'a' }), board('c')])

    expect(await codeOf(update(service, 'a', lanesReferencing('c')))).toBe(
      'referenceChainNotAllowed',
    )
  })

  it('turns idea features off on a board first named as a target, once', async () => {
    const first = harness([board('a'), board('b')])

    await update(first.service, 'a', lanesReferencing('b'))

    expect(first.saved.map((b) => [b.id, b.ideaFeaturesEnabled])).toEqual([
      ['a', true],
      ['b', false],
    ])

    const again = harness([board('a'), board('b'), board('c', { referencesBoardId: 'b' })])
    await update(again.service, 'a', lanesReferencing('b'))

    expect(again.saved.map((b) => b.id)).toEqual(['a'])
  })

  it('saves lane flags on create', async () => {
    const { service, added } = harness([board('b')])

    await service.create(ORG_A, {
      name: 'New',
      allowUserStatusUpdate: false,
      swimlanes: [
        { statusId: S1, order: 0, referencesBoardId: 'b', isFinal: false },
        { statusId: S2, order: 1, isFinal: true },
      ],
    })

    expect(added[0]?.swimlanes.map((l) => [l.isFinal, l.referencesBoardId])).toEqual([
      [false, 'b'],
      [true, null],
    ])
  })
})

describe('laneInUse', () => {
  const held = [{ boardId: 'a', statusId: S1, ideaCount: 2 }]

  it.each([
    ['changed', lanesReferencing('c')],
    ['removed from the lane', lanesReferencing(null)],
  ])('refuses a reference %s while the lane holds ideas', async (_label, swimlanes) => {
    const { service } = harness(
      [board('a', { referencesBoardId: 'b' }), board('b'), board('c')],
      held,
    )

    expect(await codeOf(update(service, 'a', swimlanes))).toBe('laneInUse')
  })

  it('refuses removing a reference lane that holds ideas, even with an idea move', async () => {
    const { service } = harness([board('a', { referencesBoardId: 'b' }), board('b')], held)

    expect(
      await codeOf(
        update(
          service,
          'a',
          [
            { statusId: S2, order: 0 },
            { statusId: 'status-3', order: 1 },
          ],
          {
            ideaMoves: [{ fromStatusId: S1, toStatusId: S2 }],
          },
        ),
      ),
    ).toBe('laneInUse')
  })

  it('allows the change when the lane is empty or the reference is unchanged', async () => {
    const empty = harness([board('a', { referencesBoardId: 'b' }), board('b'), board('c')])
    const same = harness([board('a', { referencesBoardId: 'b' }), board('b')], held)

    await expect(update(empty.service, 'a', lanesReferencing('c'))).resolves.toBeDefined()
    await expect(update(same.service, 'a', lanesReferencing('b'))).resolves.toBeDefined()
  })
})

describe('archiving a reference target', () => {
  it('refuses while a lane references the board', async () => {
    const { service } = harness([board('a', { referencesBoardId: 'b' }), board('b')])

    expect(await codeOf(service.archive('b'))).toBe('referenceTargetArchived')
  })

  it('allows archiving the referencing board', async () => {
    const { service, saved } = harness([board('a', { referencesBoardId: 'b' }), board('b')])

    await service.archive('a')

    expect(saved.map((b) => b.id)).toEqual(['a'])
  })
})

describe('keyPrefix', () => {
  it('upper-cases and stores a prefix on create', async () => {
    const { service, added } = harness([])

    await service.create(ORG_A, {
      name: 'New',
      allowUserStatusUpdate: false,
      swimlanes: LANES,
      keyPrefix: 'ab',
    })

    expect(added[0]?.keyPrefix).toBe('AB')
  })

  it('answers keyPrefixTaken for a duplicate in the organization, on create and update', async () => {
    const { service } = harness([board('a', { keyPrefix: 'AB' }), board('b')])

    expect(
      await codeOf(
        service.create(ORG_A, {
          name: 'x',
          allowUserStatusUpdate: false,
          swimlanes: LANES,
          keyPrefix: 'ab',
        }),
      ),
    ).toBe('keyPrefixTaken')
    expect(await codeOf(update(service, 'b', LANES, { keyPrefix: 'AB' }))).toBe('keyPrefixTaken')
  })

  it('lets a board keep its own prefix on save', async () => {
    const { service } = harness([board('a', { keyPrefix: 'AB', nextItemNumber: 3 })])

    await expect(update(service, 'a', LANES, { keyPrefix: 'AB' })).resolves.toBeDefined()
  })

  it('locks the prefix once a key has been issued, but not before', async () => {
    const issued = harness([board('a', { keyPrefix: 'AB', nextItemNumber: 2 })])
    const fresh = harness([board('a', { keyPrefix: 'AB', nextItemNumber: 1 })])

    expect(await codeOf(update(issued.service, 'a', LANES, { keyPrefix: 'CD' }))).toBe(
      'keyPrefixLocked',
    )
    expect(await codeOf(update(issued.service, 'a', LANES, { keyPrefix: null }))).toBe(
      'keyPrefixLocked',
    )
    await expect(update(fresh.service, 'a', LANES, { keyPrefix: 'CD' })).resolves.toBeDefined()
  })

  it('leaves the prefix alone when the update omits it', async () => {
    const { service } = harness([board('a', { keyPrefix: 'AB', nextItemNumber: 5 })])

    await expect(update(service, 'a', LANES)).resolves.toMatchObject({ keyPrefix: 'AB' })
  })
})

describe('lane references on create', () => {
  const create = (service: BoardService, swimlanes: SwimlaneInput[]) =>
    service.create(ORG_A, { name: 'New', allowUserStatusUpdate: false, swimlanes })

  it.each([
    ['missing', 'nope', [board('b')]],
    ['archived', 'b', [{ ...board('b'), isArchived: true }]],
    ['in another organization', 'b', [board('b', { organizationId: ORG_B })]],
  ])('refuses a %s target as referencesBoardInvalid', async (_label, target, boards) => {
    const { service, added } = harness(boards)

    expect(await codeOf(create(service, lanesReferencing(target)))).toBe('referencesBoardInvalid')
    expect(added).toHaveLength(0)
  })

  it('refuses a target that has a reference lane of its own', async () => {
    const { service, added } = harness([board('b', { referencesBoardId: 'c' }), board('c')])

    expect(await codeOf(create(service, lanesReferencing('b')))).toBe('referenceChainNotAllowed')
    expect(added).toHaveLength(0)
  })

  it('turns idea features off on a first-named target, and saves it once for two lanes', async () => {
    const { service, saved } = harness([board('b')])

    await create(service, [
      { statusId: S1, order: 0, referencesBoardId: 'b' },
      { statusId: S2, order: 1, referencesBoardId: 'b' },
    ])

    expect(saved.map((b) => [b.id, b.ideaFeaturesEnabled])).toEqual([['b', false]])
  })

  it('does not touch a target that is already named by another lane', async () => {
    const { service, saved } = harness([board('b'), board('c', { referencesBoardId: 'b' })])

    await create(service, lanesReferencing('b'))

    expect(saved).toHaveLength(0)
  })
})

describe('laneInUse, further cases', () => {
  const held = [{ boardId: 'a', statusId: S1, ideaCount: 2 }]
  const keepOnlyS2: SwimlaneInput[] = [
    { statusId: S2, order: 0 },
    { statusId: 'status-3', order: 1 },
  ]

  it('refuses removing a reference lane that holds ideas with no idea move, ahead of the move rule', async () => {
    const { service } = harness([board('a', { referencesBoardId: 'b' }), board('b')], held)

    expect(await codeOf(update(service, 'a', keepOnlyS2))).toBe('laneInUse')
  })

  it('allows removing an empty reference lane', async () => {
    const { service, saved } = harness([board('a', { referencesBoardId: 'b' }), board('b')])

    await update(service, 'a', keepOnlyS2)

    expect(saved.map((b) => b.id)).toEqual(['a'])
  })

  it('is not raised by ideas in a different lane than the one whose reference changes', async () => {
    const { service } = harness(
      [board('a', { referencesBoardId: 'b' }), board('b'), board('c')],
      [{ boardId: 'a', statusId: S2, ideaCount: 4 }],
    )

    await expect(update(service, 'a', lanesReferencing('c'))).resolves.toBeDefined()
  })

  it('is not raised by a zero count row', async () => {
    const { service } = harness(
      [board('a', { referencesBoardId: 'b' }), board('b')],
      [{ boardId: 'a', statusId: S1, ideaCount: 0 }],
    )

    await expect(update(service, 'a', lanesReferencing(null))).resolves.toBeDefined()
  })

  it('allows giving a reference to an ordinary lane that holds ideas', async () => {
    const { service } = harness([board('a'), board('b')], held)

    await expect(update(service, 'a', lanesReferencing('b'))).resolves.toBeDefined()
  })

  it('keeps the existing 400 for an ordinary lane removed with ideas and no move', async () => {
    const { service } = harness([board('a'), board('b')], held, [
      { ideaId: 'i1', title: 'Idea', statusId: S1, effort: null },
    ])

    await expect(update(service, 'a', keepOnlyS2)).rejects.toBeInstanceOf(ValidationError)
  })

  it('refuses before anything is written', async () => {
    const { service, saved } = harness(
      [board('a', { referencesBoardId: 'b' }), board('b'), board('c')],
      held,
    )

    await codeOf(update(service, 'a', lanesReferencing('c')))

    expect(saved).toHaveLength(0)
  })
})

describe('reference rules write nothing when they refuse', () => {
  it.each([
    ['own board', lanesReferencing('a'), [board('a'), board('b')]],
    ['invalid target', lanesReferencing('nope'), [board('a')]],
    [
      'chain',
      lanesReferencing('b'),
      [board('a'), board('b', { referencesBoardId: 'c' }), board('c')],
    ],
  ])('%s', async (_label, swimlanes, boards) => {
    const { service, saved } = harness(boards)

    await codeOf(update(service, 'a', swimlanes))

    expect(saved).toHaveLength(0)
  })
})

describe('archive guard, further cases', () => {
  it('allows archiving a board no lane references', async () => {
    const { service, saved } = harness([
      board('a', { referencesBoardId: 'b' }),
      board('b'),
      board('c'),
    ])

    await service.archive('c')

    expect(saved.map((b) => b.id)).toEqual(['c'])
  })

  it('saves nothing when the guard refuses', async () => {
    const { service, saved } = harness([board('a', { referencesBoardId: 'b' }), board('b')])

    await codeOf(service.archive('b'))

    expect(saved).toHaveLength(0)
  })

  it('allows archiving a board once no lane references it', async () => {
    const { service } = harness([board('a'), board('b')])

    await expect(service.archive('b')).resolves.toBeUndefined()
  })
})

describe('archived board and lane saves', () => {
  it('refuses a PUT on an archived board with 409, not a reference rule', async () => {
    const { service } = harness([{ ...board('a'), isArchived: true }, board('b')])

    await expect(update(service, 'a', lanesReferencing('b'))).rejects.toBeInstanceOf(ConflictError)
  })
})

describe('reorder keeps stored lane flags', () => {
  it('moves the flags with their lanes and ignores flags in the request', async () => {
    const { service, saved } = harness([board('a', { referencesBoardId: 'b' }), board('b')])

    await service.reorderSwimlanes('a', {
      swimlanes: [
        { statusId: S2, order: 0, isFinal: false, referencesBoardId: 'zzz' },
        { statusId: S1, order: 1, isFinal: true },
      ],
    })

    expect(saved[0]?.swimlanes.map((l) => [l.statusId, l.isFinal, l.referencesBoardId])).toEqual([
      [S2, true, null],
      [S1, false, 'b'],
    ])
  })
})

describe('keyPrefix, further cases', () => {
  it('rejects a malformed prefix as a validation error keyed keyPrefix', async () => {
    const { service } = harness([board('a')])

    for (const keyPrefix of ['x', 'AB-1', 'ABCDEFGHIJK']) {
      const error = await update(service, 'a', LANES, { keyPrefix }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ValidationError)
      expect(JSON.stringify((error as ValidationError).failures)).toContain('keyPrefix')
    }
  })

  it('does not treat a different case of the stored prefix as a change on a locked board', async () => {
    const { service } = harness([board('a', { keyPrefix: 'AB', nextItemNumber: 9 })])

    await expect(update(service, 'a', LANES, { keyPrefix: 'ab' })).resolves.toMatchObject({
      keyPrefix: 'AB',
    })
  })

  it('locks setting a first prefix once a number has been issued', async () => {
    const { service } = harness([board('a', { nextItemNumber: 2 })])

    expect(await codeOf(update(service, 'a', LANES, { keyPrefix: 'AB' }))).toBe('keyPrefixLocked')
  })

  it('does not collide with a prefix in another organization', async () => {
    const { service } = harness([
      board('a'),
      board('b', { keyPrefix: 'AB', organizationId: ORG_B }),
    ])

    await expect(update(service, 'a', LANES, { keyPrefix: 'AB' })).resolves.toMatchObject({
      keyPrefix: 'AB',
    })
  })

  it('refuses a locked change before reporting a duplicate', async () => {
    const { service } = harness([
      board('a', { keyPrefix: 'AB', nextItemNumber: 2 }),
      board('b', { keyPrefix: 'CD' }),
    ])

    expect(await codeOf(update(service, 'a', LANES, { keyPrefix: 'CD' }))).toBe('keyPrefixLocked')
  })

  it('saves nothing on a refused prefix change', async () => {
    const { service, saved } = harness([board('a', { keyPrefix: 'AB', nextItemNumber: 2 })])

    await codeOf(update(service, 'a', LANES, { keyPrefix: 'CD' }))

    expect(saved).toHaveLength(0)
  })

  it('stores the flags it is given and keeps them when omitted', async () => {
    const { service } = harness([board('a')])

    const set = await update(service, 'a', LANES, {
      sprintsEnabled: true,
      ideaFeaturesEnabled: false,
    })
    const kept = await update(service, 'a', LANES)

    expect(set).toMatchObject({ sprintsEnabled: true, ideaFeaturesEnabled: false })
    expect(kept).toMatchObject({ sprintsEnabled: false, ideaFeaturesEnabled: true })
  })
})

describe('ideaMoves into a reference lane', () => {
  const lanes: SwimlaneInput[] = [
    { statusId: S1, order: 0, referencesBoardId: 'b' },
    { statusId: 'status-3', order: 1 },
  ]
  const moves = { ideaMoves: [{ fromStatusId: S2, toStatusId: S1 }] }
  const idea = (effort: EffortLevel | null) => ({
    ideaId: 'i1',
    title: 'Idea',
    statusId: S2,
    effort,
  })

  it('refuses an idea without an Effort', async () => {
    const { service } = harness([board('a'), board('b')], [], [idea(null)])

    expect(await codeOf(update(service, 'a', lanes, moves))).toBe('effortRequiredForReferenceLane')
  })

  it('moves an idea that has an Effort', async () => {
    const { service } = harness([board('a'), board('b')], [], [idea(EffortLevel.Low)])

    await expect(update(service, 'a', lanes, moves)).resolves.toBeDefined()
  })
})

describe('pulling into a reference lane', () => {
  const pooled = (effort: EffortLevel | null): Idea => ({
    ...createIdea({
      id: '11111111-1111-4111-8111-111111111111',
      organizationId: ORG_A,
      boardId: null,
      statusId: 'unused-status',
      title: 'Pooled',
      description: null,
      problem: 'p',
      proposedSolutions: ['s'],
      impactRationale: 'r',
      priority: Priority.Medium,
      ideaTypeId: 't',
      businessImpactId: 'i',
      dueDate: null,
      authorUserId: 'author',
      assigneeUserIds: [],
      tagIds: [],
      mentionedUserIds: [],
      nowUtc: NOW,
    }),
    effort,
  })
  const pull = { pullItemIds: ['11111111-1111-4111-8111-111111111111'] }

  it('refuses an item without an Effort and writes nothing, then accepts it with one', async () => {
    const refused = harness([board('a'), board('b')], [], [], [pooled(null)])
    expect(await codeOf(update(refused.service, 'a', lanesReferencing('b'), pull))).toBe(
      'effortRequiredForReferenceLane',
    )
    expect(refused.saved).toHaveLength(0)
    expect(refused.moved).toHaveLength(0)

    const accepted = harness([board('a'), board('b')], [], [], [pooled(EffortLevel.Low)])
    await update(accepted.service, 'a', lanesReferencing('b'), pull)
    expect(accepted.moved).toHaveLength(1)
  })
})

describe('Effort entry rule: the edges of ideaMoves and pull', () => {
  const lanes: SwimlaneInput[] = [
    { statusId: S1, order: 0, referencesBoardId: 'b' },
    { statusId: 'status-3', order: 1 },
  ]
  const moves = { ideaMoves: [{ fromStatusId: S2, toStatusId: S1 }] }
  const laneIdea = (ideaId: string, effort: EffortLevel | null) => ({
    ideaId,
    title: ideaId,
    statusId: S2,
    effort,
  })

  it('refuses the whole move when only one of several ideas has no Effort, and moves nothing', async () => {
    const h = harness(
      [board('a'), board('b')],
      [],
      [laneIdea('i1', EffortLevel.Low), laneIdea('i2', null), laneIdea('i3', EffortLevel.High)],
    )

    expect(await codeOf(update(h.service, 'a', lanes, moves))).toBe(
      'effortRequiredForReferenceLane',
    )
    expect(h.saved).toHaveLength(0)
  })

  it('does not ask for Effort when the target lane is an ordinary one', async () => {
    const h = harness([board('a'), board('b')], [], [laneIdea('i1', null)])

    await expect(
      update(h.service, 'a', lanes, { ideaMoves: [{ fromStatusId: S2, toStatusId: 'status-3' }] }),
    ).resolves.toBeDefined()
  })

  it('does not ask for Effort when no lane references a board', async () => {
    const h = harness([board('a')], [], [laneIdea('i1', null)])

    await expect(
      update(
        h.service,
        'a',
        [
          { statusId: S1, order: 0 },
          { statusId: 'status-3', order: 1 },
        ],
        moves,
      ),
    ).resolves.toBeDefined()
  })

  const pooledAt = (statusId: string, effort: EffortLevel | null): Idea => ({
    ...createIdea({
      id: '22222222-2222-4222-8222-222222222222',
      organizationId: ORG_A,
      boardId: null,
      statusId,
      title: 'Pooled',
      description: null,
      problem: 'p',
      proposedSolutions: ['s'],
      impactRationale: 'r',
      priority: Priority.Medium,
      ideaTypeId: 't',
      businessImpactId: 'i',
      dueDate: null,
      authorUserId: 'author',
      assigneeUserIds: [],
      tagIds: [],
      mentionedUserIds: [],
      nowUtc: NOW,
    }),
    effort,
  })
  const pull = { pullItemIds: ['22222222-2222-4222-8222-222222222222'] }

  it('refuses a pull whose kept status is a reference lane, when Effort is unset', async () => {
    const keptLanes: SwimlaneInput[] = [
      { statusId: S1, order: 0 },
      { statusId: S2, order: 1, referencesBoardId: 'b' },
    ]
    const h = harness([board('a'), board('b')], [], [], [pooledAt(S2, null)])

    expect(await codeOf(update(h.service, 'a', keptLanes, pull))).toBe(
      'effortRequiredForReferenceLane',
    )
    expect(h.saved).toHaveLength(0)
    expect(h.moved).toHaveLength(0)
  })

  it('lets an item with no Effort be pulled into an ordinary lane of a board that has a reference lane', async () => {
    // The item's own status S1 is ordinary on this board; the reference lane is S2.
    const ordinaryLanes: SwimlaneInput[] = [
      { statusId: S1, order: 0 },
      { statusId: S2, order: 1, referencesBoardId: 'b' },
    ]
    const h = harness([board('a'), board('b')], [], [], [pooledAt(S1, null)])

    await update(h.service, 'a', ordinaryLanes, pull)

    expect(h.moved).toHaveLength(1)
  })

  it('lets an item with no Effort be pulled when no lane references a board', async () => {
    const h = harness([board('a')], [], [], [pooledAt('unused-status', null)])

    await update(h.service, 'a', LANES, pull)

    expect(h.moved).toHaveLength(1)
  })
})
