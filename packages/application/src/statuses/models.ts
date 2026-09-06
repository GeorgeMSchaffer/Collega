// Command and result shapes for status configuration (SPEC/30-Contracts.md "Status Contracts").
//
// `color`/`sortOrder` are `T | null` rather than optional: the caller (Wave D's controller)
// always builds this object explicitly, normalizing "the request omitted this field" to `null`
// so the service has one shape to branch on instead of `null`-vs-`undefined`.

/**
 * Create a status. `color` and `sortOrder` are optional: color defaults to the organization's
 * neutral status color and sort order appends to the end of the catalog. Both are admin-editable
 * per SPEC/20-feature-boards-and-statuses.md rules #9-10.
 */
export type CreateStatusCommand = {
  readonly name: string
  readonly color: string | null
  readonly sortOrder: number | null
}

export type UpdateStatusCommand = {
  readonly name: string
  readonly color: string | null
  readonly sortOrder: number | null
}

/**
 * Status item shape. The canonical contract lists `statusId`/`organizationId`/`name`/`isDeleted`;
 * `color` and `sortOrder` are included as a superset because rules #9-10 make them first-class
 * status attributes (the contract's Status section predates that resolution).
 */
export type StatusItem = {
  readonly statusId: string
  readonly organizationId: string
  readonly name: string
  readonly color: string
  readonly sortOrder: number
  readonly isDeleted: boolean
}

export type CreateStatusResult = {
  readonly statusId: string
  readonly name: string
  readonly color: string
  readonly sortOrder: number
}
