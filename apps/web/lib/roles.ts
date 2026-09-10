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
 * Whether the role may engage - vote and comment - which is a different question from whether it
 * may edit. A Read Only account deliberately keeps engagement; a Site Admin has neither, being
 * outside the organization entirely.
 */
export function engagementDenial(role: Role): string | null {
  if (role === 'SiteAdmin') return 'Not a member of this organization'
  return null
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
