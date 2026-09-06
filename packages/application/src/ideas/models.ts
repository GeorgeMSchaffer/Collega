import type { IdeaFieldValueInput } from '@collega/domain/ideas'
import type { Page, PageRequest, SortDirection } from '../common/index.js'

// Commands / queries -------------------------------------------------------------------------

/** A raw User-Defined Field value submitted with an idea create/update payload. Field-value
 * resolution/validation itself is B5's (delegated to `IdeaFieldValuesPort`); this is the plain
 * wire shape carried through the command. */
export type IdeaFieldValueWrite = {
  readonly fieldDefinitionId: string
  readonly value: string | null
}

export type CreateIdeaCommand = {
  readonly title: string
  readonly description: string
  readonly priority: string
  readonly ideaTypeId: string
  readonly businessImpactId: string
  readonly dueDate: string | null
  readonly assigneeUserIds: readonly string[] | null
  readonly statusId: string | null
  readonly tagNames: readonly string[] | null
  readonly mentionEmails: readonly string[] | null
  /** Omit (or pass null) to leave the org's default field schema entirely unfilled. */
  readonly fieldValues: readonly IdeaFieldValueWrite[] | null
}

export type UpdateIdeaCommand = {
  readonly title: string
  readonly description: string
  readonly priority: string
  readonly ideaTypeId: string
  readonly businessImpactId: string
  readonly dueDate: string | null
  readonly assigneeUserIds: readonly string[] | null
  readonly tagNames: readonly string[] | null
  readonly mentionEmails: readonly string[] | null
  /** `null`/omitted means "not provided" - existing UDF values are left untouched. Only an
   * explicit (possibly empty) list reconciles them (see `Idea.replaceFieldValues`). */
  readonly fieldValues: readonly IdeaFieldValueWrite[] | null
}

export type ChangeIdeaStatusCommand = {
  readonly statusId: string
}

export type IdeaListQuery = {
  readonly page: number | null
  readonly pageSize: number | null
  readonly search: string | null
  readonly statusId: string | null
  readonly tag: string | null
  readonly priority: string | null
  readonly dueBefore: string | null
  readonly sortBy: string | null
  readonly sortDirection: string | null
}

/** How one `fieldFilters[<id>]=<value>` query entry matches (T059 filter semantics,
 * SPEC/20-feature-user-defined-fields.md). Kept here (not B5's) because it is the shape the org
 * idea list's own query and repository filter agree on - B5 only translates raw strings into it. */
export type IdeaFieldFilterKind =
  | 'contains'
  | 'equals'
  | 'numberRange'
  | 'dateRange'
  | 'multiSelectContains'

export type IdeaFieldValueFilter = {
  readonly fieldDefinitionId: string
  readonly kind: IdeaFieldFilterKind
  readonly value: string | null
  readonly min: string | null
  readonly max: string | null
}

/** Cross-board, organization-scoped idea list for the global `/ideas` page. `scope` is one of
 * `all` / `created` (authored by the current user) / `assigned` (assigned to the current user);
 * anything else is treated as `all`. `tag` filters to ideas carrying a tag with that (normalized)
 * name. `user` is the user-association search-box selection: it matches ideas the given user
 * authored *or* is assigned to (SPEC/Bug Triage.md). */
export type OrganizationIdeaListQuery = {
  readonly page: number | null
  readonly pageSize: number | null
  readonly search: string | null
  readonly scope: string | null
  readonly sortBy: string | null
  readonly sortDirection: string | null
  readonly fieldFilters: ReadonlyMap<string, string> | null
  readonly tag: string | null
  readonly user: string | null
}

// Results / DTOs -------------------------------------------------------------------------------

/** Assignee persona shape shared by the idea list and detail (SPEC/30-Contracts.md). */
export type IdeaAssigneeDto = {
  readonly userId: string
  readonly firstName: string
  readonly lastName: string
  readonly displayName: string
  readonly isActive: boolean
  readonly portraitDataUrl: string | null
}

export type MentionDto = {
  readonly userId: string
  readonly firstName: string
  readonly lastName: string
  readonly displayName: string
  readonly email: string
  readonly portraitDataUrl: string | null
}

export type IdeaCommentDto = {
  readonly commentId: string
  readonly ideaId: string
  readonly authorUserId: string
  readonly body: string
  readonly createdAtUtc: Date
  readonly updatedAtUtc: Date
}

/** A resolved User-Defined Field value on the idea detail (SPEC/20-feature-user-defined-fields.md
 * "IdeaDetailModel extension"). Sourced from B5's `IdeaFieldValuesPort.describeForDetail`. */
export type IdeaFieldValueDto = {
  readonly fieldDefinitionId: string
  readonly fieldName: string
  readonly fieldType: string
  readonly value: string
}

export type IdeaListItem = {
  readonly ideaId: string
  readonly boardId: string
  readonly title: string
  readonly priority: string
  readonly ideaTypeId: string
  readonly ideaTypeName: string
  readonly ideaTypeColorHex: string | null
  readonly ideaTypeIcon: string | null
  readonly businessImpactId: string
  readonly businessImpactName: string
  readonly businessImpactColor: string
  readonly dueDate: string | null
  readonly assignees: readonly IdeaAssigneeDto[]
  readonly tagNames: readonly string[]
  readonly statusId: string
  readonly statusName: string
  readonly upvoteCount: number
  readonly hasUpvoted: boolean
  readonly commentCount: number
  readonly authorUserId: string
  readonly createdAtUtc: Date
}

export type IdeaDetail = {
  readonly ideaId: string
  readonly boardId: string
  readonly title: string
  readonly description: string
  readonly priority: string
  readonly ideaTypeId: string
  readonly ideaTypeName: string
  readonly ideaTypeColorHex: string | null
  readonly ideaTypeIcon: string | null
  readonly businessImpactId: string
  readonly businessImpactName: string
  readonly businessImpactColor: string
  readonly dueDate: string | null
  readonly assignees: readonly IdeaAssigneeDto[]
  readonly statusId: string
  readonly statusName: string
  readonly tagNames: readonly string[]
  readonly mentions: readonly MentionDto[]
  readonly comments: readonly IdeaCommentDto[]
  readonly upvoteCount: number
  readonly hasUpvoted: boolean
  readonly commentCount: number
  readonly fieldValues: readonly IdeaFieldValueDto[]
}

export type CreateIdeaResult = {
  readonly ideaId: string
  readonly boardId: string
  readonly statusId: string
  readonly title: string
  readonly priority: string
  readonly ideaTypeId: string
  readonly businessImpactId: string
  readonly dueDate: string | null
}

/** A page of ideas, echoing the sort actually applied (SPEC/30-Contracts.md "Shared Data Rules"
 * `items`/`page`/`pageSize`/`totalCount`/`sortBy`/`sortDirection`). Built on the kernel's `Page<T>`
 * (`items`/`page`/`pageSize`/`totalCount`) plus the sort echo the wire contract also needs. */
export type IdeaPage<T> = Page<T> & {
  readonly sortBy: string | null
  readonly sortDirection: SortDirection
}

/** `query.page`/`pageSize` arrive as `number | null`; the kernel's `normalizePageRequest` takes
 * `Partial<PageRequest>` and, under `exactOptionalPropertyTypes`, an omitted key and a key
 * present with `undefined` are not interchangeable - so `null` must become "key absent", not
 * "key present with value undefined". */
export function toPageRequestInput(
  page: number | null,
  pageSize: number | null,
): Partial<PageRequest> {
  return {
    ...(page !== null ? { page } : {}),
    ...(pageSize !== null ? { pageSize } : {}),
  }
}

export function normalizeSortDirection(value: string | null | undefined): SortDirection {
  return (value ?? '').trim().toLowerCase() === 'desc' ? 'desc' : 'asc'
}

// CSV import / export --------------------------------------------------------------------------

/** One parsed CSV row for idea import: the raw cell values keyed by lowercased header name, plus
 * the 1-based data-row number for error reporting. */
export type IdeaImportRow = {
  readonly rowNumber: number
  readonly cells: ReadonlyMap<string, string | null>
}

/** Outcome for a single import row. */
export type IdeaImportRowResult = {
  readonly rowNumber: number
  readonly title: string | null
  readonly outcome: 'Created' | 'Rejected'
  readonly error: string | null
}

/** Result of an idea CSV import (create-only): counts plus per-row outcomes. */
export type IdeaImportResult = {
  readonly createdCount: number
  readonly rejectedCount: number
  readonly rows: readonly IdeaImportRowResult[]
}

/** A CSV export as ordered headers plus rows of ordered cell strings. */
export type IdeaCsvExport = {
  readonly headers: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

/** Canonical idea-CSV column keys (lowercased header names) shared by the import parser and the
 * export builder so both agree on the schema. UDF field columns are appended by name. */
export const IdeaCsvColumns = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  ideaType: 'idea type',
  businessImpact: 'business impact',
  status: 'status',
  dueDate: 'due date',
  tags: 'tags',
} as const

/** Core columns in export order: (lowercased key, display header). */
export const IDEA_CSV_CORE_COLUMNS: readonly { readonly key: string; readonly header: string }[] = [
  { key: IdeaCsvColumns.title, header: 'Title' },
  { key: IdeaCsvColumns.description, header: 'Description' },
  { key: IdeaCsvColumns.priority, header: 'Priority' },
  { key: IdeaCsvColumns.ideaType, header: 'Idea Type' },
  { key: IdeaCsvColumns.businessImpact, header: 'Business Impact' },
  { key: IdeaCsvColumns.status, header: 'Status' },
  { key: IdeaCsvColumns.dueDate, header: 'Due Date' },
  { key: IdeaCsvColumns.tags, header: 'Tags' },
]

/** Columns a valid import file must contain. */
export const IDEA_CSV_REQUIRED_KEYS: readonly string[] = [
  IdeaCsvColumns.title,
  IdeaCsvColumns.description,
  IdeaCsvColumns.priority,
  IdeaCsvColumns.ideaType,
  IdeaCsvColumns.businessImpact,
]

const CORE_KEY_SET = new Set(IDEA_CSV_CORE_COLUMNS.map((c) => c.key.toLowerCase()))

/** True when a User-Defined Field name collides with a core column header. Such fields are
 * excluded from CSV export/import so the core column isn't duplicated or overwritten. */
export function isReservedColumn(fieldName: string | null | undefined): boolean {
  const trimmed = fieldName?.trim()
  return !!trimmed && CORE_KEY_SET.has(trimmed.toLowerCase())
}

export type { IdeaFieldValueInput }
