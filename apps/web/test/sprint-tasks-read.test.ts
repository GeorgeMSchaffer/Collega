import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '@/lib/api/client'
import { getSprintTasks } from '@/lib/data'
import { actAs } from './support/acting-role'

/** `getSprintTasks`: the planning page's "In this sprint" read (TB-5). The API client is the boundary. */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
}))
const get = vi.mocked(apiGet)
const urlOf = (call: unknown[]) => new URL(String(call[1]), 'http://x')

const card = {
  ideaId: 'i-1',
  boardId: 'b-1',
  title: 'In sprint',
  priority: null,
  ideaTypeName: 'Idea',
  businessImpactName: 'Low',
  assignees: [],
  tagNames: [],
  tags: [],
  effort: null,
  statusId: 'l',
  statusName: 'To do',
  upvoteCount: 0,
  hasUpvoted: false,
  commentCount: 0,
  authorUserId: 'u',
  createdAtUtc: '2026-10-01T00:00:00Z',
  itemKey: 'W-1',
  parentIdeaId: null,
  taskCounts: null,
  blockedBy: [],
}

beforeEach(() => {
  get.mockReset().mockResolvedValue({ items: [], page: 1, pageSize: 100, totalCount: 0 })
  actAs('OrgAdmin')
})

describe('getSprintTasks', () => {
  it('asks the board list for the one sprint’s cards, at the API maximum, oldest first', async () => {
    await getSprintTasks('b-1', 's-9')
    const url = urlOf(get.mock.calls[0] as unknown[])
    expect(url.pathname).toBe('/boards/b-1/ideas')
    expect(url.searchParams.get('sprintId')).toBe('s-9')
    expect(url.searchParams.get('pageSize')).toBe('100')
    expect(url.searchParams.get('sortBy')).toBe('createdAt')
    expect(url.searchParams.get('sortDirection')).toBe('asc')
  })

  it('does not hide finished work: a sprint’s done cards are part of it', async () => {
    await getSprintTasks('b-1', 's-9')
    expect(urlOf(get.mock.calls[0] as unknown[]).searchParams.has('hideFinal')).toBe(false)
  })

  it('escapes the board id in the path', async () => {
    await getSprintTasks('a/b c', 's-9')
    expect(urlOf(get.mock.calls[0] as unknown[]).pathname).toBe('/boards/a%2Fb%20c/ideas')
  })

  it('returns the cards the API listed', async () => {
    get.mockResolvedValue({ items: [card], page: 1, pageSize: 100, totalCount: 1 })
    const page = await getSprintTasks('b-1', 's-9')
    expect(page.ideas.map((idea) => idea.title)).toEqual(['In sprint'])
    expect(page.totalCount).toBe(1)
  })
})
