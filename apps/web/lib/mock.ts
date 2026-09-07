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
  // Derived, not a literal: this renders in the sidebar beside the backlog page's own count, so a
  // hard-coded figure disagrees with the list it claims to count.
  get backlog() {
    return backlogIssues().length
  },
}

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
    ideaCount: 22,
  },
  {
    id: 'blue-harbor',
    name: 'Blue Harbor Logistics',
    description: 'Regional freight and warehousing operator.',
    memberCount: 4,
    boardCount: 2,
    ideaCount: 22,
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

// ---------------------------------------------------------------------------
// Delivery fixtures (Wave E6)
// ---------------------------------------------------------------------------

/**
 * Why an administrator-only delivery action is refused.
 *
 * Different wording from `writeDenial`, deliberately: administering a sprint is not the same
 * refusal as "you cannot author an idea". Comp Q offers a Site Admin a route back through View As,
 * and gives a member a flat statement of scope.
 */
export function deliveryAdminDenial(role: Role): string | null {
  if (role === 'SiteAdmin') {
    // A Site Admin belongs to no organization, so `organizationName` is null *by design* — the
    // sidebar and the settings hub both handle that. Naming one here without a fallback printed
    // "Act as an null administrator to change this" on three delivery routes.
    const org = currentUser.organizationName
    return org
      ? `Act as an ${org} administrator to change this`
      : 'Act as an organization administrator to change this'
  }
  if (role === 'User' || role === 'ReadOnly') return 'Administrators only'
  return null
}

/**
 * The fixed delivery status set — `Pending`, `Scoping`, `Development`, `Review`, `Complete`
 * (`SPEC/20-feature-issues-and-delivery.md`).
 *
 * **Not organization-configurable**, unlike ideation statuses, which are. The two systems never
 * mix: ideation statuses govern Discovery, these govern Delivery, and an issue retains both.
 */
export type DeliveryStatus = { id: string; name: string; color: string }

export const deliveryStatuses: DeliveryStatus[] = [
  { id: 'pending', name: 'Pending', color: 'var(--ink-faint)' },
  { id: 'scoping', name: 'Scoping', color: 'var(--purple)' },
  { id: 'development', name: 'Development', color: 'var(--sky)' },
  { id: 'review', name: 'Review', color: 'var(--pink)' },
  { id: 'complete', name: 'Complete', color: 'var(--green)' },
]

export type Effort = 'Low' | 'Medium' | 'High'

export const EFFORT_COLORS: Record<Effort, string | undefined> = {
  Low: undefined,
  Medium: 'var(--teal)',
  High: 'var(--orange)',
}

export type Outcome = { id: string; name: string; color: string; quarter: string }

export const outcomes: Outcome[] = [
  { id: 'reporting', name: 'Cut reporting effort', color: 'var(--sky)', quarter: 'Q3 2026' },
  { id: 'handoffs', name: 'Remove manual handoffs', color: 'var(--teal)', quarter: 'Q3 2026' },
  { id: 'visibility', name: 'Make exceptions visible', color: 'var(--purple)', quarter: 'Q4 2026' },
]

export type Sprint = {
  id: string
  name: string
  goal: string
  startsOn: string
  endsOn: string
  active: boolean
}

export const sprints: Sprint[] = [
  {
    id: 's12',
    name: 'Sprint 12',
    goal: 'Cut weekly reporting effort in half.',
    startsOn: '18 Aug',
    endsOn: '31 Aug 2026',
    active: true,
  },
  {
    id: 's13',
    name: 'Sprint 13',
    goal: 'Close the exception-handling gap.',
    startsOn: '1 Sep',
    endsOn: '14 Sep 2026',
    active: false,
  },
]

/**
 * An Issue **is** the Idea, promoted — the same record carrying its own history and provenance
 * (`SPEC/20-feature-issues-and-delivery.md`), which is why it keeps an upvote snapshot from the
 * moment it was committed.
 *
 * `outcomeId` is nullable and **single-valued**. That is the whole difference from the rejected
 * multi-parent design: with one outcome per issue every roadmap total is a plain count, where a
 * checkbox list would make each total a cover, and covers do not add up.
 */
export type Issue = {
  id: string
  key: string
  title: string
  deliveryStatusId: string
  sprintId: string | null
  outcomeId: string | null
  effort: Effort
  assigneeInitials: string | null
  upvotesAtPromotion: number
}

export const issues: Issue[] = [
  {
    id: 'i1',
    key: 'CLG-114',
    title: 'Automate weekly reporting',
    deliveryStatusId: 'development',
    sprintId: 's12',
    outcomeId: 'reporting',
    effort: 'Medium',
    assigneeInitials: 'MC',
    upvotesAtPromotion: 12,
  },
  {
    id: 'i2',
    key: 'CLG-118',
    title: 'Standardize the intake checklist',
    deliveryStatusId: 'scoping',
    sprintId: 's12',
    outcomeId: 'handoffs',
    effort: 'Low',
    assigneeInitials: 'NC',
    upvotesAtPromotion: 9,
  },
  {
    id: 'i3',
    key: 'CLG-121',
    title: 'Reduce manual handoffs',
    deliveryStatusId: 'development',
    sprintId: 's12',
    outcomeId: 'handoffs',
    effort: 'High',
    assigneeInitials: 'OA',
    upvotesAtPromotion: 8,
  },
  {
    id: 'i4',
    key: 'CLG-125',
    title: 'Improve exception visibility',
    deliveryStatusId: 'review',
    sprintId: 's12',
    outcomeId: 'visibility',
    effort: 'Medium',
    assigneeInitials: 'MC',
    upvotesAtPromotion: 7,
  },
  {
    id: 'i5',
    key: 'CLG-129',
    title: 'Create a shared playbook',
    deliveryStatusId: 'complete',
    sprintId: 's12',
    outcomeId: 'reporting',
    effort: 'Low',
    assigneeInitials: 'NC',
    upvotesAtPromotion: 6,
  },
  {
    id: 'i6',
    key: 'CLG-131',
    title: 'Add proactive alerts',
    deliveryStatusId: 'pending',
    sprintId: null,
    outcomeId: 'visibility',
    effort: 'High',
    assigneeInitials: null,
    upvotesAtPromotion: 11,
  },
  {
    id: 'i7',
    key: 'CLG-134',
    title: 'Pilot a faster review path',
    deliveryStatusId: 'pending',
    sprintId: null,
    outcomeId: 'reporting',
    effort: 'Medium',
    assigneeInitials: null,
    upvotesAtPromotion: 10,
  },
  {
    id: 'i8',
    key: 'CLG-137',
    title: 'Measure time saved',
    deliveryStatusId: 'pending',
    sprintId: null,
    outcomeId: null,
    effort: 'Low',
    assigneeInitials: null,
    upvotesAtPromotion: 5,
  },
  {
    id: 'i9',
    key: 'CLG-140',
    title: 'Retire the legacy step',
    deliveryStatusId: 'pending',
    sprintId: null,
    outcomeId: 'handoffs',
    effort: 'Medium',
    assigneeInitials: null,
    upvotesAtPromotion: 4,
  },
  {
    id: 'i10',
    key: 'CLG-142',
    title: 'Validate the customer feedback loop',
    deliveryStatusId: 'pending',
    sprintId: null,
    outcomeId: null,
    effort: 'Low',
    assigneeInitials: 'OA',
    upvotesAtPromotion: 3,
  },
  {
    id: 'i11',
    key: 'CLG-145',
    title: 'Roll out the proven workflow',
    deliveryStatusId: 'pending',
    sprintId: null,
    outcomeId: 'visibility',
    effort: 'High',
    assigneeInitials: null,
    upvotesAtPromotion: 2,
  },
]

export const activeSprint = sprints.find((sprint) => sprint.active) ?? null

export function issuesInSprint(sprintId: string): Issue[] {
  return issues.filter((issue) => issue.sprintId === sprintId)
}

/** Committed but not yet in a sprint. Most upvoted first, so it reads as the org's own priority. */
export function backlogIssues(): Issue[] {
  return issues
    .filter((issue) => issue.sprintId === null)
    .sort((a, b) => b.upvotesAtPromotion - a.upvotesAtPromotion)
}

export function issueByKey(key: string): Issue | undefined {
  return issues.find((issue) => issue.key.toLowerCase() === key.toLowerCase())
}

export function deliveryStatusById(id: string): DeliveryStatus | undefined {
  return deliveryStatuses.find((status) => status.id === id)
}

export function outcomeById(id: string | null): Outcome | undefined {
  return id ? outcomes.find((outcome) => outcome.id === id) : undefined
}

export function sprintById(id: string | null): Sprint | undefined {
  return id ? sprints.find((sprint) => sprint.id === id) : undefined
}

/** These counts add up precisely because an issue has one outcome. */
export function issuesForOutcome(outcomeId: string): Issue[] {
  return issues.filter((issue) => issue.outcomeId === outcomeId)
}
