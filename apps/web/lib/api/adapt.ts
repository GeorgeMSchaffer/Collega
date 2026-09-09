/**
 * Wire shape in, view shape out.
 *
 * The reconciliation the layer boundary forces (`lib/types.ts` says why) lives here and only here,
 * so a screen never sees a `statusColor` where it expects a `color`, and a rename on the API side
 * is a change to one file rather than to thirty components.
 *
 * Everything in this module is a pure function of its argument — no fetch, no request, no
 * identity — which is what makes it testable without a server.
 */

import { roleLabel } from '../roles'
import type { CurrentUser, Idea, Priority, Role, Status, ViewingAs } from '../types'
import type {
  WireCurrentUser,
  WireIdeaListItem,
  WireStatus,
  WireSwimlane,
  WireViewingAs,
} from './wire'

const ROLES: readonly Role[] = ['SiteAdmin', 'OrgAdmin', 'User', 'ReadOnly']
const PRIORITIES: readonly Priority[] = ['Low', 'Medium', 'High', 'Critical']

/**
 * The wire spells role and priority as free strings. Narrowing them here rather than casting
 * means an unrecognised value fails at the boundary with the value in the message, instead of
 * reaching a `Record<Priority, string>` lookup and rendering `undefined` three components later.
 */
function toRole(value: string): Role {
  const role = ROLES.find((candidate) => candidate === value)
  if (!role) throw new Error(`The API returned an unknown role: ${value}`)
  return role
}

function toPriority(value: string): Priority {
  const priority = PRIORITIES.find((candidate) => candidate === value)
  if (!priority) throw new Error(`The API returned an unknown priority: ${value}`)
  return priority
}

/** First letter of each name, which is what the avatar renders. */
export function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function toViewingAs(wire: WireViewingAs | null): ViewingAs | null {
  if (!wire) return null
  return {
    realUserId: wire.realUserId,
    realUserName: wire.realUserName,
    expiresAtUtc: wire.expiresAtUtc,
  }
}

/**
 * `GET /auth/me` into the principal every gated component reads.
 *
 * `organizationName` is not on the payload — `/auth/me` carries an `organizationId` and no title —
 * so the caller resolves it separately and passes it in. Making it a parameter rather than a second
 * fetch inside this function keeps the module pure and lets the caller decide whether the extra
 * request is worth it: a Site Admin has no organization to look up at all.
 */
export function toCurrentUser(wire: WireCurrentUser, organizationName: string | null): CurrentUser {
  const role = toRole(wire.role)
  return {
    userId: wire.userId,
    displayName: `${wire.firstName} ${wire.lastName}`.trim(),
    initials: initialsOf(wire.firstName, wire.lastName),
    role,
    roleLabel: roleLabel(role),
    organizationId: wire.organizationId,
    organizationName,
    viewingAs: toViewingAs(wire.viewingAs),
  }
}

/** A board's own lane, which carries the status's display fields inline. */
export function swimlaneToStatus(wire: WireSwimlane): Status {
  return { id: wire.statusId, name: wire.statusName, color: wire.statusColor }
}

/** The organization's status catalog, as the settings screens list it. */
export function toStatus(wire: WireStatus): Status {
  return { id: wire.statusId, name: wire.name, color: wire.color }
}

/**
 * A list item into a card.
 *
 * `assignees` is a list on the wire and one avatar on the card: comp Q's `.kcard` shows a single
 * assignee, so the first is taken rather than the card silently growing a row. `tagNames` is
 * narrowed the same way, to `null` when there are none — the fixture always had exactly one tag
 * and the real data frequently has none, which is why `Idea.tag` is nullable now.
 */
export function toIdea(wire: WireIdeaListItem): Idea {
  const assignee = wire.assignees[0]
  return {
    id: wire.ideaId,
    boardId: wire.boardId,
    statusId: wire.statusId,
    title: wire.title,
    priority: toPriority(wire.priority),
    ideaType: wire.ideaTypeName,
    businessImpact: wire.businessImpactName,
    tag: wire.tagNames[0] ?? null,
    assigneeInitials: assignee ? initialsOf(assignee.firstName, assignee.lastName) : null,
    upvotes: wire.upvoteCount,
  }
}
