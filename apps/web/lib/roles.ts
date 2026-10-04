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
  if (role === 'SiteAdmin') return 'Site Admin'
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
