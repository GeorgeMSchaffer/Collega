import type {
  DeliveryStatus,
  IdeaPhase,
  Priority,
  Role,
  SprintState,
  UserStatus,
} from '@collega/domain/enums'
import type { Idea, IdeaFieldValueInput } from '@collega/domain/ideas'
import type { PageRequest, SortDirection } from '../common/index.js'
import type { IdeaFieldValueFilter, IdeaFieldValueWrite, IdeaPage } from './models.js'

// Persistence --------------------------------------------------------------------------------

export type IdeaListFilter = {
  readonly boardId: string
  readonly page: PageRequest
  readonly search: string | null
  readonly statusId: string | null
  readonly tag: string | null
  readonly priority: Priority | null
  readonly dueBefore: string | null
  /**
   * `Discovery` for every ideation-board read (spec "Board & idea-list phase filtering"): a
   * promoted item leaves the board without losing its row or its ideation status. `null` means
   * both phases, which nothing on the board path asks for.
   */
  readonly phase: IdeaPhase | null
  /**
   * TOTAL ORDER IS MANDATORY. A golden-capture finding: four list endpoints ordered by something
   * that ties, broken only by a generated id - stable inside one deployment but not reproducible
   * across a fresh seed, so under paging the tie-break silently decided what was on a page.
   *
   * The repository implementation (Wave C) MUST tie-break the requested `sortBy` on
   * `createdAtUtc` then `title` (both ascending). NEVER tie-break on id.
   */
  readonly sortBy: string | null
  readonly sortDirection: SortDirection
}

export type OrganizationIdeaListFilter = {
  readonly organizationId: string
  readonly createdByUserId: string | null
  readonly assignedToUserId: string | null
  readonly page: PageRequest
  readonly search: string | null
  readonly sortBy: string | null
  readonly sortDirection: SortDirection
  readonly fieldFilters: readonly IdeaFieldValueFilter[]
  readonly searchTextFieldIds: readonly string[]
  readonly tag: string | null
  readonly associatedUserId: string | null
  /** Set only when `search` parses as an ISO `yyyy-MM-dd` date: additionally matches ideas
   * created on that (UTC) calendar day. */
  readonly searchCreatedOnDate: string | null
  /** `null` (the default) spans both phases - see `OrganizationIdeaListQuery.phase`. */
  readonly phase: IdeaPhase | null
  /**
   * TOTAL ORDER IS MANDATORY here too - see `IdeaListFilter.sortBy` above for the finding and the
   * required tie-break (`createdAtUtc` then `title`, never id). Repeated rather than cross-
   * referenced only in prose so it is not missable from this type alone.
   */
}

export type IdeaFieldValueSnapshot = {
  readonly ideaId: string
  readonly fieldDefinitionId: string
  readonly value: string | null
}

export interface IdeaRepository {
  /** Soft-deleted ideas are excluded unless `includeDeleted` is set (rule #11). */
  getById(ideaId: string, includeDeleted?: boolean): Promise<Idea | null>

  add(idea: Idea): Promise<void>

  /** Persists every mutable aspect of an already-loaded idea: core fields, assignees, mentions,
   * tag ids and field values. */
  update(idea: Idea): Promise<void>

  /** Paged, filtered idea list for one board, excluding soft-deleted ideas. */
  listByBoard(filter: IdeaListFilter): Promise<IdeaPage<Idea>>

  /** Paged, filtered idea list across every board in one organization, excluding soft-deleted
   * ideas (SPEC/20-feature-client-ui-revisions.md "Ideas Page"). */
  listByOrganization(filter: OrganizationIdeaListFilter): Promise<IdeaPage<Idea>>

  /** User-Defined Field values for a set of ideas, for bulk projection such as CSV export. Empty
   * when no ids are given. */
  getFieldValuesByIdeaIds(ideaIds: readonly string[]): Promise<readonly IdeaFieldValueSnapshot[]>

  /**
   * `Delivery`-phase ideas for the sprint board and the delivery backlog, excluding soft-deleted
   * ones. Unpaged, like the comment thread: a sprint is a deliberately small, time-boxed set of
   * Issues, and a board that pages is not a board.
   *
   * TOTAL ORDER, as everywhere else here: `createdAtUtc` then `title`, never id.
   */
  listDelivery(filter: DeliveryFilter): Promise<readonly Idea[]>

  /** Every `Delivery`-phase idea in one sprint, for sprint completion's carry-over and for
   * unassigning before a sprint is deleted (satisfies `sprints.SprintIssuesPort`). */
  listBySprint(sprintId: string): Promise<readonly Idea[]>
}

export type DeliveryFilter = {
  readonly organizationId: string
  /** `null` with `backlogOnly` false spans every Delivery item in the organization. */
  readonly sprintId: string | null
  /** True reads the backlog: Delivery items with no sprint. */
  readonly backlogOnly: boolean
  readonly deliveryStatus: DeliveryStatus | null
}

// Notifications (B4) -----------------------------------------------------------------------
//
// Clock and AuditEventWriter are NOT redeclared here - they live in the kernel
// (@collega/application/common, S0.5) now that Ideas, Upvotes and two other partitions had
// independently invented the same shapes. Import them from there.

export type NotificationEventType =
  | 'IdeaMention'
  | 'CommentMention'
  | 'CommentAdded'
  | 'IdeaStatusChanged'
  | 'IdeaPromoted'
  | 'IssueDeliveryStatusChanged'

export type NotificationInput = {
  readonly eventType: NotificationEventType
  readonly organizationId: string
  readonly boardId: string
  readonly ideaId: string
  readonly ideaTitle: string
  readonly actorUserId: string
  readonly recipientUserId: string
}

/** Persists notification events (SPEC/20-feature-notifications.md), owned by B4. Self-notification
 * suppression is applied by the caller and, defensively, by the writer itself. */
export interface NotificationsPort {
  notify(input: NotificationInput): Promise<void>
}

// Upvotes -----------------------------------------------------------------------------------
//
// Upvotes is this same partition's sibling feature (packages/application/src/upvotes), but idea
// list/detail projection needs read-only upvote data, and the toggle mutation belongs solely to
// the upvotes feature. This is the narrow read-only slice of .NET's `IIdeaUpvoteRepository` that
// `IdeaService` itself used - `GetAsync`/`AddAsync`/`Remove` (the toggle's own concerns) are not
// part of it. Kept here rather than imported from '../upvotes/index.js' so this feature
// folder stays independently reachable per the subpath-export convention; Wave C can satisfy both
// with the same concrete repository.

export interface UpvoteCountsPort {
  countByIdea(ideaId: string): Promise<number>
  countByIdeaIds(ideaIds: readonly string[]): Promise<ReadonlyMap<string, number>>
  /** The subset of `ideaIds` the given user has an active upvote on. */
  getUpvotedIdeaIds(userId: string, ideaIds: readonly string[]): Promise<ReadonlySet<string>>
}

// Sprints / Tasks (Issues-and-Delivery Slice 1) --------------------------------------------------
//
// Two narrow read-only slices of the sibling delivery features, declared here for the same reason
// `UpvoteCountsPort` is: the promotion gate has to validate a target sprint and the delivery card
// carries a sprint label and a task rollup, while the mutations on both belong solely to
// `SprintService` and `IssueTaskService`. One concrete adapter per entity satisfies both sides.

export type SprintSummary = {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly startDate: string
  readonly endDate: string
  readonly state: SprintState
  readonly isDeleted: boolean
}

export interface SprintLookupPort {
  getById(sprintId: string): Promise<SprintSummary | null>

  listByIds(sprintIds: readonly string[]): Promise<readonly SprintSummary[]>
}

export interface IssueTaskRollupPort {
  /** `{ done, total }` per idea, in ONE query for the whole board - a per-card count is the N+1
   * this exists to avoid. Ideas with no tasks are simply absent from the map. */
  summaryByIdeaIds(
    ideaIds: readonly string[],
  ): Promise<ReadonlyMap<string, { readonly done: number; readonly total: number }>>
}

// Boards (B2) ----------------------------------------------------------------------------------

export type SwimlaneInfo = {
  readonly statusId: string
  readonly displayOrder: number
}

export type BoardContext = {
  readonly boardId: string
  readonly organizationId: string
  readonly name: string
  readonly allowUserStatusUpdate: boolean
  readonly swimlanes: readonly SwimlaneInfo[]
}

export type StatusInfo = {
  readonly statusId: string
  readonly name: string
  readonly color: string
  readonly isDeleted: boolean
}

export interface BoardsPort {
  getBoardContext(boardId: string): Promise<BoardContext | null>

  /** Status id -> display info for every status in an organization, including soft-deleted ones
   * so historical references still render their prior name (rule #8). */
  getStatusInfo(organizationId: string): Promise<ReadonlyMap<string, StatusInfo>>
}

/** The left-most swimlane's status - the default for new ideas (rule #27). A plain function
 * rather than a `BoardContext` method: the port is a data contract, not a class. */
export function leftMostStatusId(board: BoardContext): string | null {
  if (board.swimlanes.length === 0) {
    return null
  }
  return [...board.swimlanes].sort((a, b) => a.displayOrder - b.displayOrder)[0]?.statusId ?? null
}

export function hasSwimlaneForStatus(board: BoardContext, statusId: string): boolean {
  return board.swimlanes.some((s) => s.statusId === statusId)
}

// Users (B1) -------------------------------------------------------------------------------------

export type UserSummary = {
  readonly id: string
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly role: Role
  readonly status: UserStatus
  readonly organizationId: string | null
  readonly portraitPng: Uint8Array | null
}

export interface UsersPort {
  listByIds(userIds: readonly string[]): Promise<readonly UserSummary[]>

  /** Global lookup by normalized (trimmed, lowercased) email, for mention resolution. The caller
   * still checks organization/role/status - mirrors .NET's `MentionResolver`. */
  findByNormalizedEmail(normalizedEmail: string): Promise<UserSummary | null>
}

// Tags (B4) --------------------------------------------------------------------------------------

export type TagSummary = {
  readonly id: string
  readonly name: string
}

export type GetOrCreateTagsInput = {
  readonly organizationId: string
  readonly requestedNames: readonly string[]
  readonly nowUtc: Date
  readonly actorUserId: string | null
}

export interface TagsPort {
  listByIds(tagIds: readonly string[]): Promise<readonly TagSummary[]>

  /** Resolves display names to persisted tags, creating any that do not yet exist
   * (SPEC/20-feature-ideas-and-engagement.md "Tags" #6-7). */
  getOrCreate(input: GetOrCreateTagsInput): Promise<readonly TagSummary[]>
}

// Comments (B4) ----------------------------------------------------------------------------------

export type IdeaCommentSummary = {
  readonly commentId: string
  readonly ideaId: string
  readonly authorUserId: string
  readonly body: string
  readonly createdAtUtc: Date
  readonly updatedAtUtc: Date
}

export interface CommentsPort {
  /** Full chronological (ascending) comment list for one idea - the idea detail embeds every
   * comment, matching .NET's unpaged (page-size-max) fetch. */
  listByIdea(ideaId: string): Promise<readonly IdeaCommentSummary[]>

  countByIdea(ideaId: string): Promise<number>

  countByIdeaIds(ideaIds: readonly string[]): Promise<ReadonlyMap<string, number>>
}

// Idea Types / Business Impacts (B5) --------------------------------------------------------------

export type IdeaTypeSummary = {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly colorHex: string | null
  readonly icon: string | null
  readonly isDeleted: boolean
}

export type BusinessImpactSummary = {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly color: string
  readonly isDeleted: boolean
}

export interface IdeaClassificationPort {
  getIdeaTypeById(ideaTypeId: string): Promise<IdeaTypeSummary | null>

  /** Organization options; active only unless `includeDeleted` (used to label archived
   * references on ideas that still point at a since-deleted option). */
  listIdeaTypesByOrganization(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly IdeaTypeSummary[]>

  getBusinessImpactById(businessImpactId: string): Promise<BusinessImpactSummary | null>

  listBusinessImpactsByOrganization(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly BusinessImpactSummary[]>
}

// User-Defined Fields (B5) - the densest logic (IdeaTypeFieldResolver + FieldValueValidator) is
// deliberately a single delegated port rather than re-implemented against B5's domain types. -----

export type IdeaFieldValueView = {
  readonly fieldDefinitionId: string
  readonly fieldName: string
  readonly fieldType: string
  readonly value: string
}

export type ImportCellTranslation =
  | { readonly ok: true; readonly stored: string }
  | { readonly ok: false; readonly error: string }

export interface IdeaFieldValuesPort {
  /** Resolves the effective/required fields for `ideaTypeId` and validates + normalizes
   * `submitted` against them, throwing the kernel's `ValidationError` (field-name-keyed) on any
   * problem. Mirrors `IdeaTypeFieldResolver.ResolveEffectiveFields` + `FieldValueValidator.Validate`. */
  resolveAndValidate(input: {
    organizationId: string
    ideaTypeId: string
    submitted: readonly IdeaFieldValueWrite[]
  }): Promise<readonly IdeaFieldValueInput[]>

  /** The field-definition ids `ideaTypeId` currently resolves to - the reconcile scope passed to
   * `Idea.replaceFieldValues`. */
  getReconcileScope(organizationId: string, ideaTypeId: string): Promise<readonly string[]>

  /** id -> display name for the given field-definition ids, for labelling an
   * `IdeaFieldValueChanged` audit message. Ids with no active definition are omitted; the caller
   * falls back to showing the raw id. */
  getFieldNames(
    organizationId: string,
    fieldDefinitionIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>>

  /** Ordered, labelled values for the idea detail: resolved-for-type values first, then any
   * stored-but-out-of-type values preserved but shown as archived
   * (SPEC/20-feature-idea-type-fields.md). */
  describeForDetail(input: {
    organizationId: string
    ideaTypeId: string
    stored: readonly { fieldDefinitionId: string; value: string }[]
  }): Promise<readonly IdeaFieldValueView[]>

  /** Translates the raw `fieldFilters[<id>]=<value>` map into typed predicates per each field's
   * type (T059), silently dropping unknown ids, blank values, and values that don't parse for
   * their type. Also returns the active Text/Url field ids the org list's global search
   * additionally scans. */
  translateListFilters(input: {
    organizationId: string
    raw: ReadonlyMap<string, string> | null
  }): Promise<{
    readonly filters: readonly IdeaFieldValueFilter[]
    readonly searchTextFieldIds: readonly string[]
  }>

  /** Export/import columns (field id + display header/name), in display order, excluding fields
   * whose name collides with a core CSV column (see `isReservedColumn`) - the same set serves
   * both directions, matched by header on import. */
  getExportColumns(
    organizationId: string,
  ): Promise<readonly { readonly fieldDefinitionId: string; readonly header: string }[]>

  /** Renders one idea's stored value for `fieldDefinitionId` as a CSV cell (Dropdown/MultiSelect
   * ids become option labels; empty/missing becomes `""`). */
  formatForExport(fieldDefinitionId: string, value: string | null): Promise<string>

  /** Translates one raw CSV cell for `fieldName` (a `getExportColumns` header) into its stored
   * form (option labels -> ids, Yes/No -> true/false, etc). Returns an error instead of throwing
   * so the import row can be rejected individually without aborting the batch. */
  translateImportCell(input: {
    organizationId: string
    fieldName: string
    rawCell: string
  }): Promise<ImportCellTranslation>
}
