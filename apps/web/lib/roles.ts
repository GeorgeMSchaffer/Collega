/**
 * What a role may do, and the reason shown when it may not.
 *
 * Pure functions of a role and nothing else — no fixture, no request, no `react` import — which is
 * what lets a client component and a server component both call them. `lib/session.ts` is
 * server-only because it reads the request; this is not, and separating the two is what keeps
 * `react`'s `cache` out of the client bundle.
 *
 * These are display decisions, not authorization. The API refuses the same actions on its own and
 * is the only thing that enforces them; these exist so a denied control can say why instead of
 * disappearing.
 */

import { waitingText } from './board-work'
import type { Role } from './types'

export type { Role } from './types'

/** Whether the current role may create or move ideas, and the reason shown when it may not. */
export function writeDenial(role: Role): string | null {
  if (role === 'SiteAdmin') return 'Act as a member'
  if (role === 'ReadOnly') return 'Read-only account'
  return null
}

/**
 * Whether the role may edit, archive or configure an existing board — an administrator's write;
 * creating one is `boardCreateDenial`. A Site Admin is sent to View As as an administrator, not a
 * member: acting as a member (view-as rule 11 gives the target's role) would still be refused.
 */
export function boardAdminDenial(role: Role): string | null {
  if (role === 'OrgAdmin') return null
  if (role === 'SiteAdmin') return 'Act as an organization administrator'
  return 'Administrators only'
}

/**
 * Whether the role may create a board: an Org Admin or a User (`SPEC/decisions.md` 2026-10-04).
 * The same answer as `writeDenial` today, kept separate because the two rules are decided
 * separately. Editing, archiving and lane configuration stay `boardAdminDenial`.
 */
export function boardCreateDenial(role: Role): string | null {
  if (role === 'OrgAdmin' || role === 'User') return null
  if (role === 'SiteAdmin') return 'Act as a member'
  return 'Read-only account'
}

/**
 * Whether the role may add an Issue directly from the Backlog: a User or an Org Admin, the roles of
 * `POST /organizations/{id}/issues` (`20-feature-issues-and-delivery.md` "Backlog: add and edit").
 * A Site Admin is sent to View As, where the role is the target's.
 */
export function issueAddDenial(role: Role): string | null {
  if (role === 'SiteAdmin') return 'Act as a member to add issues. Use View As.'
  if (role === 'ReadOnly') return 'Read Only members cannot add issues.'
  return null
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

/**
 * Whether the role may follow an idea. Read Only may — following is a read; a Site Admin acting as
 * themselves may not, and follows through View As (`20-feature-idea-following.md` rules 8, 46).
 */
export function followDenial(role: Role): string | null {
  if (role === 'SiteAdmin') return 'Follow through View As.'
  return null
}

/** A Site Admin acting as themselves is never a recipient, so has no inbox (rule 32). */
export function hasInbox(role: Role): boolean {
  return role !== 'SiteAdmin'
}

/**
 * Whether the role works inside an organization's boards, ideas and delivery. A Site Admin acting
 * as themselves does not — they reach that content through View As, where the role is the target's
 * — so the workspace links are not offered to them (`SPEC/decisions.md` 2026-10-04).
 */
export function hasOrgWorkspace(role: Role): boolean {
  return role !== 'SiteAdmin'
}

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

/** The role as it is written in the UI. The wire spells it `OrgAdmin`; a person does not. */
export function roleLabel(role: Role): string {
  if (role === 'SiteAdmin') return 'App Admin'
  if (role === 'OrgAdmin') return 'Org Admin'
  if (role === 'ReadOnly') return 'Read Only'
  return 'User'
}

/**
 * Whether the role may delete an idea. Only an Org Admin: a direct Site Admin is refused every
 * write and deletes through View As (`20-feature-ideas-and-engagement.md` "Permissions").
 */
export function mayDeleteIdeas(role: Role): boolean {
  return role === 'OrgAdmin'
}

/**
 * Whether the reader may change an idea's Description, Problem, Proposed solutions and Impact
 * rationale: its author, or an Org Admin (rule 2a). Everyone else who may edit sees them read-only.
 */
export function mayEditIdeaContent(role: Role, userId: string, authorUserId: string | null) {
  return role === 'OrgAdmin' || (authorUserId !== null && userId === authorUserId)
}

/**
 * Who may put tasks in and out of sprints (TB-10, `SPEC/decisions.md` 2026-10-22): anyone who may
 * edit the task - its author or an Org Admin. `null` for Read Only and a direct Site Admin, who
 * never may. A display decision; the API refuses the same writes on its own.
 */
export type Scheduler = { userId: string; isAdmin: boolean }

export function schedulerFor(user: { role: Role; userId: string }): Scheduler | null {
  if (user.role === 'OrgAdmin') return { userId: user.userId, isAdmin: true }
  if (user.role === 'User') return { userId: user.userId, isAdmin: false }
  return null
}

/** Why a task the reader cannot edit stays where it is (the API says the same with a 403). */
export const SCHEDULE_DENIAL = 'Only the task’s author or an Org Admin can put it in a sprint.'

/** Why a selection cannot be scheduled: the first task in it the reader may not edit, or `null`. */
export function scheduleRefusal(
  scheduler: Scheduler | null,
  tasks: readonly { authorUserId: string | null }[],
): string | null {
  return tasks.some((task) => !mayScheduleTask(scheduler, task.authorUserId))
    ? SCHEDULE_DENIAL
    : null
}

/** Whether this scheduler may edit, and so schedule, a task written by `authorUserId`. */
export function mayScheduleTask(scheduler: Scheduler | null, authorUserId: string | null): boolean {
  if (!scheduler) return false
  return scheduler.isAdmin || (authorUserId !== null && authorUserId === scheduler.userId)
}

/**
 * Whether the reader may change an Issue's delivery status or its tasks: its author, an assignee,
 * or an Org Admin (`20-feature-issues-and-delivery.md` "Permissions"). A Read Only account and a
 * direct Site Admin never may.
 */
export function mayWorkOnIssue(
  role: Role,
  userId: string,
  issue: { authorUserId: string; assignees: readonly { id: string }[] },
): boolean {
  if (role === 'OrgAdmin') return true
  if (role !== 'User') return false
  return issue.authorUserId === userId || issue.assignees.some((person) => person.id === userId)
}

/**
 * What Remove from board offers the reader on an idea (`20-feature-board-pull-in.md` rules 5 and 6):
 * `null` when the control is not shown at all - the idea is already in the pool, or the reader is
 * neither its author nor an Org Admin - and otherwise `{ reason }`, `null` when it works. An Issue
 * and an archived board a User may not touch show it disabled, with the reason beside it.
 */
export function detachOffer(
  role: Role,
  userId: string,
  idea: {
    boardId: string | null
    authorUserId: string | null
    /** Only on an idea in a lane that references a board; its open tasks hold it there. */
    taskCounts?: { total: number; done: number } | null
  },
  context: { isIssue: boolean; boardArchived: boolean },
): { reason: string | null; override?: boolean } | null {
  if (idea.boardId === null) return null
  const admin = role === 'OrgAdmin'
  const author = role === 'User' && idea.authorUserId !== null && idea.authorUserId === userId
  if (!admin && !author) return null
  if (context.isIssue) return { reason: 'Issues return to Discovery first.' }
  // The reference-lane lock (`parentHasOpenTasks`): disabled with the lock's text, and an Org
  // Admin is offered the override beside it (comp T screen 4, frame C).
  const open = idea.taskCounts ? Math.max(0, idea.taskCounts.total - idea.taskCounts.done) : 0
  if (open > 0) return { reason: waitingText(open), ...(admin ? { override: true } : {}) }
  if (context.boardArchived && !admin) {
    return { reason: 'Only an Org Admin can remove ideas from an archived board.' }
  }
  return { reason: null }
}
