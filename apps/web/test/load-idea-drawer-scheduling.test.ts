import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadIdeaDrawer } from '@/components/ideas/load-idea-drawer'
import type { Role } from '@/lib/roles'
import { currentUser } from '@/lib/session'
import { actAs } from './support/acting-role'
import { TASKS } from './support/backlog-fixtures'

/**
 * What the idea drawer's Tasks section is handed for "Schedule…" (slice 336, TB-9): each task's
 * sprint read from the work board's card list, and `scheduling` for a reader who may schedule on a
 * sprints-on, non-archived work board (the Backlog only for an Org Admin). The data seam is the boundary.
 */
const mocks = vi.hoisted(() => ({
  work: {} as Record<string, unknown>,
  cards: [] as unknown[],
  getBoardIdeaList: vi.fn(),
  getBacklog: vi.fn(),
  getBoardSprints: vi.fn(),
}))

const LANES = [{ id: 'l-open', name: 'Open', color: '#111111', isFinal: false }]
const board = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: id,
  lanes: LANES,
  isArchived: false,
  sprintsEnabled: true,
  ...over,
})

vi.mock('@/lib/data', () => ({
  getAssistAvailability: async () => false,
  getIssue: async () => null,
  getIdea: async () => ({
    id: 'p-1',
    boardId: 'b-parent',
    parentIdeaId: null,
    statusId: 'l-ref',
    itemKey: null,
    blockedBy: [],
  }),
  getIdeaFormOptions: async () => ({
    members: [{ id: 'u-ada', name: 'Ada Lovelace' }],
    tags: [],
  }),
  getBoard: async (id: string) =>
    id === 'b-parent'
      ? board('b-parent', { lanes: [{ id: 'l-ref', name: 'Build', referencesBoardId: 'b-work' }] })
      : mocks.work,
  getBoardTasks: async () => [
    task('1'),
    task('2'),
    task('3'), // beyond the first page of cards
  ],
  getBoardIdeaList: (...args: unknown[]) => mocks.getBoardIdeaList(...args),
  getBacklog: (...args: unknown[]) => mocks.getBacklog(...args),
  getBoardSprints: (...args: unknown[]) => mocks.getBoardSprints(...args),
}))

const task = (id: string) => ({
  id,
  itemKey: `W-${id}`,
  title: `Task ${id}`,
  statusId: 'l-open',
  statusName: 'Open',
  isFinal: false,
  assignees: [],
  blockedBy: [],
  autoCreated: false,
})

const load = async (role: Role = 'OrgAdmin') => {
  actAs(role)
  const { tasks } = await loadIdeaDrawer({ idea: 'p-1' }, true)
  return tasks
}

beforeEach(() => {
  mocks.work = board('b-work')
  mocks.getBoardIdeaList.mockReset().mockResolvedValue({
    ideas: [{ id: '1', sprint: { id: 's-1', name: 'Sprint 7' } }, { id: '2' }],
  })
  mocks.getBacklog.mockReset().mockResolvedValue({ ideas: TASKS, totalCount: 42 })
  mocks.getBoardSprints.mockReset().mockResolvedValue([
    { id: 's-done', name: 'Sprint 6', state: 'Completed' },
    { id: 's-1', name: 'Sprint 7', state: 'Active' },
    { id: 's-2', name: 'Sprint 8', state: 'Planned' },
  ])
})

describe("loadIdeaDrawer: a task's sprint", () => {
  it("reads each task's sprint from the work board's cards, null when the card has none", async () => {
    const tasks = await load()

    expect(tasks?.tasks.map((t) => t.sprint)).toEqual([
      { id: 's-1', name: 'Sprint 7' },
      null,
      undefined,
    ])
  })

  it("asks for the work board's first page at the API maximum", async () => {
    await load()

    expect(mocks.getBoardIdeaList).toHaveBeenCalledWith(
      'b-work',
      expect.objectContaining({ page: 1, pageSize: 100 }),
    )
  })

  it('leaves a task beyond the first page with no sprint, so the row says nothing and offers no Schedule', async () => {
    const tasks = await load()

    expect('sprint' in (tasks?.tasks[2] ?? {})).toBe(false)
  })

  it('shows sprints to a Read Only reader too, but offers nothing to schedule', async () => {
    const tasks = await load('ReadOnly')

    expect(tasks?.tasks[0]?.sprint).toEqual({ id: 's-1', name: 'Sprint 7' })
    expect(tasks?.scheduling).toBeNull()
  })

  it('reads no sprint data when the work board has sprints off', async () => {
    mocks.work = board('b-work', { sprintsEnabled: false })

    const tasks = await load()

    expect(mocks.getBoardIdeaList).not.toHaveBeenCalled()
    expect(tasks?.tasks.every((t) => !('sprint' in t))).toBe(true)
    expect(tasks?.scheduling).toBeNull()
  })
})

describe('loadIdeaDrawer: scheduling', () => {
  it('gives an Org Admin the open sprints, the Backlog and its total', async () => {
    const tasks = await load()

    expect(tasks?.scheduling).toEqual({
      sprints: [
        { id: 's-1', name: 'Sprint 7', state: 'Active' },
        { id: 's-2', name: 'Sprint 8', state: 'Planned' },
      ],
      canCreate: true,
      backlog: TASKS,
      backlogTotal: 42,
      members: [{ id: 'u-ada', name: 'Ada Lovelace' }],
    })
    expect(mocks.getBacklog).toHaveBeenCalledWith('b-work')
  })

  it('gives a User the open sprints but no Backlog, and marks only the tasks they authored', async () => {
    actAs('User')
    mocks.getBoardIdeaList.mockResolvedValue({
      ideas: [
        { id: '1', authorUserId: currentUser().userId },
        { id: '2', authorUserId: 'someone' },
      ],
    })
    const tasks = await load('User')

    expect(tasks?.scheduling).toMatchObject({ canCreate: false, backlog: [], backlogTotal: 0 })
    expect(tasks?.scheduling?.sprints).toHaveLength(2)
    expect(tasks?.tasks.map((t) => t.mayEdit)).toEqual([true, false, undefined])
    expect(mocks.getBacklog).not.toHaveBeenCalled()
  })

  it('is null for a Read Only reader', async () => {
    expect((await load('ReadOnly'))?.scheduling).toBeNull()
    expect(mocks.getBacklog).not.toHaveBeenCalled()
  })

  it('is null on an archived work board', async () => {
    mocks.work = board('b-work', { isArchived: true })

    expect((await load())?.scheduling).toBeNull()
    expect(mocks.getBacklog).not.toHaveBeenCalled()
  })

  it('is null on a sprints-off work board', async () => {
    mocks.work = board('b-work', { sprintsEnabled: false })

    expect((await load())?.scheduling).toBeNull()
    expect(mocks.getBacklog).not.toHaveBeenCalled()
  })
})
