/**
 * What the API actually sends, declared here because it cannot be imported.
 *
 * `apps/web` may import `@collega/design-system` and nothing else from the workspace
 * (`SPEC/50-typescript-migration.md` §4.3, enforced by `biome.json`), so
 * the Application layer's own model modules are out of reach, and these are hand-written mirrors.
 *
 * They are deliberately **structural and narrow**: only the fields a screen reads, typed as they
 * arrive over JSON. `createdAtUtc` is a `Date` on the API's own DTO and a string here, because
 * that is what survives `JSON.stringify`; writing `Date` would be a lie the compiler would believe.
 *
 * Keeping the mirror narrow is what makes it cheap to maintain: a field the UI never reads cannot
 * drift, because it is not written down. The corpus in `tools/golden/fixtures/` pins the real
 * shapes, and `apps/api`'s controllers are the source of truth if these two ever disagree.
 */

/** `GET /auth/me`, and the `user` of a login response. */
export type WireCurrentUser = {
  userId: string
  organizationId: string | null
  role: string
  firstName: string
  lastName: string
  email: string
  status: string
  portraitDataUrl: string | null
  viewingAs: WireViewingAs | null
}

export type WireViewingAs = {
  realUserId: string
  realUserName: string
  startedAtUtc: string
  expiresAtUtc: string
}

/** `POST /auth/login`. No `accessToken`: decision `08` moved it into the httpOnly cookie. */
export type WireLoginResponse = {
  expiresInSeconds: number
  requiresPasswordChange: boolean
  user: WireCurrentUser
}

/** `GET /organizations/{id}`. */
export type WireOrganization = {
  organizationId: string
  title: string
}

/** `GET /organizations/{id}/boards`. */
export type WireBoardListItem = {
  boardId: string
  organizationId: string
  name: string
  allowUserStatusUpdate: boolean
  swimlaneCount: number
  ideaCount: number
}

/** `GET /boards/{id}` — the lanes, in the order the board defines. */
export type WireBoardDetail = {
  boardId: string
  organizationId: string
  name: string
  allowUserStatusUpdate: boolean
  swimlanes: readonly WireSwimlane[]
}

export type WireSwimlane = {
  statusId: string
  statusName: string
  statusColor: string
  order: number
  statusIsDeleted: boolean
}

/** `GET /organizations/{id}/statuses`. */
export type WireStatus = {
  statusId: string
  organizationId: string
  name: string
  color: string
  sortOrder: number
  isDeleted: boolean
}

export type WireIdeaAssignee = {
  userId: string
  firstName: string
  lastName: string
  displayName: string
  isActive: boolean
}

/** `GET /boards/{id}/ideas` and `GET /organizations/{id}/ideas` items. */
export type WireIdeaListItem = {
  ideaId: string
  boardId: string
  title: string
  priority: string
  ideaTypeName: string
  businessImpactName: string
  assignees: readonly WireIdeaAssignee[]
  tagNames: readonly string[]
  statusId: string
  statusName: string
  upvoteCount: number
  commentCount: number
  authorUserId: string
  createdAtUtc: string
}

/**
 * A page of anything, plus the sort the API actually applied.
 *
 * Every list endpoint answers this envelope (`SPEC/30-Contracts.md` "Shared Data Rules"), so
 * `totalCount` is available without pulling a page — which is how a screen asks how many of
 * something there are without transferring any of it.
 */
export type WirePage<T> = {
  items: readonly T[]
  page: number
  pageSize: number
  totalCount: number
}
