import type { DeliveryStatus, EffortLevel, IdeaPhase } from '@collega/domain/enums'
import type { IdeaFieldValueInput } from '@collega/domain/ideas'
import type { Page, PageRequest, SortDirection } from '../common/index.js'
import type { IdeaMetric } from '../metric-types/models.js'

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
  /** Optional summary since 2026-09-27; blank or `null` stores none. */
  readonly description: string | null
  readonly problem: string
  readonly proposedSolutions: readonly string[]
  readonly impactRationale: string
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
  /** Optional Discovery-phase estimate (`Low`/`Medium`/`High`); absent or blank stores none. */
  readonly effort?: string | null
}

/** `POST /ideas/{ideaId}/board-tasks`: a task takes only these four. The idea-only fields are not
 * taken; the service stores the organization's default type and impact (Board References Ruling 2)
 * and placeholders where the schema needs a value. */
export type CreateBoardTaskCommand = Pick<
  CreateIdeaCommand,
  'title' | 'description' | 'assigneeUserIds' | 'tagNames'
>

/** `PUT /ideas/{ideaId}` on a task: the same four fields; the idea-only ones are not taken. */
export type UpdateTaskCommand = CreateBoardTaskCommand

/** The card a task is auto-created for on entering an `autoCreateTask` lane. */
export type AutoCreateTaskParent = {
  readonly id: string
  readonly organizationId: string
  readonly title: string
  readonly parentIdeaId: string | null
}

/** `POST /organizations/{organizationId}/ideas`: the create shape without `statusId`, which a pool
 * idea does not choose. */
export type CreatePoolIdeaCommand = Omit<CreateIdeaCommand, 'statusId'>

/** `POST /organizations/{organizationId}/issues`: the pool create's fields plus the promotion's
 * `effort` and `sprintId`. */
export type AddIssueCommand = CreatePoolIdeaCommand & {
  /** Required: `Low`, `Medium` or `High`. */
  readonly effort: string
  /** `null` adds the Issue to the delivery backlog. */
  readonly sprintId: string | null
}

export type UpdateIdeaCommand = {
  readonly title: string
  readonly description: string | null
  readonly problem: string
  readonly proposedSolutions: readonly string[]
  readonly impactRationale: string
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
  /**
   * The optional effort estimate (`Low`/`Medium`/`High`), settable at any time.
   *
   * THREE-STATE, unlike `dueDate`: the key being ABSENT means "not provided, leave it alone", an
   * explicit `null` clears it, and a value sets it. A two-state optional would make every client
   * that predates this field silently clear the estimate on an unrelated edit.
   *
   * Clearing it while the idea sits in a reference lane is refused (`422`,
   * `effortRequiredInReferenceLane`).
   */
  readonly effort?: string | null
}

export type ChangeIdeaStatusCommand = {
  readonly statusId: string
  /** An Org Admin's reason for moving out of a reference lane past open tasks. */
  readonly forceReason?: string | null | undefined
}

// Delivery (Issues-and-Delivery Slice 1) --------------------------------------------------------

export type PromoteIdeaCommand = {
  /** Required at the gate: `Low`, `Medium` or `High`. */
  readonly effort: string
  /** `null` promotes straight to the delivery backlog. */
  readonly sprintId: string | null
  /** Free text recorded on the promotion audit event; it is not stored on the idea. */
  readonly note: string | null
}

export type ChangeDeliveryStatusCommand = {
  readonly deliveryStatus: string
}

export type AssignIssueToSprintCommand = {
  readonly sprintId: string | null
}

/** The sprint board and the delivery backlog. Omit `sprintId` for the backlog (`SprintId is
 * null`); pass one to read that sprint's Issues. */
export type DeliveryListQuery = {
  readonly sprintId: string | null
  readonly deliveryStatus: string | null
}

/** `N of M done` over an Issue's checklist. `done` counts only `Done` tasks - `InProgress` is
 * explicitly not half a point, because a task count must not become a velocity proxy. */
export type IssueTaskSummary = {
  readonly done: number
  readonly total: number
}

export type IssueSprintSummary = {
  readonly sprintId: string
  readonly name: string
  readonly startDate: string
  readonly endDate: string
}

/**
 * Where an Issue came from, which is the whole point of the feature: mid-sprint, "why are we
 * building this?" is answered from the card without leaving the board.
 *
 * `upvoteCountAtPromotion` sits beside the card's live `upvoteCount` deliberately - "42 upvotes
 * when we committed, 61 now" is a different and more useful fact than either number alone.
 */
export type IssueProvenance = {
  readonly promotedAtUtc: Date | null
  readonly promotedByUserId: string | null
  readonly promotedByDisplayName: string | null
  readonly upvoteCountAtPromotion: number | null
}

/** The existing compact card plus the delivery facets. Same shape as an ideation card so the
 * sprint board can reuse the board card as the spec requires. */
export type DeliveryCard = IdeaListItem & {
  readonly phase: IdeaPhase
  readonly deliveryStatus: DeliveryStatus | null
  readonly taskSummary: IssueTaskSummary
  readonly provenance: IssueProvenance
}

/**
 * `statusIds`, `tags` and `priorities` are the repeatable filters of the list pattern
 * (SPEC/30-Contracts.md, 2026-09-27): values of one parameter combine as any-of, different
 * parameters as AND. An empty list is no filter.
 */
export type IdeaListQuery = {
  readonly page: number | null
  readonly pageSize: number | null
  readonly search: string | null
  readonly statusIds: readonly string[]
  readonly tags: readonly string[]
  readonly priorities: readonly string[]
  readonly dueBefore: string | null
  /** Only items in this sprint. */
  readonly sprintId?: string | null | undefined
  /** Only items in no sprint: the board backlog (`sprintId=none`). */
  readonly noSprint?: boolean | undefined
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
  /** Repeatable, any-of within each, AND across them and the rest (2026-09-27). */
  readonly boardIds: readonly string[]
  /** The literal `none` in the `boardId` filter: any-of with `boardIds`, so an idea matches when it
   * is on one of those boards or, with this set, on no board. */
  readonly includeNoBoard: boolean
  readonly statusIds: readonly string[]
  readonly priorities: readonly string[]
  readonly tags: readonly string[]
  readonly user: string | null
  /**
   * `All` (default) / `Ideas` (Discovery only) / `Issues` (Delivery only), so search and
   * provenance span both phases (spec "Board & idea-list phase filtering").
   *
   * Default `All`, NOT `Ideas`: the global list is where somebody goes to find an item they
   * cannot see on a board, and hiding promoted ones there would lose them. The ideation *board*
   * is the surface that filters, and it does so unconditionally.
   */
  readonly phase: string | null
}

// Results / DTOs -------------------------------------------------------------------------------

/**
 * Persona shape for a user attached to an idea (SPEC/30-Contracts.md). Named for the assignees it
 * was introduced for, and also what the detail's `author` and every comment's `author` carry - all
 * three render the same avatar and the same name, so a second shape saying the same thing would
 * only give a client more ways to read a person off one payload.
 */
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
  /**
   * Who wrote it, in the persona shape assignees and the idea's own author use. The thread renders
   * a name and an avatar per comment, and `authorUserId` alone would cost one request per distinct
   * commenter to turn into either.
   *
   * Nullable for the same reason the idea's `author` is: `comments.author_user_id` is `NOT NULL`
   * but carries no foreign key, and the schema is frozen at S0.2. A deactivated commenter is not
   * this case - they are still a row, and come back named with `isActive` false.
   */
  readonly author: IdeaAssigneeDto | null
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

/** One of the idea's own custom fields as the edit form needs it: the `effectiveFields` item shape
 * plus `value`, the stored value in the form the write accepts, or `null` when unset. An option the
 * idea stores that the field no longer offers is listed with `isArchived: true`. */
export type IdeaFormFieldDto = {
  readonly fieldDefinitionId: string
  readonly name: string
  readonly fieldType: string
  readonly isRequired: boolean
  readonly options: readonly IdeaFormFieldOptionDto[]
  readonly value: string | null
}

export type IdeaFormFieldOptionDto = {
  readonly optionId: string
  readonly label: string
  readonly isArchived?: true
}

/** A tag on an idea, with its colour so a chip needs no second request (added 2026-09-28). */
export type IdeaTagDto = {
  readonly tagId: string
  readonly name: string
  readonly color: string
}

export type TaskCounts = { readonly total: number; readonly done: number }

/** A blocker of an item; `isFinal` is true when it sits in a final lane of its board. */
export type BlockedByDto = {
  readonly ideaId: string
  readonly itemKey: string | null
  readonly isFinal: boolean
}

export type IdeaListItem = {
  readonly ideaId: string
  readonly boardId: string | null
  /** `<board keyPrefix>-<itemNumber>`; `null` on a board without a prefix or with no board. */
  readonly itemKey: string | null
  /** Set on a task: the idea it was created from. */
  readonly parentIdeaId: string | null
  /** The parent's `itemKey`; `null` with no parent or when the parent has no key. */
  readonly parentItemKey: string | null
  /** Only on an item whose lane references a board; `done` counts children in a final lane of their own board. */
  readonly taskCounts: TaskCounts | null
  /** The items that must be final before this one can leave its board's first lane. */
  readonly blockedBy: readonly BlockedByDto[]
  readonly title: string
  readonly priority: string | null
  /** The type and impact fields are `null` on an item of a board with idea features off, and on a task. */
  readonly ideaTypeId: string | null
  readonly ideaTypeName: string | null
  readonly ideaTypeColorHex: string | null
  readonly ideaTypeIcon: string | null
  readonly businessImpactId: string | null
  readonly businessImpactName: string | null
  readonly businessImpactColor: string | null
  readonly dueDate: string | null
  readonly assignees: readonly IdeaAssigneeDto[]
  readonly tagNames: readonly string[]
  /** The same tags as `tagNames`, in the same order. */
  readonly tags: readonly IdeaTagDto[]
  readonly effort: EffortLevel | null
  readonly phase: IdeaPhase
  /** The sprint the item is in, for the card's sprint chip. */
  readonly sprint: IssueSprintSummary | null
  readonly statusId: string
  readonly statusName: string
  readonly upvoteCount: number
  readonly hasUpvoted: boolean
  readonly commentCount: number
  readonly authorUserId: string
  readonly createdAtUtc: Date
}

/** One task of a parent idea (`GET /ideas/{ideaId}/board-tasks`). */
export type BoardTaskListItem = {
  readonly ideaId: string
  readonly itemKey: string | null
  readonly title: string
  readonly statusId: string
  readonly statusName: string
  /** The task sits in a final lane of its own board. */
  readonly isFinal: boolean
  readonly assignees: readonly IdeaAssigneeDto[]
  readonly blockedBy: readonly BlockedByDto[]
  /** The system made the task on entry to an `autoCreateTask` lane; `false` for one added by hand. */
  readonly autoCreated: boolean
}

export type IdeaDetail = {
  readonly ideaId: string
  /** The item's metric values; `[]` for a card with a parent (`contracts/metric-types.md`). */
  readonly metrics: readonly IdeaMetric[]
  readonly boardId: string | null
  readonly itemKey: string | null
  /** Set on a task: the idea it was created from. */
  readonly parentIdeaId: string | null
  /** The parent's `itemKey`; `null` with no parent or when the parent has no key. */
  readonly parentItemKey: string | null
  /** Only on an item whose lane references a board; `done` counts children in a final lane of their own board. */
  readonly taskCounts: TaskCounts | null
  /** The items that must be final before this one can leave its board's first lane. */
  readonly blockedBy: readonly BlockedByDto[]
  readonly title: string
  readonly problem: string | null
  readonly proposedSolutions: readonly string[]
  readonly impactRationale: string | null
  readonly description: string | null
  readonly priority: string | null
  /** The type and impact fields are `null` on an item of a board with idea features off, and on a task. */
  readonly ideaTypeId: string | null
  readonly ideaTypeName: string | null
  readonly ideaTypeColorHex: string | null
  readonly ideaTypeIcon: string | null
  readonly businessImpactId: string | null
  readonly businessImpactName: string | null
  readonly businessImpactColor: string | null
  readonly dueDate: string | null
  /** `null` on a task. */
  readonly effort: EffortLevel | null
  readonly assignees: readonly IdeaAssigneeDto[]
  readonly statusId: string
  readonly statusName: string
  readonly tagNames: readonly string[]
  /** The same tags as `tagNames`, in the same order. */
  readonly tags: readonly IdeaTagDto[]
  readonly mentions: readonly MentionDto[]
  readonly comments: readonly IdeaCommentDto[]
  readonly upvoteCount: number
  readonly hasUpvoted: boolean
  /** The caller's own follow state (SPEC/contracts/ideas.md, added 2026-10-01). */
  readonly isFollowing: boolean
  readonly followerCount: number
  readonly commentCount: number
  readonly fieldValues: readonly IdeaFieldValueDto[]
  readonly formFields: readonly IdeaFormFieldDto[]
  /**
   * Who raised it, as the full persona rather than the bare `authorUserId` the list item carries:
   * the detail header renders a name, and an id there would cost a second request per idea opened.
   *
   * Nullable because nothing guarantees the row. `ideas.author_user_id` is `NOT NULL` but carries
   * no foreign key (the schema is frozen at S0.2, so this is not something to add here), and no
   * code path deletes a user - so in practice it is always populated, and a client that finds it
   * null is looking at data damage rather than at an ordinary case to design a label for.
   */
  readonly author: IdeaAssigneeDto | null
  readonly createdAtUtc: Date
}

export type CreateIdeaResult = {
  readonly ideaId: string
  readonly boardId: string | null
  readonly itemKey: string | null
  readonly parentIdeaId: string | null
  readonly statusId: string
  readonly title: string
  readonly priority: string | null
  /** `null` on a board task: the stored default is not exposed. */
  readonly ideaTypeId: string | null
  readonly businessImpactId: string | null
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
  problem: 'problem',
  proposedSolutions: 'proposed solutions',
  impactRationale: 'impact rationale',
  priority: 'priority',
  ideaType: 'idea type',
  businessImpact: 'business impact',
  status: 'status',
  dueDate: 'due date',
  tags: 'tags',
} as const

/**
 * The unspaced spellings SPEC/20-feature-ideas-and-engagement.md's CSV Import table uses
 * (`ProposedSolutions`, `ImpactRationale`), accepted on import alongside the spaced headers the
 * export writes (`SPEC/30-Contracts.md`), so a file written to either document imports.
 */
export const IDEA_CSV_IMPORT_ALIASES: Readonly<Record<string, string>> = {
  proposedsolutions: IdeaCsvColumns.proposedSolutions,
  impactrationale: IdeaCsvColumns.impactRationale,
}

/** Core columns in export order: (lowercased key, display header). */
export const IDEA_CSV_CORE_COLUMNS: readonly { readonly key: string; readonly header: string }[] = [
  { key: IdeaCsvColumns.title, header: 'Title' },
  { key: IdeaCsvColumns.description, header: 'Description' },
  { key: IdeaCsvColumns.problem, header: 'Problem' },
  { key: IdeaCsvColumns.proposedSolutions, header: 'Proposed Solutions' },
  { key: IdeaCsvColumns.impactRationale, header: 'Impact Rationale' },
  { key: IdeaCsvColumns.priority, header: 'Priority' },
  { key: IdeaCsvColumns.ideaType, header: 'Idea Type' },
  { key: IdeaCsvColumns.businessImpact, header: 'Business Impact' },
  { key: IdeaCsvColumns.status, header: 'Status' },
  { key: IdeaCsvColumns.dueDate, header: 'Due Date' },
  { key: IdeaCsvColumns.tags, header: 'Tags' },
]

/** Columns a valid import file must contain. `Description` left this list on 2026-09-27. */
export const IDEA_CSV_REQUIRED_KEYS: readonly string[] = [
  IdeaCsvColumns.title,
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

/** One audit event on an idea, as the activity read answers it. */
export type IdeaActivityEntry = {
  readonly eventType: string
  readonly message: string
  readonly occurredAtUtc: Date
  readonly actorUserId: string | null
  readonly onBehalfOfUserId: string | null
  /** The stored metadata object, or `null` when none or not an object. */
  readonly metadata: Readonly<Record<string, unknown>> | null
}
