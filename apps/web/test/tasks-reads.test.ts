import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '@/lib/api/client'
import { getOpenSprintsByBoard, getTasks, getWorkBoards, type WorkBoard } from '@/lib/data/tasks'
import { actAs } from './support/acting-role'

/**
 * The Tasks page's reads (TB-8): which boards count as work boards, and what each tab asks the
 * organization idea list. The API client is the boundary; what is asserted is the request out.
 */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
}))

const get = vi.mocked(apiGet)
const urlOf = (call: unknown[]) => new URL(String(call[1]), 'http://x')

const boardRow = (boardId: string, over: Record<string, unknown> = {}) => ({
  boardId,
  organizationId: 'org',
  name: `Board ${boardId}`,
  sprintsEnabled: true,
  isArchived: false,
  referencedByBoardIds: ['src'],
  ...over,
})

const item = (id: string, boardId: string) => ({
  ideaId: id,
  boardId,
  title: `Task ${id}`,
  priority: null,
  ideaTypeName: 'Idea',
  businessImpactName: 'Low',
  assignees: [],
  tagNames: [],
  tags: [],
  effort: null,
  statusId: 'l',
  statusName: 'Lane',
  upvoteCount: 0,
  hasUpvoted: false,
  commentCount: 0,
  authorUserId: 'u',
  createdAtUtc: '2026-10-01T00:00:00Z',
  itemKey: `T-${id}`,
  parentIdeaId: null,
  taskCounts: null,
  blockedBy: [],
})
const page = (items: ReturnType<typeof item>[], totalCount = items.length) => ({
  items,
  page: 1,
  pageSize: 100,
  totalCount,
})

const DAYS = {
  goal: null,
  startDate: '2026-10-01',
  endDate: '2026-10-14',
  issueCount: 0,
  doneCount: 0,
}
const W1: WorkBoard = { id: 'b-1', name: 'One', sprintsEnabled: true }
const W2: WorkBoard = { id: 'b-2', name: 'Two', sprintsEnabled: true }

beforeEach(() => {
  get.mockReset()
  actAs('OrgAdmin')
})

describe('getWorkBoards', () => {
  it('keeps only live boards that some other board’s lane references', async () => {
    get.mockResolvedValue([
      boardRow('work'),
      boardRow('plain', { referencedByBoardIds: [] }),
      boardRow('old', { isArchived: true }),
    ])
    const boards = await getWorkBoards()
    expect(boards).toEqual([{ id: 'work', name: 'Board work', sprintsEnabled: true }])
  })

  it('carries whether sprints are on for each board', async () => {
    get.mockResolvedValue([boardRow('a', { sprintsEnabled: false })])
    expect((await getWorkBoards())[0]?.sprintsEnabled).toBe(false)
  })

  it('reads the organization’s board list, not a route of its own', async () => {
    get.mockResolvedValue([])
    await getWorkBoards()
    expect(urlOf(get.mock.calls[0] as unknown[]).pathname).toMatch(
      /^\/organizations\/[^/]+\/boards$/,
    )
  })

  it('answers empty without a request for a Site Admin acting directly', async () => {
    actAs('SiteAdmin')
    expect(await getWorkBoards()).toEqual([])
    expect(get).not.toHaveBeenCalled()
  })
})

describe('getOpenSprintsByBoard', () => {
  it('asks only sprint-enabled boards and drops Completed sprints', async () => {
    get.mockResolvedValue([])
    const off: WorkBoard = { id: 'b-off', name: 'Off', sprintsEnabled: false }
    get.mockImplementation(async (_n, path) =>
      String(path).includes('/boards/b-1/sprints')
        ? [
            { sprintId: 's-p', name: 'Planned', state: 'Planned', ...DAYS },
            { sprintId: 's-a', name: 'Active', state: 'Active', ...DAYS },
            { sprintId: 's-c', name: 'Done', state: 'Completed', ...DAYS },
          ]
        : [],
    )
    const result = await getOpenSprintsByBoard([W1, off])
    expect(result['b-1']?.map((sprint) => sprint.id)).toEqual(['s-p', 's-a'])
    expect(result).not.toHaveProperty('b-off')
    expect(get.mock.calls.map((call) => String(call[1]))).toEqual(['/boards/b-1/sprints'])
  })
})

describe('getTasks', () => {
  beforeEach(() => get.mockResolvedValue(page([])))

  it('asks nothing and answers empty when there are no work boards', async () => {
    const result = await getTasks('backlog', [], {})
    expect(result.ideas).toEqual([])
    expect(result.totalCount).toBe(0)
    expect(get).not.toHaveBeenCalled()
  })

  it('Backlog: the organization list for the work boards, in no sprint, finished work left out', async () => {
    await getTasks('backlog', [W1, W2], {})
    const url = urlOf(get.mock.calls[0] as unknown[])
    expect(url.pathname).toMatch(/^\/organizations\/[^/]+\/ideas$/)
    expect(url.searchParams.getAll('boardId')).toEqual(['b-1', 'b-2'])
    expect(url.searchParams.get('sprintId')).toBe('none')
    expect(url.searchParams.get('hideFinal')).toBe('true')
    expect(url.searchParams.get('scope')).toBeNull()
  })

  it('My tasks: scope=assigned with finished work left out, not limited to the backlog', async () => {
    await getTasks('mine', [W1, W2], {})
    const url = urlOf(get.mock.calls[0] as unknown[])
    expect(url.searchParams.get('scope')).toBe('assigned')
    expect(url.searchParams.get('hideFinal')).toBe('true')
    expect(url.searchParams.get('sprintId')).toBeNull()
  })

  it('All: only the work boards, with no sprint, scope or finished-work filter', async () => {
    await getTasks('all', [W1, W2], {})
    const url = urlOf(get.mock.calls[0] as unknown[])
    expect(url.searchParams.getAll('boardId')).toEqual(['b-1', 'b-2'])
    for (const key of ['sprintId', 'hideFinal', 'scope'])
      expect(url.searchParams.get(key)).toBeNull()
  })

  it('asks for the newest first at the API maximum, or for one row when only the count is wanted', async () => {
    await getTasks('backlog', [W1], {})
    await getTasks('backlog', [W1], {}, 1)
    const [full, count] = get.mock.calls.map((call) => urlOf(call as unknown[]))
    expect(full?.searchParams.get('pageSize')).toBe('100')
    expect(full?.searchParams.get('sortBy')).toBe('createdAt')
    expect(full?.searchParams.get('sortDirection')).toBe('desc')
    expect(count?.searchParams.get('pageSize')).toBe('1')
  })

  it('returns the API’s total, which can exceed the rows sent', async () => {
    get.mockResolvedValue(page([item('1', 'b-1')], 250))
    const result = await getTasks('all', [W1], {})
    expect(result.ideas).toHaveLength(1)
    expect(result.totalCount).toBe(250)
  })

  describe('In sprint', () => {
    const sprints = {
      'b-1': [
        { id: 's-1', name: 'S1', state: 'Active' as const },
        { id: 's-2', name: 'S2', state: 'Planned' as const },
      ],
      'b-2': [{ id: 's-3', name: 'S3', state: 'Planned' as const }],
    }

    it('asks once per open sprint, each scoped to its own board and sprint', async () => {
      await getTasks('sprint', [W1, W2], sprints)
      const calls = get.mock.calls.map((call) => urlOf(call as unknown[]))
      expect(calls).toHaveLength(3)
      const pairs = calls.map((url) => [
        url.searchParams.getAll('boardId'),
        url.searchParams.get('sprintId'),
      ])
      expect(pairs).toEqual([
        [['b-1'], 's-1'],
        [['b-1'], 's-2'],
        [['b-2'], 's-3'],
      ])
      for (const url of calls) expect(url.searchParams.get('hideFinal')).toBeNull()
    })

    it('merges the rows and adds the totals across sprints', async () => {
      get.mockImplementation(async (_n, path) => {
        const sprint = new URL(String(path), 'http://x').searchParams.get('sprintId')
        if (sprint === 's-1') return page([item('1', 'b-1')], 7)
        if (sprint === 's-2') return page([item('2', 'b-1')], 2)
        return page([item('3', 'b-2')], 1)
      })
      const result = await getTasks('sprint', [W1, W2], sprints)
      expect(result.ideas.map((idea) => idea.id)).toEqual(['1', '2', '3'])
      expect(result.totalCount).toBe(10)
    })

    it('caps the merged rows at the page size', async () => {
      get.mockResolvedValue(page([item('a', 'b-1'), item('b', 'b-1')]))
      const result = await getTasks('sprint', [W1], sprints, 3)
      expect(result.ideas).toHaveLength(3)
    })

    it('asks nothing when no work board has an open sprint', async () => {
      const result = await getTasks('sprint', [W1, W2], {})
      expect(get).not.toHaveBeenCalled()
      expect(result.ideas).toEqual([])
      expect(result.totalCount).toBe(0)
    })
  })
})
