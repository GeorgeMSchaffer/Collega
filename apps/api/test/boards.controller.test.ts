// The board description at the HTTP boundary (SPEC/30-Contracts.md Board Contracts). Two different
// 400s share one key, and both are pinned through `ProblemDetailsFilter` because "a 400 keyed
// `description`" is a statement about the response:
//   - a non-string value is refused by the controller itself - the body type is compile-time only,
//     so without that check `{"description": 42}` would reach the domain and be stored as "42";
//   - an over-long string is refused by the domain, mapped by the service to the kernel error.
//
// `ideaMoves` on PUT (added 2026-09-29) is read here and judged by the Application layer, so its
// tests pin what the controller hands the service, and one refusal rendered as a response.

import {
  type BoardRepository,
  BoardService,
  type OrganizationExistenceLookup,
  type UpdateBoardCommand,
} from '@collega/application/boards'
import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type { StatusRepository } from '@collega/application/statuses'
import { type Board, createBoard } from '@collega/domain/boards'
import { Role } from '@collega/domain/enums'
import { createStatus, type Status } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardsController } from '../src/boards/boards.controller.js'
import { ProblemDetailsFilter } from '../src/common/errors/problem-details.filter.js'

const ORG = '11111111-1111-1111-1111-111111111111'
const ADMIN = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const BOARD = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const STATUS_1 = 'c0000000-0000-0000-0000-000000000001'
const STATUS_2 = 'c0000000-0000-0000-0000-000000000002'
const NOW = new Date('2026-09-27T12:00:00.000Z')

const CURRENT_USER: CurrentUserContext = {
  isAuthenticated: true,
  userId: ADMIN,
  organizationId: ORG,
  role: Role.OrgAdmin,
  isImpersonating: false,
  realUserId: ADMIN,
}

function status(id: string, sortOrder: number): Status {
  return createStatus({
    id,
    organizationId: ORG,
    name: `Status ${sortOrder}`,
    color: '#123456',
    sortOrder,
    nowUtc: NOW,
    actorUserId: ADMIN,
  })
}

/** A controller over a real `BoardService`, so the domain's length check is the one exercised. */
function controller(): { controller: BoardsController; persisted: Board[] } {
  const statuses = [status(STATUS_1, 10), status(STATUS_2, 20)]
  const existing = createBoard({
    id: BOARD,
    organizationId: ORG,
    name: 'Ideas',
    allowUserStatusUpdate: true,
    orderedStatusIds: [STATUS_1, STATUS_2],
    nowUtc: NOW,
    actorUserId: ADMIN,
  })
  const persisted: Board[] = []

  const boards: BoardRepository = {
    add: async (board) => {
      persisted.push(board)
    },
    save: async (board) => {
      persisted.push(board)
    },
    getById: async (id) => (id === BOARD ? existing : null),
    listByOrganization: async () => [existing],
    isStatusReferenced: async () => false,
    countIdeasByBoard: async () => new Map(),
    countIdeasByBoardAndStatus: async () => [],
    countIdeasByBoardAndTag: async () => [],
    getUserNames: async () => new Map(),
    listLaneIdeas: async () => [],
    moveIdeas: async () => {},
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
  const organizations: OrganizationExistenceLookup = { existsById: async (id) => id === ORG }
  const unitOfWork: UnitOfWork = { saveChanges: async () => {} }
  const audit: AuditEventWriter = { write: async () => {} }
  const clock: Clock = { now: () => NOW }

  return {
    controller: new BoardsController(
      new BoardService(
        boards,
        statusRepository,
        organizations,
        unitOfWork,
        audit,
        CURRENT_USER,
        clock,
      ),
    ),
    persisted,
  }
}

const SWIMLANES = [
  { statusId: STATUS_1, order: 0 },
  { statusId: STATUS_2, order: 1 },
]

/** What `ProblemDetailsFilter` writes for `exception`, captured without an HTTP server. */
function render(
  exception: unknown,
  url: string,
): { status: number; body: Record<string, unknown> } {
  const captured = { status: 0, body: {} as Record<string, unknown> }
  const response = {
    status(code: number) {
      captured.status = code
      return this
    },
    setHeader() {
      return this
    },
    send(payload: string | Buffer) {
      captured.body = JSON.parse(payload.toString())
      return this
    },
  }
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url, originalUrl: url }),
    }),
  } as never

  new ProblemDetailsFilter().catch(exception, host)
  return captured
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

describe('Board description at the HTTP boundary', () => {
  it.each([
    ['a number', 42],
    ['an object', { text: 'nested' }],
    ['a boolean', true],
  ])('answers PUT with 400 keyed description for %s', async (_label, description) => {
    const { controller: boards, persisted } = controller()

    const error = await thrownBy(
      boards.update(BOARD, {
        name: 'Ideas',
        description: description as unknown as string,
        swimlanes: SWIMLANES,
      }),
    )

    const rendered = render(error, `/api/v1/boards/${BOARD}`)
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['description'])
    expect(persisted).toHaveLength(0)
  })

  it('answers POST with 400 keyed description for a non-string value', async () => {
    const { controller: boards, persisted } = controller()

    const error = await thrownBy(
      boards.create(ORG, {
        name: 'New',
        description: 7 as unknown as string,
        swimlanes: SWIMLANES,
      }),
    )

    expect(render(error, `/api/v1/organizations/${ORG}/boards`)).toMatchObject({
      status: 400,
      body: { errors: { description: expect.any(Array) } },
    })
    expect(persisted).toHaveLength(0)
  })

  it('answers PUT with 400 keyed description for 501 characters', async () => {
    const { controller: boards, persisted } = controller()

    const error = await thrownBy(
      boards.update(BOARD, { name: 'Ideas', description: 'd'.repeat(501), swimlanes: SWIMLANES }),
    )

    const rendered = render(error, `/api/v1/boards/${BOARD}`)
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['description'])
    expect(persisted).toHaveLength(0)
  })

  it('accepts exactly 500 characters and returns the stored description', async () => {
    const { controller: boards } = controller()

    const detail = await boards.update(BOARD, {
      name: 'Ideas',
      description: 'd'.repeat(500),
      swimlanes: SWIMLANES,
    })

    expect(detail.description).toHaveLength(500)
  })
})

describe('Board ideaMoves at the HTTP boundary', () => {
  /** A controller over a service that only records the command `update` was handed. */
  function recording(): { controller: BoardsController; commands: UpdateBoardCommand[] } {
    const commands: UpdateBoardCommand[] = []
    const service = {
      update: async (_boardId: string, command: UpdateBoardCommand) => {
        commands.push(command)
        return {} as never
      },
    } as unknown as BoardService
    return { controller: new BoardsController(service), commands }
  }

  const put = (ideaMoves: unknown) => ({
    name: 'Ideas',
    swimlanes: SWIMLANES,
    ideaMoves: ideaMoves as never,
  })

  it('passes each move through as fromStatusId and toStatusId', async () => {
    const { controller: boards, commands } = recording()

    await boards.update(
      BOARD,
      put([
        { fromStatusId: STATUS_1, toStatusId: STATUS_2 },
        { fromStatusId: STATUS_2, toStatusId: STATUS_1, extra: 'ignored' },
      ]),
    )

    expect(commands[0]?.ideaMoves).toEqual([
      { fromStatusId: STATUS_1, toStatusId: STATUS_2 },
      { fromStatusId: STATUS_2, toStatusId: STATUS_1 },
    ])
  })

  it.each([
    ['absent', undefined],
    ['null', null],
    ['an object', { fromStatusId: STATUS_1, toStatusId: STATUS_2 }],
    ['a string', 'moves'],
  ])('reads %s as no moves', async (_label, ideaMoves) => {
    const { controller: boards, commands } = recording()

    await boards.update(BOARD, put(ideaMoves))

    expect(commands[0]?.ideaMoves).toEqual([])
  })

  it('carries a missing or non-string id as an empty string, for the service to refuse', async () => {
    const { controller: boards, commands } = recording()

    await boards.update(
      BOARD,
      put([null, { fromStatusId: 7 }, { toStatusId: STATUS_2 }, 'not an entry']),
    )

    expect(commands[0]?.ideaMoves).toEqual([
      { fromStatusId: '', toStatusId: '' },
      { fromStatusId: '', toStatusId: '' },
      { fromStatusId: '', toStatusId: STATUS_2 },
      { fromStatusId: '', toStatusId: '' },
    ])
  })

  it('answers a move from a lane the save keeps with 400 keyed ideaMoves', async () => {
    const { controller: boards, persisted } = controller()

    const error = await thrownBy(
      boards.update(BOARD, put([{ fromStatusId: STATUS_1, toStatusId: STATUS_2 }])),
    )

    expect(render(error, `/api/v1/boards/${BOARD}`)).toMatchObject({
      status: 400,
      body: {
        title: 'One or more fields are invalid.',
        errors: { ideaMoves: ['A move must come from a lane this save removes.'] },
      },
    })
    expect(persisted).toHaveLength(0)
  })
})
