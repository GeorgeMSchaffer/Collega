import type { Idea, Sprint } from '@/lib/types'

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
