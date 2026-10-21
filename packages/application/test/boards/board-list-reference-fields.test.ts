import { type Board, createBoard } from '@collega/domain/boards'
import { createStatus } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { AutoCreateTaskPort } from '../../src/boards/index.js'
import type { BoardRepository } from '../../src/boards/ports.js'
import type { IdeaRepository } from '../../src/ideas/ports.js'
import type { StatusRepository } from '../../src/statuses/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  NOW,
  ORG_A,
  orgAdmin,
  recordingAudit,
} from '../support/fixtures.js'

/**
 * `hasReferenceLane` and `referencedByBoardIds` on the board list (slice 292): the Boards screen's
 * form reads them in place of one `GET /boards/{id}` per other board.
 */
const S1 = 'status-1'
const S2 = 'status-2'

function board(
  id: string,
  options: { references?: readonly (string | null)[]; archived?: boolean } = {},
): Board {
  const references = options.references ?? [null, null]
  const created = createBoard({
    id,
    organizationId: ORG_A,
    name: id,
    allowUserStatusUpdate: false,
    orderedLanes: references.map((referencesBoardId, index) => ({
      statusId: index === 0 ? S1 : index === 1 ? S2 : `status-${index + 1}`,
      isFinal: index === references.length - 1,
      referencesBoardId,
    })),
    nowUtc: NOW,
    actorUserId: 'seed',
  })
  return options.archived ? { ...created, isArchived: true, archivedAtUtc: NOW } : created
}

function listing(boards: readonly Board[]) {
  const repository = {
    async listByOrganization() {
      return boards
    },
    async countIdeasByBoard() {
      return new Map()
    },
    async countIdeasByBoardAndStatus() {
      return []
    },
    async countIdeasByBoardAndTag() {
      return []
    },
    async getUserNames() {
      return new Map()
    },
  } as unknown as BoardRepository
  const statuses = {
    async listByOrganization() {
      return ['status-1', 'status-2', 'status-3', 'status-4'].map((id) =>
        createStatus({
          id,
          organizationId: ORG_A,
          name: id,
          color: '#123456',
          sortOrder: 1,
          nowUtc: NOW,
          actorUserId: 'seed',
        }),
      )
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
    {} as IdeaRepository,
    {} as AutoCreateTaskPort,
  )
  return service
}

async function listed(boards: readonly Board[], includeArchived = false) {
  const items = await listing(boards).list(ORG_A, { includeArchived })
  return new Map(items.map((item) => [item.boardId, item]))
}

describe('BoardService.list: hasReferenceLane', () => {
  it('is true only for a board with a lane that references another board', async () => {
    const result = await listed([board('plain'), board('work', { references: ['plain', null] })])

    expect(result.get('plain')?.hasReferenceLane).toBe(false)
    expect(result.get('work')?.hasReferenceLane).toBe(true)
  })
})

describe('BoardService.list: referencedByBoardIds', () => {
  it('names each board whose lanes reference this one, and is empty for a board nobody references', async () => {
    const result = await listed([
      board('target'),
      board('a', { references: ['target', null] }),
      board('b', { references: [null, 'target'] }),
    ])

    expect(result.get('target')?.referencedByBoardIds).toEqual(['a', 'b'])
    expect(result.get('a')?.referencedByBoardIds).toEqual([])
  })

  it('lists a referring board once however many of its lanes point at the target', async () => {
    const result = await listed([
      board('target'),
      board('a', { references: ['target', 'target', null] }),
    ])

    expect(result.get('target')?.referencedByBoardIds).toEqual(['a'])
  })

  it('ignores an archived referrer, even when archived boards are listed', async () => {
    const result = await listed(
      [board('target'), board('old', { references: ['target', null], archived: true })],
      true,
    )

    expect(result.get('target')?.referencedByBoardIds).toEqual([])
    expect(result.get('old')?.hasReferenceLane).toBe(true)
  })

  it('still reports a referrer that the archived filter hides from the list itself', async () => {
    const result = await listed([board('target'), board('a', { references: ['target', null] })])

    expect([...result.keys()].sort()).toEqual(['a', 'target'])
    expect(result.get('target')?.referencedByBoardIds).toEqual(['a'])
  })
})
