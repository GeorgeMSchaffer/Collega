// Who can see a board (SPEC/20-feature-board-access-and-groups.md BAG-3; SPEC/contracts/boards.md
// "Board access"), through BoardService.list and getById.
//
// The oracle the spec names: a table over {Org Admin, creator, direct grant, group grant, not
// granted} x {Organization, Restricted} -> sees / does not see, read both ways (listed, and the
// detail answers or 404s); one test for 3d that changes group membership and re-reads without any
// board being written; and 3c, a direct Site Admin sees every board while View As sees exactly
// what the target sees.

import { type Board, createBoard } from '@collega/domain/boards'
import { BoardVisibility, Role } from '@collega/domain/enums'
import { createStatus, type Status } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { AutoCreateTaskPort, BoardRepository } from '../../src/boards/index.js'
import { type CurrentUserContext, NotFoundError } from '../../src/common/index.js'
import type { IdeaRepository } from '../../src/ideas/ports.js'
import type { StatusRepository } from '../../src/statuses/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  impersonating,
  lanes,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const ADMIN = 'org-admin-1'
const CREATOR = 'creator-1'
const DIRECT = 'direct-1'
const GROUPED = 'grouped-1'
const OUTSIDER = 'outsider-1'
const GROUP = 'group-1'

const OPEN_BOARD = 'board-open'
const LOCKED_BOARD = 'board-locked'
const EMPTY_LIST_BOARD = 'board-empty-list'
const FOREIGN_BOARD = 'board-foreign'

const STATUS_1 = 'status-1'
const STATUS_2 = 'status-2'

function status(id: string, sortOrder: number): Status {
  return createStatus({
    id,
    organizationId: ORG_A,
    name: `Status ${id}`,
    color: '#123456',
    sortOrder,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

function board(
  id: string,
  visibility: BoardVisibility,
  options: { organizationId?: string; userIds?: string[]; groupIds?: string[] } = {},
): Board {
  return createBoard({
    id,
    organizationId: options.organizationId ?? ORG_A,
    name: `Board ${id}`,
    allowUserStatusUpdate: false,
    orderedLanes: lanes(STATUS_1, STATUS_2),
    access: {
      visibility,
      userIds: options.userIds ?? [DIRECT],
      groupIds: options.groupIds ?? [GROUP],
    },
    nowUtc: NOW,
    actorUserId: CREATOR,
  })
}

/** Both boards carry the same access list; only the visibility differs, so the list is what
 * grants on one and is ignored on the other (BAG-2e). */
const BOARDS = [
  board(OPEN_BOARD, BoardVisibility.Organization),
  board(LOCKED_BOARD, BoardVisibility.Restricted),
]

/** A mutable group membership, read on every request as the real repository does. */
type Memberships = Map<string, Set<string>>

function harness(
  currentUser: CurrentUserContext,
  options: { boards?: readonly Board[]; memberships?: Memberships } = {},
) {
  const boardsById = new Map((options.boards ?? BOARDS).map((b) => [b.id, b]))
  const memberships: Memberships = options.memberships ?? new Map([[GROUP, new Set([GROUPED])]])
  const writes: string[] = []
  const statuses = [status(STATUS_1, 10), status(STATUS_2, 20)]

  const unexpected = (name: string) => async () => {
    throw new Error(`${name} must not be reached by a read`)
  }
  const boards: BoardRepository = {
    add: async () => {
      writes.push('add')
    },
    save: async () => {
      writes.push('save')
    },
    replaceAllowedIdeaTypes: async () => {
      writes.push('replaceAllowedIdeaTypes')
    },
    replaceAccess: async () => {
      writes.push('replaceAccess')
    },
    getById: async (id) => boardsById.get(id) ?? null,
    listByOrganization: async (organizationId) =>
      [...boardsById.values()].filter((b) => b.organizationId === organizationId),
    visibleBoardIds: unexpected('visibleBoardIds'),
    listGroupIdsForUser: async (userId) =>
      [...memberships].filter(([, users]) => users.has(userId)).map(([groupId]) => groupId),
    isStatusReferenced: async () => false,
    countIdeasByBoard: async (ids) => new Map(ids.map((id) => [id, 0])),
    countIdeasByBoardAndStatus: async () => [],
    countIdeasByBoardAndTag: async () => [],
    getUserNames: async () => new Map(),
    listLaneIdeas: async () => [],
    moveIdeas: unexpected('moveIdeas'),
    verifyIdeasMoved: unexpected('verifyIdeasMoved'),
    reassignIdeas: unexpected('reassignIdeas'),
    listPullCandidates: unexpected('listPullCandidates'),
    listOrganizationUserIds: async () => [],
    listOrganizationGroupIds: async () => [],
    listIdeaTypes: async () => [],
  }
  const statusRepository: StatusRepository = {
    add: async () => {},
    addMany: async () => {},
    getById: async (id) => statuses.find((s) => s.id === id) ?? null,
    listActiveByOrganization: async () => statuses,
    listByOrganization: async () => statuses,
    countActiveByOrganization: async () => statuses.length,
    save: async () => {},
  }
  const service = new BoardService(
    boards,
    statusRepository,
    { existsById: async (id) => id === ORG_A || id === ORG_B },
    countingUnitOfWork(),
    recordingAudit(),
    currentUser,
    fixedClock(),
    {} as IdeaRepository,
    {} as AutoCreateTaskPort,
  )
  return { service, memberships, writes }
}

async function listedIds(currentUser: CurrentUserContext, organizationId = ORG_A) {
  const { service } = harness(currentUser)
  return (await service.list(organizationId)).map((item) => item.boardId)
}

async function detailAnswers(currentUser: CurrentUserContext, boardId: string): Promise<boolean> {
  const { service } = harness(currentUser)
  const outcome = await service.getById(boardId).then(
    (detail) => detail.boardId === boardId,
    (error: unknown) => {
      // Never a 403: a board the caller cannot see answers as if it did not exist (BAG-4a).
      expect(error).toBeInstanceOf(NotFoundError)
      return false
    },
  )
  return outcome
}

const CALLERS: readonly [string, CurrentUserContext][] = [
  ['Org Admin', orgAdmin(ORG_A, ADMIN)],
  ['the creator', member(ORG_A, CREATOR)],
  ['a direct grant', member(ORG_A, DIRECT)],
  ['a group grant', member(ORG_A, GROUPED)],
  ['not granted', member(ORG_A, OUTSIDER)],
]

/** BAG-3 Terms "Can see a board": every caller sees an Organization board; only the first four
 * see the Restricted one. */
const TABLE: readonly [string, CurrentUserContext, string, BoardVisibility, boolean][] =
  CALLERS.flatMap(([label, caller]) => [
    [label, caller, OPEN_BOARD, BoardVisibility.Organization, true] as const,
    [label, caller, LOCKED_BOARD, BoardVisibility.Restricted, label !== 'not granted'] as const,
  ])

describe('BAG-3 visibility table through BoardService', () => {
  it.each(TABLE)(
    '%s on an %s board -> sees: %s (list)',
    async (_label, caller, boardId, _v, sees) => {
      const ids = await listedIds(caller)

      expect(ids.includes(boardId)).toBe(sees)
    },
  )

  it.each(TABLE)(
    '%s on an %s board -> sees: %s (detail)',
    async (_label, caller, boardId, _v, sees) => {
      await expect(detailAnswers(caller, boardId)).resolves.toBe(sees)
    },
  )

  it('lists each visible board once, whichever way the caller is granted', async () => {
    // DIRECT is on the list directly; adding them to the group too must not list the board twice.
    const memberships: Memberships = new Map([[GROUP, new Set([GROUPED, DIRECT])]])
    const { service } = harness(member(ORG_A, DIRECT), { memberships })

    const ids = (await service.list(ORG_A)).map((item) => item.boardId)

    expect(ids.sort()).toEqual([LOCKED_BOARD, OPEN_BOARD].sort())
  })

  it('applies the same rule to a Read Only member granted through a group (3f: role unchanged)', async () => {
    const caller = readOnly(ORG_A, GROUPED)

    await expect(listedIds(caller)).resolves.toContain(LOCKED_BOARD)
    await expect(detailAnswers(caller, LOCKED_BOARD)).resolves.toBe(true)
  })

  it('leaves out a Read Only member who is not granted', async () => {
    const caller = readOnly(ORG_A, OUTSIDER)

    await expect(listedIds(caller)).resolves.toEqual([OPEN_BOARD])
    await expect(detailAnswers(caller, LOCKED_BOARD)).resolves.toBe(false)
  })

  it('shows a Restricted board with an empty list to Org Admins and the creator only (2d)', async () => {
    const boards = [
      board(EMPTY_LIST_BOARD, BoardVisibility.Restricted, { userIds: [], groupIds: [] }),
    ]
    const sees = async (caller: CurrentUserContext) =>
      (await harness(caller, { boards }).service.list(ORG_A)).map((item) => item.boardId)

    await expect(sees(orgAdmin(ORG_A, ADMIN))).resolves.toEqual([EMPTY_LIST_BOARD])
    await expect(sees(member(ORG_A, CREATOR))).resolves.toEqual([EMPTY_LIST_BOARD])
    await expect(sees(member(ORG_A, DIRECT))).resolves.toEqual([])
    await expect(sees(member(ORG_A, GROUPED))).resolves.toEqual([])
  })

  it('does not let a grant cross organizations: a user of another organization named on the list sees nothing', async () => {
    const boards = [board(LOCKED_BOARD, BoardVisibility.Restricted, { userIds: [OUTSIDER] })]
    const { service } = harness(member(ORG_B, OUTSIDER), { boards })

    await expect(service.getById(LOCKED_BOARD)).rejects.toThrow(NotFoundError)
  })
})

describe('BAG-3d membership is read at request time', () => {
  it('grants on the next read after joining the group, and revokes on the next read after leaving, with no board written', async () => {
    const memberships: Memberships = new Map([[GROUP, new Set<string>()]])
    const caller = member(ORG_A, OUTSIDER)
    const request = () => harness(caller, { memberships })

    const before = request()
    expect((await before.service.list(ORG_A)).map((b) => b.boardId)).toEqual([OPEN_BOARD])
    await expect(before.service.getById(LOCKED_BOARD)).rejects.toThrow(NotFoundError)

    memberships.get(GROUP)?.add(OUTSIDER)
    const joined = request()
    expect((await joined.service.list(ORG_A)).map((b) => b.boardId).sort()).toEqual(
      [LOCKED_BOARD, OPEN_BOARD].sort(),
    )
    await expect(joined.service.getById(LOCKED_BOARD)).resolves.toMatchObject({
      boardId: LOCKED_BOARD,
    })

    memberships.get(GROUP)?.delete(OUTSIDER)
    const left = request()
    expect((await left.service.list(ORG_A)).map((b) => b.boardId)).toEqual([OPEN_BOARD])
    await expect(left.service.getById(LOCKED_BOARD)).rejects.toThrow(NotFoundError)

    expect([...before.writes, ...joined.writes, ...left.writes]).toEqual([])
  })

  it('re-reads membership within one service too: a long-lived service does not cache it', async () => {
    const memberships: Memberships = new Map([[GROUP, new Set<string>()]])
    const { service } = harness(member(ORG_A, OUTSIDER), { memberships })

    await expect(service.getById(LOCKED_BOARD)).rejects.toThrow(NotFoundError)
    memberships.get(GROUP)?.add(OUTSIDER)

    await expect(service.getById(LOCKED_BOARD)).resolves.toMatchObject({ boardId: LOCKED_BOARD })
  })
})

describe('BAG-3c Site Admin', () => {
  const everyOrg = [
    ...BOARDS,
    board(FOREIGN_BOARD, BoardVisibility.Restricted, {
      organizationId: ORG_B,
      userIds: [],
      groupIds: [],
    }),
  ]

  it('acting directly sees every board, Restricted ones and other organizations’ included', async () => {
    const { service } = harness(siteAdmin(), { boards: everyOrg })

    expect((await service.list(ORG_A)).map((b) => b.boardId).sort()).toEqual(
      [LOCKED_BOARD, OPEN_BOARD].sort(),
    )
    expect((await service.list(ORG_B)).map((b) => b.boardId)).toEqual([FOREIGN_BOARD])
    await expect(service.getById(LOCKED_BOARD)).resolves.toMatchObject({ boardId: LOCKED_BOARD })
    await expect(service.getById(FOREIGN_BOARD)).resolves.toMatchObject({ boardId: FOREIGN_BOARD })
  })

  it.each([
    ['a User who is not granted', OUTSIDER, Role.User, [OPEN_BOARD]],
    ['a User granted directly', DIRECT, Role.User, [LOCKED_BOARD, OPEN_BOARD]],
    ['a User granted through a group', GROUPED, Role.User, [LOCKED_BOARD, OPEN_BOARD]],
    ['a Read Only member who is not granted', OUTSIDER, Role.ReadOnly, [OPEN_BOARD]],
    ['an Org Admin', ADMIN, Role.OrgAdmin, [LOCKED_BOARD, OPEN_BOARD]],
  ])(
    'in View As of %s sees exactly what the target sees',
    async (_label, targetUserId, targetRole, expected) => {
      const viewAs = impersonating({ targetUserId, targetRole, targetOrganizationId: ORG_A })
      const { service } = harness(viewAs, { boards: everyOrg })

      expect((await service.list(ORG_A)).map((b) => b.boardId).sort()).toEqual([...expected].sort())
      await expect(detailAnswers(viewAs, LOCKED_BOARD)).resolves.toBe(
        expected.includes(LOCKED_BOARD),
      )
      // The target's organization is the only one in reach, as for every View As read.
      await expect(service.getById(FOREIGN_BOARD)).rejects.toThrow(NotFoundError)
    },
  )
})
