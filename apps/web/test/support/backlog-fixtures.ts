import type { Idea, Sprint } from '@/lib/types'

/** A Backlog task as the API lists it; shared by the sprint-planning tests. */
export const task = (id: string, over: Partial<Idea> = {}): Idea => ({
  id,
  boardId: 'b-1',
  authorUserId: 'u-ada',
  statusId: 'l-1',
  statusName: 'To do',
  title: `Task ${id}`,
  priority: null,
  ideaType: 'Idea',
  businessImpact: 'Low',
  tag: null,
  tags: [],
  assigneeInitials: null,
  assignees: [],
  upvotes: 0,
  hasUpvoted: false,
  effort: null,
  itemKey: `W-${id}`,
  parentIdeaId: null,
  taskCounts: null,
  blockedBy: [],
  ...over,
})

/** Two tasks of IDEA-7, one of IDEA-8, one standalone; the second of IDEA-7 is blocked. */
export const TASKS: Idea[] = [
  task('1', { title: 'Standalone chore' }),
  task('2', { title: 'Seven alpha', parentIdeaId: 'p-7', parentItemKey: 'IDEA-7' }),
  task('3', {
    title: 'Seven beta',
    parentIdeaId: 'p-7',
    parentItemKey: 'IDEA-7',
    blockedBy: [{ ideaId: 'x', itemKey: 'W-9', isFinal: false }],
  }),
  task('4', { title: 'Eight alpha', parentIdeaId: 'p-8', parentItemKey: 'IDEA-8' }),
]

/** Shared builders for the Backlog list and its board side panel (TB-1, TB-7). */
export const BACKLOG_LANES = [
  { id: 'todo', name: 'To do', color: '#111111', isFinal: false },
  { id: 'doing', name: 'Doing', color: '#333333', isFinal: false },
  { id: 'done', name: 'Done', color: '#222222', isFinal: true },
]

export const backlogTask = (id: string, over: Partial<Idea> = {}): Idea => ({
  id,
  boardId: 'b-1',
  authorUserId: 'u-ada',
  statusId: 'todo',
  statusName: 'To do',
  title: `Task ${id}`,
  priority: null,
  ideaType: 'Idea',
  businessImpact: 'Low',
  tag: null,
  tags: [],
  assigneeInitials: null,
  assignees: [],
  upvotes: 0,
  hasUpvoted: false,
  effort: null,
  itemKey: `W-${id}`,
  parentIdeaId: null,
  taskCounts: null,
  blockedBy: [],
  ...over,
})

export const sprint = (id: string, state: Sprint['state'], name = `Sprint ${id}`): Sprint => ({
  id,
  name,
  goal: null,
  startsOn: '1 Oct',
  endsOn: '14 Oct',
  startDate: '2026-10-01',
  endDate: '2026-10-14',
  window: '1–14 OCT',
  state,
  issueCount: 0,
  doneCount: 0,
})
