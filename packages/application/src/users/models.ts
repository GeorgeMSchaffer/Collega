export type CreateUserCommand = {
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly role: string
  readonly initialPassword: string
  readonly status: string | null
}

export type UpdateUserCommand = {
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly role: string
  readonly status: string
}

export type UserListQuery = {
  readonly page: number | null
  readonly pageSize: number | null
  readonly search: string | null
  readonly role: string | null
  readonly status: string | null
  readonly sortBy: string | null
  readonly sortDirection: string | null
}

/** Shape matches an org-users paged item. */
export type UserListItem = {
  readonly userId: string
  readonly organizationId: string | null
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly role: string
  readonly status: string
}

/** Shape matches `GET /api/v1/organizations/{id}/users` (SPEC/30-Contracts.md "Shared Data
 * Rules"). */
export type UserListResult = {
  readonly items: readonly UserListItem[]
  readonly page: number
  readonly pageSize: number
  readonly totalCount: number
  readonly sortBy: string | null
  readonly sortDirection: string
}

/**
 * Minimal, non-privileged view of an active organization member - id, name, and email only -
 * for the idea assignee picker and mention lookup. Unlike `UserListItem` this carries no role
 * or status and is readable by any authenticated caller in the organization, not only admins
 * (SPEC/20-feature-ideas-and-engagement.md Permissions).
 */
export type OrganizationMember = {
  readonly userId: string
  readonly firstName: string
  readonly lastName: string
  readonly email: string
}

/** Shape matches `GET /api/v1/users/{id}` detail. */
export type UserDetail = {
  readonly userId: string
  readonly organizationId: string | null
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly role: string
  readonly status: string
  readonly mustChangePassword: boolean
  readonly createdAtUtc: Date
  readonly updatedAtUtc: Date
}

/** Shape matches the `POST .../users` create response. */
export type CreateUserResult = {
  readonly userId: string
  readonly organizationId: string
  readonly email: string
  readonly role: string
  readonly status: string
}

/** One parsed CSV row for bulk user import (SPEC/30-Contracts.md user import). Role is optional
 * and defaults to `User`. */
export type UserImportRow = {
  readonly rowNumber: number
  readonly firstName: string | null
  readonly lastName: string | null
  readonly email: string | null
  readonly role: string | null
}

/** Per-row outcome of a bulk import. `outcome` is `created` or `rejected`; `temporaryPassword`
 * is populated only for created rows, `error` only for rejected ones. */
export type UserImportRowResult = {
  readonly rowNumber: number
  readonly email: string | null
  readonly outcome: 'created' | 'rejected'
  readonly error: string | null
  readonly temporaryPassword: string | null
}

/** Result of `POST .../users/import`: created/rejected counts plus per-row outcomes. */
export type UserImportResult = {
  readonly createdCount: number
  readonly rejectedCount: number
  readonly rows: readonly UserImportRowResult[]
}
