// QA for contracts/boards.md "Response addition" on the pull picker read (2026-10-19): the page
// carries `hiddenTaskCount`, and the service hands the repository's page back unchanged, with the
// same filters the repository counts under - including the User's own-ideas restriction. The SQL
// that counts is proved against a live database in
// packages/infrastructure/test/board-references-3.integration.test.ts. In-memory ports.

import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { AutoCreateTaskPort } from '../../src/boards/index.js'
import type { PullCandidatePage } from '../../src/boards/models.js'
import type { BoardRepository, PullCandidateFilter } from '../../src/boards/ports.js'
import type { CurrentUserContext } from '../../src/common/index.js'
import type { IdeaRepository } from '../../src/ideas/ports.js'
import type { StatusRepository } from '../../src/statuses/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  member,
  ORG_A,
  orgAdmin,
  recordingAudit,
} from '../support/fixtures.js'

function setup(user: CurrentUserContext, answer: PullCandidatePage) {
  const filters: PullCandidateFilter[] = []
  const boards = {
    async listPullCandidates(filter: PullCandidateFilter) {
      filters.push(filter)
      return answer
    },
    async visibleBoardIds() {
      return []
    },
  } as unknown as BoardRepository
  const service = new BoardService(
    boards,
    {} as StatusRepository,
    {
      async existsById() {
        return true
      },
    },
    countingUnitOfWork(),
    recordingAudit(),
    user,
    fixedClock(),
    {} as IdeaRepository,
    {} as AutoCreateTaskPort,
  )
  return { service, filters }
}

const query = (overrides: Record<string, unknown> = {}) => ({
  source: 'unassigned',
  excludeBoardId: null,
  search: null,
  tags: [],
  authorUserId: null,
  page: null,
  pageSize: null,
  ...overrides,
})

const page = (hiddenTaskCount: number): PullCandidatePage => ({
  items: [],
  page: 1,
  pageSize: 20,
  totalCount: 0,
  hiddenTaskCount,
})

describe('listPullCandidates: hiddenTaskCount', () => {
  it.each([0, 1, 7])(
    'answers the count the repository gave, %i, with the page untouched',
    async (count) => {
      const { service } = setup(orgAdmin(), page(count))

      const result = await service.listPullCandidates(ORG_A, query())

      expect(result).toEqual(page(count))
    },
  )

  it('counts under the search, tag, board and author the caller sent, for an Org Admin', async () => {
    const { service, filters } = setup(orgAdmin(), page(2))

    await service.listPullCandidates(
      ORG_A,
      query({ search: 'onboarding', tags: ['Red'], excludeBoardId: 'b1', authorUserId: 'u9' }),
    )

    expect(filters[0]).toMatchObject({
      source: 'unassigned',
      search: 'onboarding',
      tags: ['red'],
      excludeBoardId: 'b1',
      authorUserId: 'u9',
    })
  })

  it('counts under the User’s own ideas only, whatever author was asked', async () => {
    const { service, filters } = setup(member(ORG_A, 'user-1'), page(2))

    await service.listPullCandidates(ORG_A, query({ authorUserId: 'someone-else' }))

    expect(filters[0]).toMatchObject({ authorUserId: 'user-1' })
  })
})
