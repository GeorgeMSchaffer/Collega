/**
 * Hard-coded stand-ins for what Wave D's API will return.
 *
 * Every value here mirrors the demo seed in `demo.md` — two boards per organization, five statuses
 * in canonical order, eleven ideas per board distributed 3/2/2/1/3 — so a screen built against this
 * and the same screen built against the real API should differ only in where the data came from.
 * Nothing else in `apps/web` may invent its own fixtures; when the API lands, this file is the only
 * thing deleted.
 */

export type Role = 'SiteAdmin' | 'OrgAdmin' | 'User' | 'ReadOnly'
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical'

export type CurrentUser = {
  displayName: string
  initials: string
  role: Role
  roleLabel: string
  organizationName: string | null
}

export const currentUser: CurrentUser = {
  displayName: 'Olivia Administer',
  initials: 'OA',
  role: 'OrgAdmin',
  roleLabel: 'Org Admin',
  organizationName: 'Acme Robotics',
}

/** Whether the current role may create or move ideas, and the reason shown when it may not. */
export function writeDenial(role: Role): string | null {
  if (role === 'SiteAdmin') return 'Act as a member'
  if (role === 'ReadOnly') return 'Read-only account'
  return null
}

export type Status = { id: string; name: string; color: string }

/** Canonical order. The colour is the category dot from the comp Q palette. */
export const statuses: Status[] = [
  { id: 'new', name: 'New / Pending', color: 'var(--sky)' },
  { id: 'review', name: 'In Review', color: 'var(--purple)' },
  { id: 'progress', name: 'In Progress', color: 'var(--orange)' },
  { id: 'client', name: 'Client Review', color: 'var(--pink)' },
  { id: 'done', name: 'Complete', color: 'var(--green)' },
]

export type Board = { id: string; name: string; focus: string; ideaCount: number }

export const boards: Board[] = [
  { id: 'ideas', name: 'Ideas', focus: 'Assembly cell reliability', ideaCount: 11 },
  { id: 'opportunities', name: 'Opportunities', focus: 'Field service enablement', ideaCount: 11 },
]

export type Idea = {
  id: string
  boardId: string
  statusId: string
  title: string
  priority: Priority
  tag: string
  assigneeInitials: string | null
  upvotes: number
}

const TITLES = [
  'Reduce manual handoffs',
  'Add proactive alerts',
  'Standardize the intake checklist',
  'Pilot a faster review path',
  'Improve exception visibility',
  'Automate weekly reporting',
  'Create a shared playbook',
  'Validate the customer feedback loop',
  'Roll out the proven workflow',
  'Measure time saved',
  'Retire the legacy step',
]

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical']
const TAGS = ['automation', 'safety', 'quality', 'cycle-time']
const ASSIGNEES = [null, 'NC', 'MC', 'OA']

/** The seed's 3/2/2/1/3 spread across the five statuses, in canonical order. */
const PER_STATUS = [3, 2, 2, 1, 3]

function buildIdeas(boardId: string): Idea[] {
  const out: Idea[] = []
  let index = 0

  PER_STATUS.forEach((count, statusIndex) => {
    for (let n = 0; n < count; n++) {
      const status = statuses[statusIndex]
      const title = TITLES[index]
      if (!status || !title) continue
      out.push({
        id: `${boardId}-${index + 1}`,
        boardId,
        statusId: status.id,
        title,
        priority: PRIORITIES[index % PRIORITIES.length] ?? 'Medium',
        tag: TAGS[index % TAGS.length] ?? 'automation',
        assigneeInitials: ASSIGNEES[index % ASSIGNEES.length] ?? null,
        upvotes: index % 3,
      })
      index++
    }
  })

  return out
}

export const ideas: Idea[] = boards.flatMap((board) => buildIdeas(board.id))

export function ideasForBoard(boardId: string): Idea[] {
  return ideas.filter((idea) => idea.boardId === boardId)
}

export function statusById(id: string): Status | undefined {
  return statuses.find((status) => status.id === id)
}

export function boardById(id: string): Board | undefined {
  return boards.find((board) => board.id === id)
}

export const navCounts = {
  boards: boards.length,
  ideas: ideas.length,
  backlog: 7,
} as const
