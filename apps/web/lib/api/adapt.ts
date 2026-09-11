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
import type {
  Comment,
  CurrentUser,
  FieldDefinition,
  Idea,
  IdeaDetail,
  IdeaType,
  Person,
  Priority,
  Profile,
  Role,
  Status,
  ViewingAs,
} from '../types'
import type {
  WireCurrentUser,
  WireFieldDefinition,
  WireIdeaAssignee,
  WireIdeaComment,
  WireIdeaDetail,
  WireIdeaListItem,
  WireIdeaType,
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
 * The organization's title rides on the payload (`SPEC/decisions.md` 2026-09-10), so this is a pure
 * rename and needs no second request. `null` means "belongs to no organization" — a Site Admin —
 * and nothing else, which is what lets the sidebar branch on it rather than guess.
 */
export function toCurrentUser(wire: WireCurrentUser): CurrentUser {
  const role = toRole(wire.role)
  return {
    userId: wire.userId,
    displayName: `${wire.firstName} ${wire.lastName}`.trim(),
    initials: initialsOf(wire.firstName, wire.lastName),
    role,
    roleLabel: roleLabel(role),
    organizationId: wire.organizationId,
    organizationName: wire.organizationTitle,
    viewingAs: toViewingAs(wire.viewingAs),
  }
}

/**
 * The same payload again, as the profile form's fields rather than as the principal.
 *
 * Untrimmed on purpose: these are what the form posts straight back to `PUT /auth/me`, and the API
 * trims on the way in (`SPEC/30-Contracts.md`). Trimming here as well would show a name the stored
 * one does not match if a trailing space ever reached the column.
 */
export function toProfile(wire: WireCurrentUser): Profile {
  return { firstName: wire.firstName, lastName: wire.lastName, email: wire.email }
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
 * An idea type as its settings row renders it.
 *
 * `Curated` is the only mode with a countable selection. `AllActiveFields` means the type shows
 * every active field in the organization, which is not a number this payload knows — and is not
 * zero, which is what `fields.length` would say. `null` is the distinction; `lib/types.ts` says why
 * the row needs it.
 */
export function toIdeaType(wire: WireIdeaType): IdeaType {
  return {
    id: wire.ideaTypeId,
    name: wire.name,
    curatedFieldCount: wire.fieldMode === 'Curated' ? wire.fields.length : null,
  }
}

/**
 * A field definition, plus the idea types that ask for it.
 *
 * The mapping is owned by the type, so the answer is assembled from the type catalog rather than
 * read off the field. A `Curated` type asks for exactly what it selected; an `AllActiveFields` one
 * asks for every active field there is, so it names itself against all of them — that is the rule
 * `SPEC/30-Contracts.md` states for the mode, and reading it as "selected nothing" would print an
 * empty cell for a type that in fact shows the field.
 */
export function toFieldDefinition(
  wire: WireFieldDefinition,
  ideaTypes: readonly WireIdeaType[],
): FieldDefinition {
  return {
    id: wire.fieldDefinitionId,
    name: wire.name,
    fieldType: wire.fieldType,
    required: wire.isRequired,
    usedBy: ideaTypes
      .filter(
        (type) =>
          type.fieldMode !== 'Curated' ||
          type.fields.some((field) => field.fieldDefinitionId === wire.fieldDefinitionId),
      )
      .map((type) => type.name),
  }
}

/**
 * The date as comp P writes it in the inspector byline: `Aug 15, 2026`.
 *
 * Fixed to UTC and to `en-US`, because the alternative is a date that renders one way on the server
 * and another in the reader's browser — a hydration mismatch — and a "created on" that silently
 * shifts a day for anyone west of Greenwich.
 */
const DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function toPerson(wire: WireIdeaAssignee | null): Person | null {
  if (!wire) return null
  return {
    name: wire.displayName,
    initials: initialsOf(wire.firstName, wire.lastName),
  }
}

function toComment(wire: WireIdeaComment): Comment {
  return {
    id: wire.commentId,
    author: toPerson(wire.author),
    postedOn: DATE.format(new Date(wire.createdAtUtc)),
    body: wire.body,
  }
}

/**
 * `GET /ideas/{id}` into what the inspector renders.
 *
 * Built on `toIdea`'s shape rather than beside it, so a card and the panel it opens cannot disagree
 * about the same idea's priority, tag or assignee. The detail's extra fields are the prose, the
 * provenance and the thread — and no reference, which has no source; `lib/types.ts` says why.
 */
export function toIdeaDetail(wire: WireIdeaDetail): IdeaDetail {
  const assignee = wire.assignees[0]
  return {
    id: wire.ideaId,
    boardId: wire.boardId,
    statusId: wire.statusId,
    statusName: wire.statusName,
    title: wire.title,
    priority: toPriority(wire.priority),
    ideaType: wire.ideaTypeName,
    businessImpact: wire.businessImpactName,
    tag: wire.tagNames[0] ?? null,
    assigneeInitials: assignee ? initialsOf(assignee.firstName, assignee.lastName) : null,
    upvotes: wire.upvoteCount,
    hasUpvoted: wire.hasUpvoted,
    description: wire.description,
    author: toPerson(wire.author),
    createdOn: DATE.format(new Date(wire.createdAtUtc)),
    comments: wire.comments.map(toComment),
  }
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
    statusName: wire.statusName,
    title: wire.title,
    priority: toPriority(wire.priority),
    ideaType: wire.ideaTypeName,
    businessImpact: wire.businessImpactName,
    tag: wire.tagNames[0] ?? null,
    assigneeInitials: assignee ? initialsOf(assignee.firstName, assignee.lastName) : null,
    upvotes: wire.upvoteCount,
    hasUpvoted: wire.hasUpvoted,
  }
}
