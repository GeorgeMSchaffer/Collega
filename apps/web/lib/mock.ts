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

/**
 * Priority has its own colour scale, independent of status.
 *
 * Comp Q keys every dot to the label beside it, which is what lets the same palette token mean
 * different things in different markers. Colouring a priority dot by status breaks that: inside one
 * lane every card would show the same dot, and a `--purple` dot labelled "High" would sit next to a
 * lane where `--purple` means "In Review". Low is deliberately uncoloured.
 */
export const PRIORITY_COLORS: Record<Priority, string | undefined> = {
  Critical: 'var(--orange)',
  High: 'var(--sky)',
  Medium: 'var(--teal)',
  Low: undefined,
}

export type Status = { id: string; name: string; color: string; colorName: string }

/** Canonical order. The colour is the category dot from the comp Q palette. */
export const statuses: Status[] = [
  { id: 'new', name: 'New / Pending', color: 'var(--sky)', colorName: 'Sky' },
  { id: 'review', name: 'In Review', color: 'var(--purple)', colorName: 'Purple' },
  { id: 'progress', name: 'In Progress', color: 'var(--orange)', colorName: 'Orange' },
  { id: 'client', name: 'Client Review', color: 'var(--pink)', colorName: 'Pink' },
  { id: 'done', name: 'Complete', color: 'var(--green)', colorName: 'Green' },
]

/** Blue Harbor runs its own workflow. Comp Q's cross-org list is distinct rows, not a cross-product. */
export const statusesByOrganization: Record<string, Status[]> = {
  'acme-robotics': statuses,
  'blue-harbor': [
    { id: 'intake', name: 'Intake', color: 'var(--pink)', colorName: 'Pink' },
    { id: 'scheduled', name: 'Scheduled', color: 'var(--teal)', colorName: 'Teal' },
    { id: 'dispatched', name: 'Dispatched', color: 'var(--orange)', colorName: 'Orange' },
    { id: 'signed-off', name: 'Signed off', color: 'var(--green)', colorName: 'Green' },
  ],
}

export type Board = { id: string; name: string; focus: string; ideaCount: number }

export const boards: Board[] = [
  { id: 'ideas', name: 'Ideas', focus: 'Assembly cell reliability', ideaCount: 11 },
  { id: 'opportunities', name: 'Opportunities', focus: 'Field service enablement', ideaCount: 11 },
]

export type Idea = {
  id: string
  reference: string
  boardId: string
  statusId: string
  title: string
  description: string
  priority: Priority
  ideaType: string
  businessImpact: string
  tag: string
  assigneeInitials: string | null
  authorName: string
  createdOn: string
  upvotes: number
}

export type Comment = {
  id: string
  ideaId: string
  authorName: string
  authorInitials: string
  postedOn: string
  body: string
}

const DESCRIPTIONS = [
  'Map the current handoffs and automate the highest-friction transition.',
  'Notify the responsible team before a preventable delay becomes customer-visible.',
  'Use one concise checklist so requests arrive complete and ready for action.',
  'Trial a lightweight review path for low-risk changes and measure cycle time.',
  'Surface recurring exceptions with enough context for rapid ownership.',
  'Generate the weekly operating summary from source data instead of spreadsheets.',
  'Capture the approved response steps and escalation points in one maintained playbook.',
  'Close the loop with requesters and record whether the change solved the problem.',
  'Extend the successful pilot to the remaining teams with clear adoption measures.',
  'Compare the new workflow with the baseline and publish the verified time savings.',
  'Remove the superseded process step after confirming all dependencies have moved.',
]

const IDEA_TYPES = ['Process Revision', 'Continuous Improvement']
const IMPACTS = ['Critical', 'High', 'Medium', 'Low']
const AUTHORS = ['Noah Contributor', 'Maya Collaborator', 'Olivia Administer']

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
        // Human-facing reference, the way the comps label an idea in the inspector eyebrow.
        reference: `IDEA-${100 + (boardId === 'ideas' ? 0 : 50) + index + 1}`,
        boardId,
        statusId: status.id,
        title,
        description: DESCRIPTIONS[index] ?? '',
        priority: PRIORITIES[index % PRIORITIES.length] ?? 'Medium',
        ideaType: IDEA_TYPES[index % IDEA_TYPES.length] ?? 'Process Revision',
        businessImpact: IMPACTS[index % IMPACTS.length] ?? 'Medium',
        tag: TAGS[index % TAGS.length] ?? 'automation',
        assigneeInitials: ASSIGNEES[index % ASSIGNEES.length] ?? null,
        authorName: AUTHORS[index % AUTHORS.length] ?? 'Noah Contributor',
        // Fixed dates, not Date.now(): a screenshot taken tomorrow must look the same as today's.
        createdOn: `2026-08-${String(10 + (index % 18)).padStart(2, '0')}`,
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

export function ideaById(id: string): Idea | undefined {
  return ideas.find((idea) => idea.id === id)
}

/** Three comments on the first two ideas of each board, matching the seed's shape. */
const COMMENT_SEED: ReadonlyArray<
  readonly [offset: number, author: string, initials: string, body: string]
> = [
  [0, 'Maya Collaborator', 'MC', "Thanks for raising this - I'll take a first look."],
  [0, 'Olivia Administer', 'OA', "Agreed, let's prioritize it for the next review."],
  [1, 'Noah Contributor', 'NC', 'Following along - this would help my team too.'],
]

export const comments: Comment[] = boards.flatMap((board) =>
  COMMENT_SEED.flatMap(([offset, authorName, authorInitials, body], n) => {
    const idea = ideasForBoard(board.id)[offset]
    if (!idea) return []
    return [
      {
        id: `${board.id}-c${n}`,
        ideaId: idea.id,
        authorName,
        authorInitials,
        postedOn: `2026-09-0${n + 1}`,
        body,
      },
    ]
  }),
)

export function commentsForIdea(ideaId: string): Comment[] {
  return comments.filter((comment) => comment.ideaId === ideaId)
}

/**
 * Whether the role may engage - vote and comment - which is a different question from whether it
 * may edit. A Read Only account deliberately keeps engagement; a Site Admin has neither, being
 * outside the organization entirely.
 */
export function engagementDenial(role: Role): string | null {
  if (role === 'SiteAdmin') return 'Not a member of this organization'
  return null
}

export const navCounts = {
  boards: boards.length,
  ideas: ideas.length,
  backlog: 7,
} as const

// ---------------------------------------------------------------------------
// Administration fixtures (Wave E5)
// ---------------------------------------------------------------------------

/**
 * Whether the role may reach the administration routes at all.
 *
 * This is a **page-level** gate, not a control-level one, and it reads differently on purpose: a
 * denied control stays visible with its reason beside it, but an entire route closed to a role
 * shows the "Administrators only" panel instead. Comp Q states why — "nothing here is hidden from
 * you selectively; the whole page is out of scope for your role" — which is a promise that the
 * page is not quietly showing a member a reduced version of the same screen.
 */
export function isAdministrator(role: Role): boolean {
  return role === 'SiteAdmin' || role === 'OrgAdmin'
}

export type Organization = {
  id: string
  name: string
  description: string
  memberCount: number
  boardCount: number
  ideaCount: number
}

export const organizations: Organization[] = [
  {
    id: 'acme-robotics',
    name: 'Acme Robotics',
    description: 'Industrial robotics and automation manufacturer.',
    memberCount: 4,
    boardCount: 2,
    ideaCount: 11,
  },
  {
    id: 'blue-harbor',
    name: 'Blue Harbor Logistics',
    description: 'Regional freight and warehousing operator.',
    memberCount: 4,
    boardCount: 2,
    ideaCount: 11,
  },
]

export type Member = {
  id: string
  displayName: string
  initials: string
  email: string
  organizationId: string
  organizationName: string
  role: Role
  roleLabel: string
  status: 'Active' | 'Inactive'
}

const ROLE_SEED: ReadonlyArray<readonly [string, string, string, Role, string]> = [
  ['Olivia Administer', 'OA', 'orgadmin', 'OrgAdmin', 'Org Admin'],
  ['Noah Contributor', 'NC', 'user', 'User', 'User'],
  ['Maya Collaborator', 'MC', 'user2', 'User', 'User'],
  ['Rosa Observer', 'RO', 'readonly', 'ReadOnly', 'Read Only'],
]

/** The demo seed: four accounts per organization, one per role. See `demo.md`. */
export const members: Member[] = organizations.flatMap((org) =>
  ROLE_SEED.map(([displayName, initials, localPart, role, roleLabel], n) => ({
    id: `${org.id}-u${n + 1}`,
    displayName,
    initials,
    email: `${localPart}@${org.id}.demo.collega.test`,
    organizationId: org.id,
    organizationName: org.name,
    role,
    roleLabel,
    status: 'Active' as const,
  })),
)

export function membersForOrganization(organizationId: string): Member[] {
  return members.filter((member) => member.organizationId === organizationId)
}

export type IdeaType = {
  id: string
  name: string
  organizationId: string
  description: string
  fieldCount: number
  ideaCount: number
}

export const ideaTypes: IdeaType[] = [
  {
    id: 'process-revision',
    name: 'Process Revision',
    organizationId: 'acme-robotics',
    description: 'A change to how an existing process runs.',
    fieldCount: 2,
    ideaCount: 12,
  },
  {
    id: 'continuous-improvement',
    name: 'Continuous Improvement',
    organizationId: 'acme-robotics',
    description: 'An incremental gain against a current baseline.',
    fieldCount: 1,
    ideaCount: 10,
  },
  {
    id: 'route-change',
    name: 'Route Change',
    organizationId: 'blue-harbor',
    description: 'A change to a scheduled delivery route.',
    fieldCount: 1,
    ideaCount: 7,
  },
]

export type FieldDefinition = {
  id: string
  name: string
  organizationId: string
  fieldType: 'Text' | 'Number' | 'Date' | 'Choice' | 'Checkbox'
  required: boolean
  ideaTypeNames: string[]
}

export const fieldDefinitions: FieldDefinition[] = [
  {
    id: 'f1',
    name: 'Current cycle time',
    organizationId: 'acme-robotics',
    fieldType: 'Number',
    required: true,
    ideaTypeNames: ['Process Revision'],
  },
  {
    id: 'f2',
    name: 'Affected team',
    organizationId: 'acme-robotics',
    fieldType: 'Choice',
    required: true,
    ideaTypeNames: ['Process Revision', 'Continuous Improvement'],
  },
  {
    id: 'f3',
    name: 'Target date',
    organizationId: 'acme-robotics',
    fieldType: 'Date',
    required: false,
    ideaTypeNames: ['Process Revision'],
  },
  {
    id: 'f4',
    name: 'Depot',
    organizationId: 'blue-harbor',
    fieldType: 'Choice',
    required: true,
    ideaTypeNames: ['Route Change'],
  },
]
