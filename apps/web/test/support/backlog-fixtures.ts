import type { Idea } from '@/lib/types'

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
