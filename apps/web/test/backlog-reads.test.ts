import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '@/lib/api/client'
import { getBacklog, getTaskParentChoices } from '@/lib/data'
import { getBoard, getReferenceContext } from '@/lib/data/boards'
import { actAs } from './support/acting-role'

/**
 * The reads behind a work board's Backlog (TB-1) and its New task parent choices (TB-2). The API
 * client and the board reads are the boundary; what is asserted is the request that goes out and
 * which ideas are offered as parents.
 */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
}))
vi.mock('@/lib/data/boards', async (original) => ({
  ...(await original<typeof import('@/lib/data/boards')>()),
  getBoard: vi.fn(),
  getReferenceContext: vi.fn(),
}))

const get = vi.mocked(apiGet)
const board = vi.mocked(getBoard)
const context = vi.mocked(getReferenceContext)

const item = (id: string, title: string, itemKey: string | null) => ({
  ideaId: id,
  boardId: 'src',
  title,
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
  itemKey,
  parentIdeaId: null,
  taskCounts: null,
  blockedBy: [],
})
const page = (...items: ReturnType<typeof item>[]) => ({
  items,
  page: 1,
  pageSize: 100,
  totalCount: items.length,
})
const urlOf = (call: unknown[]) => new URL(String(call[1]), 'http://x')

beforeEach(() => {
  get.mockReset()
  board.mockReset()
  context.mockReset()
  actAs('OrgAdmin')
})

describe('getBacklog', () => {
  it('asks the board list for items in no sprint with finished work left out', async () => {
    get.mockResolvedValue(page())
    await getBacklog('b-1')
    const url = urlOf(get.mock.calls[0] as unknown[])
    expect(url.pathname).toBe('/boards/b-1/ideas')
    expect(url.searchParams.get('sprintId')).toBe('none')
    expect(url.searchParams.get('hideFinal')).toBe('true')
  })

  it('asks for the newest first at the API maximum, or for one row when only the count is wanted', async () => {
    get.mockResolvedValue(page())
    await getBacklog('b-1')
    await getBacklog('b-1', 1)
    const [full, count] = get.mock.calls.map((call) => urlOf(call as unknown[]))
    expect(full?.searchParams.get('pageSize')).toBe('100')
    expect(full?.searchParams.get('sortBy')).toBe('createdAt')
    expect(full?.searchParams.get('sortDirection')).toBe('desc')
    expect(count?.searchParams.get('pageSize')).toBe('1')
  })

  it('returns the total the API counted, which can exceed the rows sent', async () => {
    get.mockResolvedValue({ ...page(item('t-1', 'One', 'W-1')), totalCount: 250 })
    const result = await getBacklog('b-1')
    expect(result.ideas.map((idea) => idea.id)).toEqual(['t-1'])
    expect(result.totalCount).toBe(250)
  })
})

describe('getTaskParentChoices', () => {
  const lane = (id: string, referencesBoardId: string | null) => ({
    id,
    name: id,
    color: '#111111',
    referencesBoardId,
  })

  it('offers only ideas in the lanes that reference the work board', async () => {
    context.mockResolvedValue({
      choices: [],
      referencedBy: [{ id: 'src', name: 'Ideas' }],
    })
    board.mockResolvedValue({
      id: 'src',
      lanes: [lane('l-plain', null), lane('l-ref', 'work'), lane('l-other', 'elsewhere')],
    } as never)
    get.mockResolvedValue(page(item('i-1', 'Ship it', 'IDEA-1')))

    const choices = await getTaskParentChoices('work')

    expect(choices).toEqual([{ id: 'i-1', itemKey: 'IDEA-1', title: 'Ship it' }])
    const url = urlOf(get.mock.calls[0] as unknown[])
    expect(url.pathname).toBe('/boards/src/ideas')
    expect(url.searchParams.getAll('statusId')).toEqual(['l-ref'])
  })

  it('reads nothing from a referencing board that has no lane pointing at the work board', async () => {
    context.mockResolvedValue({ choices: [], referencedBy: [{ id: 'src', name: 'Ideas' }] })
    board.mockResolvedValue({ id: 'src', lanes: [lane('l-plain', null)] } as never)

    expect(await getTaskParentChoices('work')).toEqual([])
    expect(get).not.toHaveBeenCalled()
  })

  it('offers nothing for a board no lane references', async () => {
    context.mockResolvedValue({ choices: [], referencedBy: [] })
    expect(await getTaskParentChoices('lonely')).toEqual([])
    expect(get).not.toHaveBeenCalled()
  })

  it('joins the choices of every referencing board', async () => {
    context.mockResolvedValue({
      choices: [],
      referencedBy: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    })
    board.mockImplementation((async (id: string) => ({
      id,
      lanes: [lane(`lane-${id}`, 'work')],
    })) as never)
    get.mockImplementation((async (_name: string, path: string) =>
      path.startsWith('/boards/a/')
        ? page(item('i-a', 'From A', null))
        : page(item('i-b', 'From B', 'B-2'))) as never)

    const choices = await getTaskParentChoices('work')
    expect(choices.map((choice) => choice.id).sort()).toEqual(['i-a', 'i-b'])
  })
})
