import { randomUUID } from 'node:crypto'
import { Priority, Role, UserStatus } from '@collega/domain/enums'
import type { Idea, IdeaFieldValueInput } from '@collega/domain/ideas'
import {
  changeIdeaStatus,
  createIdea,
  IdeaDomainError,
  MAX_ASSIGNEES,
  MAX_TAGS,
  reassignIdeaType as reassignIdeaTypeOf,
  replaceIdeaAssignees,
  replaceIdeaFieldValues,
  replaceIdeaMentions,
  replaceIdeaTags,
  softDeleteIdea,
  updateIdeaContent,
} from '@collega/domain/ideas'
import type { AuditEventWriter, Clock, CurrentUserContext, UnitOfWork } from '../common/index.js'
import {
  attributeAudit,
  ensureNotDirectSiteAdmin,
  ForbiddenError,
  MAX_PAGE_SIZE,
  NotFoundError,
  normalizePageRequest,
  UnauthorizedError,
  ValidationError,
} from '../common/index.js'
import type {
  ChangeIdeaStatusCommand,
  CreateIdeaCommand,
  CreateIdeaResult,
  IdeaAssigneeDto,
  IdeaCommentDto,
  IdeaCsvExport,
  IdeaDetail,
  IdeaFieldValueDto,
  IdeaFieldValueWrite,
  IdeaImportResult,
  IdeaImportRow,
  IdeaImportRowResult,
  IdeaListItem,
  IdeaListQuery,
  IdeaPage,
  MentionDto,
  OrganizationIdeaListQuery,
  UpdateIdeaCommand,
} from './models.js'
import {
  IDEA_CSV_CORE_COLUMNS,
  IdeaCsvColumns,
  normalizeSortDirection,
  toPageRequestInput,
} from './models.js'
import type {
  BoardContext,
  BoardsPort,
  BusinessImpactSummary,
  CommentsPort,
  IdeaClassificationPort,
  IdeaFieldValuesPort,
  IdeaRepository,
  IdeaTypeSummary,
  NotificationEventType,
  NotificationsPort,
  StatusInfo,
  TagSummary,
  TagsPort,
  UpvoteCountsPort,
  UserSummary,
  UsersPort,
} from './ports.js'
import { hasSwimlaneForStatus, leftMostStatusId } from './ports.js'

/** Mirrors Domain.Tags.Tag.NameMaxLength (B4-owned). Duplicated rather than imported: Ideas does
 * not depend on Tags' domain, only on `TagsPort` (see the report's cross-partition-duplication
 * note). */
const MAX_TAG_NAME_LENGTH = 100

/** Upper bound on rows a single board CSV export will materialise (mirrors .NET's
 * `IdeaService.MaxExportRows`) - well above any plausible board, but the endpoint is reachable by
 * any member including Read Only, so an unbounded export is a cheap way to pressure the host. */
const MAX_EXPORT_ROWS = 10_000

/**
 * Idea use cases (SPEC/20-feature-ideas-and-engagement.md, SPEC/30-Contracts.md "Idea
 * Contracts"). Enforces organization scoping, idea-edit vs. description/assignee authorization,
 * board-configured User status moves (rule #34), keeping Complete ideas editable (rule #6/#35),
 * and audit emission (rule #36). Upvote toggling itself lives in the sibling `upvotes` feature.
 */
export class IdeaService {
  constructor(
    private readonly ideaRepository: IdeaRepository,
    private readonly boards: BoardsPort,
    private readonly users: UsersPort,
    private readonly tags: TagsPort,
    private readonly comments: CommentsPort,
    private readonly classification: IdeaClassificationPort,
    private readonly fieldValues: IdeaFieldValuesPort,
    private readonly upvoteCounts: UpvoteCountsPort,
    private readonly notifications: NotificationsPort,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async listByBoard(boardId: string, query: IdeaListQuery): Promise<IdeaPage<IdeaListItem>> {
    this.requireAuthenticatedRole()

    const board = await this.boards.getBoardContext(boardId)
    if (!board) {
      throw new NotFoundError('Board not found.')
    }
    this.ensureOrganizationScope(board.organizationId)

    const page = normalizePageRequest(toPageRequestInput(query.page, query.pageSize))
    const ideasPage = await this.ideaRepository.listByBoard({
      boardId,
      page,
      search: trimOrNull(query.search),
      statusId: query.statusId,
      tag: trimOrNull(query.tag),
      priority: parseOptionalPriority(query.priority),
      dueBefore: parseOptionalDate(query.dueBefore),
      sortBy: query.sortBy,
      sortDirection: normalizeSortDirection(query.sortDirection),
    })

    const items = await this.projectListItems(board.organizationId, ideasPage.items)
    return { ...ideasPage, items }
  }

  /** Cross-board, organization-scoped idea list for the global `/ideas` page. */
  async listByOrganization(
    organizationId: string,
    query: OrganizationIdeaListQuery,
  ): Promise<IdeaPage<IdeaListItem>> {
    this.requireAuthenticatedRole()
    this.ensureOrganizationScope(organizationId)
    const currentUserId = this.requireAuthenticatedUserId()

    const scope = (query.scope ?? '').trim().toLowerCase()
    const createdByUserId = scope === 'created' ? currentUserId : null
    const assignedToUserId = scope === 'assigned' ? currentUserId : null

    const { filters: fieldFilters, searchTextFieldIds } =
      await this.fieldValues.translateListFilters({
        organizationId,
        raw: query.fieldFilters,
      })

    const search = trimOrNull(query.search)
    // The all-column search covers the Created Date column too: when the term is a full ISO date
    // it additionally matches ideas created on that (UTC) calendar day.
    const searchCreatedOnDate = search && isValidIsoDate(search) ? search : null

    const page = normalizePageRequest(toPageRequestInput(query.page, query.pageSize))
    const ideasPage = await this.ideaRepository.listByOrganization({
      organizationId,
      createdByUserId,
      assignedToUserId,
      page,
      search,
      sortBy: query.sortBy,
      sortDirection: normalizeSortDirection(query.sortDirection),
      fieldFilters,
      searchTextFieldIds,
      tag: trimOrNull(query.tag),
      associatedUserId: trimOrNull(query.user),
      searchCreatedOnDate,
    })

    const items = await this.projectListItems(organizationId, ideasPage.items)
    return { ...ideasPage, items }
  }

  async create(boardId: string, command: CreateIdeaCommand): Promise<CreateIdeaResult> {
    // Rule 25: org content is mutated through View As, not directly as a Site Admin.
    ensureNotDirectSiteAdmin(this.currentUser)
    this.requireIdeaEditRole()

    const board = await this.boards.getBoardContext(boardId)
    if (!board) {
      throw new NotFoundError('Board not found.')
    }
    this.ensureOrganizationScope(board.organizationId)

    const now = this.clock.now()
    const authorId = this.requireAuthenticatedUserId()
    const priority = parsePriority(command.priority)
    const dueDate = parseDueDate(command.dueDate)

    const statusId = command.statusId ?? leftMostStatusId(board)
    if (!statusId) {
      throw new ValidationError('One or more fields are invalid.', {
        statusId: ['The board has no swimlanes to place the idea in.'],
      })
    }
    if (!hasSwimlaneForStatus(board, statusId)) {
      throw new ValidationError('One or more fields are invalid.', {
        statusId: ['Status must be an active swimlane on the board.'],
      })
    }

    await this.getActiveIdeaType(board.organizationId, command.ideaTypeId)
    await this.ensureActiveBusinessImpact(board.organizationId, command.businessImpactId)

    const assigneeIds = await this.resolveAssignees(
      board.organizationId,
      command.assigneeUserIds,
      [],
    )
    const tagIds = await this.resolveTags(board.organizationId, command.tagNames, now, authorId)
    const mentionIds = await this.resolveMentions(
      board.organizationId,
      command.mentionEmails,
      'mentionEmails',
    )

    const fieldValues = await this.fieldValues.resolveAndValidate({
      organizationId: board.organizationId,
      ideaTypeId: command.ideaTypeId,
      submitted: command.fieldValues ?? [],
    })

    let idea = createIdeaOrThrow({
      id: randomUUID(),
      organizationId: board.organizationId,
      boardId,
      statusId,
      title: command.title ?? '',
      description: command.description ?? '',
      priority,
      ideaTypeId: command.ideaTypeId,
      businessImpactId: command.businessImpactId,
      dueDate,
      authorUserId: authorId,
      assigneeUserIds: assigneeIds,
      tagIds,
      mentionedUserIds: mentionIds,
      nowUtc: now,
    })

    const reconcileScope = await this.fieldValues.getReconcileScope(
      board.organizationId,
      command.ideaTypeId,
    )
    idea = replaceIdeaFieldValues(idea, fieldValues, reconcileScope, now, authorId)

    await this.ideaRepository.add(idea)
    await this.unitOfWork.saveChanges()

    await this.auditIdea('IdeaCreated', idea, authorId, `Idea '${idea.title}' created.`, now, {
      title: idea.title,
      priority,
      statusId: idea.statusId,
    })
    await this.emitFieldValueAudit(idea, new Map(), authorId, now)

    // Notify everyone mentioned in the new idea body (SPEC/20-feature-notifications.md trigger #1).
    await this.notifyMentions(idea, mentionIds, authorId)

    return {
      ideaId: idea.id,
      boardId: idea.boardId,
      statusId: idea.statusId,
      title: idea.title,
      priority,
      ideaTypeId: idea.ideaTypeId,
      businessImpactId: idea.businessImpactId,
      dueDate: idea.dueDate,
    }
  }

  async getById(ideaId: string): Promise<IdeaDetail> {
    this.requireAuthenticatedRole()

    const idea = await this.ideaRepository.getById(ideaId, false)
    if (!idea) {
      throw new NotFoundError('Idea not found.')
    }
    this.ensureOrganizationScope(idea.organizationId)

    return this.projectDetail(idea)
  }

  async update(ideaId: string, command: UpdateIdeaCommand): Promise<IdeaDetail> {
    // Rule 25: org content is mutated through View As, not directly as a Site Admin.
    ensureNotDirectSiteAdmin(this.currentUser)
    this.requireIdeaEditRole()

    let idea = await this.ideaRepository.getById(ideaId, false)
    if (!idea) {
      throw new NotFoundError('Idea not found.')
    }
    this.ensureOrganizationScope(idea.organizationId)

    const now = this.clock.now()
    const actorId = this.requireAuthenticatedUserId()
    const priority = parsePriority(command.priority)
    const dueDate = parseDueDate(command.dueDate)

    const existingAssignees = [...idea.assigneeUserIds]
    const existingMentions = new Set(idea.mentionedUserIds)
    const requestedAssignees = distinctNonEmpty(command.assigneeUserIds)
    const descriptionChanged = (command.description ?? '').trim() !== idea.description
    const assigneesChanged = !setsEqual(new Set(existingAssignees), new Set(requestedAssignees))

    // Description and assignee changes are restricted to the author or an in-scope admin
    // (SPEC/20-feature-ideas-and-engagement.md "Permissions"); other fields use the general
    // idea-edit permission already checked above.
    if ((descriptionChanged || assigneesChanged) && !this.canAdministerIdeaContent(idea, actorId)) {
      throw new ForbiddenError(
        "You are not allowed to change this idea's description or assignees.",
      )
    }

    // Idea Type is immutable on the edit path (SPEC/20-feature-idea-type-fields.md): a normal
    // update may not change it. Business Impact stays mutable.
    if (command.ideaTypeId !== idea.ideaTypeId) {
      throw new ValidationError('One or more fields are invalid.', {
        ideaTypeId: ['Idea Type cannot be changed after creation.'],
      })
    }

    if (command.businessImpactId !== idea.businessImpactId) {
      await this.ensureActiveBusinessImpact(idea.organizationId, command.businessImpactId)
    }

    const assigneeIds = await this.resolveAssignees(
      idea.organizationId,
      command.assigneeUserIds,
      existingAssignees,
    )
    const tagIds = await this.resolveTags(idea.organizationId, command.tagNames, now, actorId)
    const mentionIds = await this.resolveMentions(
      idea.organizationId,
      command.mentionEmails,
      'mentionEmails',
    )

    // A null `fieldValues` means "not provided" - leave existing UDF values untouched. Only an
    // explicit (possibly empty) list reconciles them, so an unrelated edit neither wipes stored
    // values nor is blocked by required-field validation.
    const reconcileFieldValues = command.fieldValues !== null
    let previousFieldValues = new Map<string, string | null>()
    let fieldValues: readonly IdeaFieldValueInput[] = []
    let reconcileScope: readonly string[] = []
    if (reconcileFieldValues) {
      reconcileScope = await this.fieldValues.getReconcileScope(
        idea.organizationId,
        idea.ideaTypeId,
      )
      previousFieldValues = new Map(idea.fieldValues.map((v) => [v.fieldDefinitionId, v.value]))
      fieldValues = await this.fieldValues.resolveAndValidate({
        organizationId: idea.organizationId,
        ideaTypeId: idea.ideaTypeId,
        submitted: command.fieldValues ?? [],
      })
    }

    idea = runDomain(
      updateIdeaContent,
      idea,
      {
        title: command.title ?? '',
        description: command.description ?? '',
        priority,
        businessImpactId: command.businessImpactId,
        dueDate,
      },
      now,
      actorId,
    )
    idea = runDomain(replaceIdeaAssignees, idea, assigneeIds, now, actorId)
    idea = runDomain(replaceIdeaTags, idea, tagIds, now, actorId)
    idea = replaceIdeaMentions(idea, mentionIds, now, actorId)
    if (reconcileFieldValues) {
      idea = replaceIdeaFieldValues(idea, fieldValues, reconcileScope, now, actorId)
    }

    await this.ideaRepository.update(idea)
    await this.unitOfWork.saveChanges()

    await this.auditIdea('IdeaUpdated', idea, actorId, `Idea '${idea.title}' updated.`, now, null)
    if (reconcileFieldValues) {
      await this.emitFieldValueAudit(idea, previousFieldValues, actorId, now)
    }

    // Notify only newly added mentions so an edit does not re-notify people already mentioned.
    const newMentions = mentionIds.filter((id) => !existingMentions.has(id))
    await this.notifyMentions(idea, newMentions, actorId)

    return this.projectDetail(idea)
  }

  /** Admin-only reassignment of an idea's (otherwise immutable) type
   * (SPEC/20-feature-idea-type-fields.md). Field values are preserved untouched; values outside
   * the new type's resolved set become archived (hidden on detail), not dropped. */
  async reassignIdeaType(
    organizationId: string,
    ideaId: string,
    ideaTypeId: string,
  ): Promise<void> {
    this.requireAuthenticatedRole()
    ensureNotDirectSiteAdmin(this.currentUser)

    let idea = await this.ideaRepository.getById(ideaId, false)
    if (!idea) {
      throw new NotFoundError('Idea not found.')
    }
    this.ensureOrganizationScope(idea.organizationId)
    if (idea.organizationId !== organizationId) {
      throw new NotFoundError('Idea not found.')
    }

    // Reassignment is the admin-only break-glass hatch.
    if (!this.canAdministerIdeaContent(idea, null, true)) {
      throw new ForbiddenError("You are not allowed to reassign an idea's type.")
    }

    // 400 when the target type is unknown or archived in the organization.
    await this.getActiveIdeaType(idea.organizationId, ideaTypeId)

    if (idea.ideaTypeId === ideaTypeId) {
      return
    }

    const now = this.clock.now()
    const actorId = this.requireAuthenticatedUserId()
    const previousTypeId = idea.ideaTypeId

    idea = reassignIdeaTypeOf(idea, ideaTypeId, now, actorId)
    await this.ideaRepository.update(idea)
    await this.unitOfWork.saveChanges()

    await this.auditIdea(
      'IdeaTypeReassigned',
      idea,
      actorId,
      `Idea '${idea.title}' reassigned to a new Idea Type.`,
      now,
      { fromIdeaTypeId: previousTypeId, toIdeaTypeId: ideaTypeId },
    )
  }

  async changeStatus(ideaId: string, command: ChangeIdeaStatusCommand): Promise<void> {
    // Rule 25: org content is mutated through View As, not directly as a Site Admin.
    ensureNotDirectSiteAdmin(this.currentUser)
    this.requireAuthenticatedRole()

    let idea = await this.ideaRepository.getById(ideaId, false)
    if (!idea) {
      throw new NotFoundError('Idea not found.')
    }
    this.ensureOrganizationScope(idea.organizationId)

    const board = await this.boards.getBoardContext(idea.boardId)
    if (!board) {
      throw new NotFoundError('Board not found.')
    }

    if (!hasSwimlaneForStatus(board, command.statusId)) {
      throw new ValidationError('One or more fields are invalid.', {
        statusId: ['Status must be an active swimlane on the board.'],
      })
    }

    this.ensureCanMoveIdea(board)

    if (idea.statusId === command.statusId) {
      return
    }

    const now = this.clock.now()
    const actorId = this.requireAuthenticatedUserId()
    const previousStatusId = idea.statusId

    idea = changeIdeaStatus(idea, command.statusId, now, actorId)
    await this.ideaRepository.update(idea)
    await this.unitOfWork.saveChanges()

    await this.auditIdea(
      'IdeaStatusChanged',
      idea,
      actorId,
      `Idea '${idea.title}' moved to a new status.`,
      now,
      { fromStatusId: previousStatusId, toStatusId: command.statusId },
    )

    // Notify the idea author and assignees of the move (SPEC/20-feature-notifications.md trigger #4).
    await this.notifyIdeaFollowers('IdeaStatusChanged', idea, actorId)
  }

  async delete(ideaId: string): Promise<void> {
    // Rule 25: org content is mutated through View As, not directly as a Site Admin.
    ensureNotDirectSiteAdmin(this.currentUser)
    this.requireAuthenticatedRole()

    let idea = await this.ideaRepository.getById(ideaId, false)
    if (!idea) {
      throw new NotFoundError('Idea not found.')
    }

    // Deletion is restricted to Site Admin or an in-scope Org Admin (rule #16 / "Permissions").
    // Deliberately no separate `ensureOrganizationScope` call here - matches .NET, where
    // `canAdministerIdeaContent`'s own org check is what a cross-org Org Admin fails.
    if (!this.canAdministerIdeaContent(idea, null, true)) {
      throw new ForbiddenError('You are not allowed to delete ideas.')
    }

    const now = this.clock.now()
    const actorId = this.requireAuthenticatedUserId()

    idea = softDeleteIdea(idea, now, actorId)
    await this.ideaRepository.update(idea)
    await this.unitOfWork.saveChanges()

    await this.auditIdea('IdeaDeleted', idea, actorId, `Idea '${idea.title}' deleted.`, now, null)
  }

  // CSV export / import ------------------------------------------------------------------------

  async exportBoardIdeas(boardId: string): Promise<IdeaCsvExport> {
    this.requireAuthenticatedRole()

    const board = await this.boards.getBoardContext(boardId)
    if (!board) {
      throw new NotFoundError('Board not found.')
    }
    this.ensureOrganizationScope(board.organizationId)

    // Page through the store, but bounded - every idea, its tags, its field-value snapshot, and
    // the rendered CSV are all held in memory at once, and the endpoint is reachable by any
    // member including Read Only. The cap refuses rather than truncating: a silently short export
    // is worse than a clear failure for something people use as a reporting extract.
    const ideas: Idea[] = []
    let pageNumber = 1
    for (;;) {
      const pageResult = await this.ideaRepository.listByBoard({
        boardId,
        page: { page: pageNumber, pageSize: MAX_PAGE_SIZE },
        search: null,
        statusId: null,
        tag: null,
        priority: null,
        dueBefore: null,
        sortBy: 'createdat',
        sortDirection: 'asc',
      })

      if (pageResult.totalCount > MAX_EXPORT_ROWS) {
        throw new ValidationError('One or more fields are invalid.', {
          boardId: [
            `This board has ${pageResult.totalCount} ideas, which is more than the ${MAX_EXPORT_ROWS} this export supports. Contact an administrator if you need a larger extract.`,
          ],
        })
      }

      ideas.push(...pageResult.items)
      if (pageResult.items.length === 0 || ideas.length >= pageResult.totalCount) {
        break
      }
      pageNumber++
    }

    const statusInfo = await this.boards.getStatusInfo(board.organizationId)
    const ideaTypeLookup = await this.loadIdeaTypeLookup(board.organizationId)
    const businessImpactLookup = await this.loadBusinessImpactLookup(board.organizationId)
    const tagLookup = await this.loadTagLookup(ideas.flatMap((i) => i.tagIds))

    const exportColumns = await this.fieldValues.getExportColumns(board.organizationId)

    const snapshots = await this.ideaRepository.getFieldValuesByIdeaIds(ideas.map((i) => i.id))
    const valuesByIdea = new Map<string, Map<string, string | null>>()
    for (const snapshot of snapshots) {
      let byField = valuesByIdea.get(snapshot.ideaId)
      if (!byField) {
        byField = new Map()
        valuesByIdea.set(snapshot.ideaId, byField)
      }
      byField.set(snapshot.fieldDefinitionId, snapshot.value)
    }

    const headers = [
      ...IDEA_CSV_CORE_COLUMNS.map((c) => c.header),
      ...exportColumns.map((c) => c.header),
    ]

    const rows: string[][] = []
    for (const idea of ideas) {
      const cells: string[] = [
        idea.title,
        idea.description,
        idea.priority,
        this.ideaTypeName(ideaTypeLookup, idea.ideaTypeId),
        this.businessImpactName(businessImpactLookup, idea.businessImpactId),
        this.statusName(statusInfo, idea.statusId),
        idea.dueDate ?? '',
        this.projectTagNames(idea, tagLookup).join(', '),
      ]

      const ideaValues = valuesByIdea.get(idea.id)
      for (const column of exportColumns) {
        const stored = ideaValues?.get(column.fieldDefinitionId) ?? null
        cells.push(await this.fieldValues.formatForExport(column.fieldDefinitionId, stored))
      }

      rows.push(cells)
    }

    return { headers, rows }
  }

  /** Create-only CSV import of ideas onto a board. Each valid row creates one idea (defaulting to
   * the left-most swimlane unless a Status names a board swimlane); invalid rows are rejected
   * with a per-row message and do not stop the rest. */
  async importBoardIdeas(
    boardId: string,
    rows: readonly IdeaImportRow[],
  ): Promise<IdeaImportResult> {
    // Bulk create is still create: without this, a Site Admin refused POST .../ideas could make
    // the same ideas by the hundred through the sibling import endpoint.
    this.requireIdeaEditRole()
    ensureNotDirectSiteAdmin(this.currentUser)

    const board = await this.boards.getBoardContext(boardId)
    if (!board) {
      throw new NotFoundError('Board not found.')
    }
    this.ensureOrganizationScope(board.organizationId)

    const now = this.clock.now()
    const authorId = this.requireAuthenticatedUserId()
    const organizationId = board.organizationId

    const ideaTypeByName = new Map<string, IdeaTypeSummary>()
    for (const ideaType of await this.classification.listIdeaTypesByOrganization(
      organizationId,
      false,
    )) {
      ideaTypeByName.set(ideaType.name.trim().toLowerCase(), ideaType)
    }

    const businessImpactIdByName = new Map<string, string>()
    for (const impact of await this.classification.listBusinessImpactsByOrganization(
      organizationId,
      false,
    )) {
      businessImpactIdByName.set(impact.name.trim().toLowerCase(), impact.id)
    }

    const statusInfo = await this.boards.getStatusInfo(organizationId)
    // Only statuses that are swimlanes on this board are valid import targets.
    const boardStatusIdByName = new Map<string, string>()
    for (const [statusId, info] of statusInfo) {
      if (hasSwimlaneForStatus(board, statusId)) {
        boardStatusIdByName.set(info.name.trim().toLowerCase(), statusId)
      }
    }

    const exportColumns = await this.fieldValues.getExportColumns(organizationId)

    const leftMost = leftMostStatusId(board)
    const results: IdeaImportRowResult[] = []
    let created = 0
    let rejected = 0

    for (const row of rows) {
      const cell = (key: string): string | null => trimOrNull(row.cells.get(key) ?? null)

      const title = cell(IdeaCsvColumns.title)
      const description = cell(IdeaCsvColumns.description)
      const priorityRaw = cell(IdeaCsvColumns.priority)
      const typeName = cell(IdeaCsvColumns.ideaType)
      const impactName = cell(IdeaCsvColumns.businessImpact)
      const statusName = cell(IdeaCsvColumns.status)
      const dueRaw = cell(IdeaCsvColumns.dueDate)
      const tagsRaw = cell(IdeaCsvColumns.tags)

      const reject = (message: string): void => {
        rejected++
        results.push({ rowNumber: row.rowNumber, title, outcome: 'Rejected', error: message })
      }

      if (!title) {
        reject('Title is required.')
        continue
      }
      if (!description) {
        reject('Description is required.')
        continue
      }

      const priority = parseOptionalPriority(priorityRaw)
      if (priority === null) {
        reject('Priority must be Low, Medium, High, or Critical.')
        continue
      }

      const ideaType = typeName ? ideaTypeByName.get(typeName.toLowerCase()) : undefined
      if (!ideaType) {
        reject(`Idea Type '${typeName ?? ''}' is not an active option.`)
        continue
      }

      const businessImpactId = impactName
        ? businessImpactIdByName.get(impactName.toLowerCase())
        : undefined
      if (!businessImpactId) {
        reject(`Business Impact '${impactName ?? ''}' is not an active option.`)
        continue
      }

      let statusId: string
      if (!statusName) {
        if (!leftMost) {
          reject('The board has no swimlanes to place the idea in.')
          continue
        }
        statusId = leftMost
      } else {
        const matched = boardStatusIdByName.get(statusName.toLowerCase())
        if (!matched) {
          reject(`Status '${statusName}' is not a swimlane on this board.`)
          continue
        }
        statusId = matched
      }

      let dueDate: string | null = null
      if (dueRaw) {
        if (!isValidIsoDate(dueRaw)) {
          reject('Due Date must be a valid date (YYYY-MM-DD).')
          continue
        }
        dueDate = dueRaw
      }

      let tagIds: readonly string[]
      try {
        tagIds = await this.resolveTags(organizationId, splitTags(tagsRaw), now, authorId)
      } catch (error) {
        if (error instanceof ValidationError) {
          reject(flattenValidationErrors(error))
          continue
        }
        throw error
      }

      // User-Defined Field columns (matched by header/name), translated then validated (which
      // also enforces required fields and per-type rules).
      const udfWrites: IdeaFieldValueWrite[] = []
      let udfError: string | null = null
      for (const column of exportColumns) {
        const rawCell = trimOrNull(row.cells.get(column.header.toLowerCase()) ?? null)
        if (!rawCell) {
          continue
        }

        const translation = await this.fieldValues.translateImportCell({
          organizationId,
          fieldName: column.header,
          rawCell,
        })
        if (!translation.ok) {
          udfError = `${column.header}: ${translation.error}`
          break
        }
        udfWrites.push({ fieldDefinitionId: column.fieldDefinitionId, value: translation.stored })
      }

      if (udfError) {
        reject(udfError)
        continue
      }

      let fieldValues: readonly IdeaFieldValueInput[]
      try {
        fieldValues = await this.fieldValues.resolveAndValidate({
          organizationId,
          ideaTypeId: ideaType.id,
          submitted: udfWrites,
        })
      } catch (error) {
        if (error instanceof ValidationError) {
          reject(flattenValidationErrors(error))
          continue
        }
        throw error
      }

      let idea: Idea
      try {
        idea = createIdea({
          id: randomUUID(),
          organizationId,
          boardId,
          statusId,
          title,
          description,
          priority,
          ideaTypeId: ideaType.id,
          businessImpactId,
          dueDate,
          authorUserId: authorId,
          assigneeUserIds: [],
          tagIds,
          mentionedUserIds: [],
          nowUtc: now,
        })
      } catch (error) {
        if (error instanceof IdeaDomainError) {
          reject(error.message)
          continue
        }
        throw error
      }

      const reconcileScope = await this.fieldValues.getReconcileScope(organizationId, ideaType.id)
      if (reconcileScope.length > 0) {
        idea = replaceIdeaFieldValues(idea, fieldValues, reconcileScope, now, authorId)
      }

      await this.ideaRepository.add(idea)
      created++
      results.push({ rowNumber: row.rowNumber, title, outcome: 'Created', error: null })
    }

    // Every row's `add` above is staged only; one commit here after the loop is what makes the
    // whole import atomic (SPEC/decisions.md 2026-09-06 "Wave B conventions").
    await this.unitOfWork.saveChanges()

    await this.writeAudit({
      eventType: 'IdeasImported',
      entityType: 'Board',
      entityId: boardId,
      organizationId,
      intendedActorUserId: authorId,
      message: `Imported ${created} idea(s) (${rejected} rejected) from CSV.`,
      nowUtc: now,
      metadata: { created, rejected },
    })

    return { createdCount: created, rejectedCount: rejected, rows: results }
  }

  // Projection -----------------------------------------------------------------------------------

  private async projectListItems(
    organizationId: string,
    ideas: readonly Idea[],
  ): Promise<readonly IdeaListItem[]> {
    if (ideas.length === 0) {
      return []
    }

    const ideaIds = ideas.map((i) => i.id)
    const tagLookup = await this.loadTagLookup(ideas.flatMap((i) => i.tagIds))
    const userLookup = await this.loadUserLookup(ideas.flatMap((i) => i.assigneeUserIds))
    const statusInfo = await this.boards.getStatusInfo(organizationId)
    const ideaTypeLookup = await this.loadIdeaTypeLookup(organizationId)
    const businessImpactLookup = await this.loadBusinessImpactLookup(organizationId)
    const upvoteCounts = await this.upvoteCounts.countByIdeaIds(ideaIds)
    const commentCounts = await this.comments.countByIdeaIds(ideaIds)
    const currentUserId = this.requireAuthenticatedUserId()
    const upvoted = await this.upvoteCounts.getUpvotedIdeaIds(currentUserId, ideaIds)

    return ideas.map((idea) => ({
      ideaId: idea.id,
      boardId: idea.boardId,
      title: idea.title,
      priority: idea.priority,
      ideaTypeId: idea.ideaTypeId,
      ideaTypeName: this.ideaTypeName(ideaTypeLookup, idea.ideaTypeId),
      ideaTypeColorHex: this.ideaTypeColorHex(ideaTypeLookup, idea.ideaTypeId),
      ideaTypeIcon: this.ideaTypeIcon(ideaTypeLookup, idea.ideaTypeId),
      businessImpactId: idea.businessImpactId,
      businessImpactName: this.businessImpactName(businessImpactLookup, idea.businessImpactId),
      businessImpactColor: this.businessImpactColor(businessImpactLookup, idea.businessImpactId),
      dueDate: idea.dueDate,
      assignees: this.projectAssignees(idea, userLookup),
      tagNames: this.projectTagNames(idea, tagLookup),
      statusId: idea.statusId,
      statusName: this.statusName(statusInfo, idea.statusId),
      upvoteCount: upvoteCounts.get(idea.id) ?? 0,
      hasUpvoted: upvoted.has(idea.id),
      commentCount: commentCounts.get(idea.id) ?? 0,
      authorUserId: idea.authorUserId,
      createdAtUtc: idea.createdAtUtc,
    }))
  }

  private async projectDetail(idea: Idea): Promise<IdeaDetail> {
    const tagLookup = await this.loadTagLookup(idea.tagIds)
    const mentionUserIds = [...idea.mentionedUserIds]
    const userLookup = await this.loadUserLookup([
      ...idea.assigneeUserIds,
      ...mentionUserIds,
      idea.authorUserId,
    ])
    const statusInfo = await this.boards.getStatusInfo(idea.organizationId)
    const ideaTypeLookup = await this.loadIdeaTypeLookup(idea.organizationId)
    const businessImpactLookup = await this.loadBusinessImpactLookup(idea.organizationId)
    const upvoteCount = await this.upvoteCounts.countByIdea(idea.id)
    const currentUserId = this.requireAuthenticatedUserId()
    const upvoted = await this.upvoteCounts.getUpvotedIdeaIds(currentUserId, [idea.id])
    const commentCount = await this.comments.countByIdea(idea.id)
    const comments = await this.comments.listByIdea(idea.id)

    const ideaTypeForFields = ideaTypeLookup.get(idea.ideaTypeId) ?? null

    const fieldValues: readonly IdeaFieldValueDto[] = await this.fieldValues.describeForDetail({
      organizationId: idea.organizationId,
      ideaTypeId: idea.ideaTypeId,
      stored: idea.fieldValues,
    })

    const mentions: readonly MentionDto[] = mentionUserIds.flatMap((id) => {
      const user = userLookup.get(id)
      return user
        ? [
            {
              userId: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              displayName: displayName(user),
              email: user.email,
              portraitDataUrl: portraitDataUrl(user),
            },
          ]
        : []
    })

    const commentDtos: readonly IdeaCommentDto[] = comments.map((c) => ({
      commentId: c.commentId,
      ideaId: c.ideaId,
      authorUserId: c.authorUserId,
      body: c.body,
      createdAtUtc: c.createdAtUtc,
      updatedAtUtc: c.updatedAtUtc,
    }))

    return {
      ideaId: idea.id,
      boardId: idea.boardId,
      title: idea.title,
      description: idea.description,
      priority: idea.priority,
      ideaTypeId: idea.ideaTypeId,
      ideaTypeName: this.ideaTypeName(ideaTypeLookup, idea.ideaTypeId),
      ideaTypeColorHex: ideaTypeForFields?.colorHex ?? null,
      ideaTypeIcon: ideaTypeForFields?.icon ?? null,
      businessImpactId: idea.businessImpactId,
      businessImpactName: this.businessImpactName(businessImpactLookup, idea.businessImpactId),
      businessImpactColor: this.businessImpactColor(businessImpactLookup, idea.businessImpactId),
      dueDate: idea.dueDate,
      assignees: this.projectAssignees(idea, userLookup),
      statusId: idea.statusId,
      statusName: this.statusName(statusInfo, idea.statusId),
      tagNames: this.projectTagNames(idea, tagLookup),
      mentions,
      comments: commentDtos,
      upvoteCount,
      hasUpvoted: upvoted.has(idea.id),
      commentCount,
      fieldValues,
      author: this.projectAuthor(idea, userLookup),
      createdAtUtc: idea.createdAtUtc,
    }
  }

  private async loadTagLookup(tagIds: readonly string[]): Promise<ReadonlyMap<string, TagSummary>> {
    const ids = [...new Set(tagIds)]
    if (ids.length === 0) {
      return new Map()
    }
    const tags = await this.tags.listByIds(ids)
    return new Map(tags.map((t) => [t.id, t]))
  }

  private async loadUserLookup(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, UserSummary>> {
    const ids = [...new Set(userIds)]
    if (ids.length === 0) {
      return new Map()
    }
    const users = await this.users.listByIds(ids)
    return new Map(users.map((u) => [u.id, u]))
  }

  // Include archived options so an idea referencing a since-soft-deleted option still renders a
  // label (SPEC/30-Contracts.md: archived references stay readable with an archived indicator).
  private async loadIdeaTypeLookup(
    organizationId: string,
  ): Promise<ReadonlyMap<string, IdeaTypeSummary>> {
    const options = await this.classification.listIdeaTypesByOrganization(organizationId, true)
    return new Map(options.map((o) => [o.id, o]))
  }

  private async loadBusinessImpactLookup(
    organizationId: string,
  ): Promise<ReadonlyMap<string, BusinessImpactSummary>> {
    const options = await this.classification.listBusinessImpactsByOrganization(
      organizationId,
      true,
    )
    return new Map(options.map((o) => [o.id, o]))
  }

  private ideaTypeName(lookup: ReadonlyMap<string, IdeaTypeSummary>, id: string): string {
    return lookup.get(id)?.name ?? ''
  }

  private ideaTypeColorHex(
    lookup: ReadonlyMap<string, IdeaTypeSummary>,
    id: string,
  ): string | null {
    return lookup.get(id)?.colorHex ?? null
  }

  private ideaTypeIcon(lookup: ReadonlyMap<string, IdeaTypeSummary>, id: string): string | null {
    return lookup.get(id)?.icon ?? null
  }

  private businessImpactName(
    lookup: ReadonlyMap<string, BusinessImpactSummary>,
    id: string,
  ): string {
    return lookup.get(id)?.name ?? ''
  }

  private businessImpactColor(
    lookup: ReadonlyMap<string, BusinessImpactSummary>,
    id: string,
  ): string {
    return lookup.get(id)?.color ?? ''
  }

  private statusName(statusInfo: ReadonlyMap<string, StatusInfo>, statusId: string): string {
    return statusInfo.get(statusId)?.name ?? ''
  }

  private projectAssignees(
    idea: Idea,
    userLookup: ReadonlyMap<string, UserSummary>,
  ): readonly IdeaAssigneeDto[] {
    return idea.assigneeUserIds
      .flatMap((id) => {
        const user = userLookup.get(id)
        return user ? [user] : []
      })
      .sort(
        (a, b) =>
          compareIgnoreCase(a.firstName, b.firstName) || compareIgnoreCase(a.lastName, b.lastName),
      )
      .map(toPersonDto)
  }

  private projectAuthor(
    idea: Idea,
    userLookup: ReadonlyMap<string, UserSummary>,
  ): IdeaAssigneeDto | null {
    const author = userLookup.get(idea.authorUserId)
    return author ? toPersonDto(author) : null
  }

  private projectTagNames(
    idea: Idea,
    tagLookup: ReadonlyMap<string, TagSummary>,
  ): readonly string[] {
    return idea.tagIds
      .flatMap((id) => {
        const tag = tagLookup.get(id)
        return tag ? [tag.name] : []
      })
      .sort(compareIgnoreCase)
  }

  // Resolution helpers -----------------------------------------------------------------------

  private async resolveAssignees(
    organizationId: string,
    requested: readonly string[] | null,
    existing: readonly string[],
  ): Promise<readonly string[]> {
    const distinct = distinctNonEmpty(requested)
    if (distinct.length === 0) {
      return distinct
    }

    if (distinct.length > MAX_ASSIGNEES) {
      throw new ValidationError('One or more fields are invalid.', {
        assigneeUserIds: [`An idea can have at most ${MAX_ASSIGNEES} assignees.`],
      })
    }

    const users = await this.users.listByIds(distinct)
    const byId = new Map(users.map((u) => [u.id, u]))
    const existingSet = new Set(existing)
    const errors: string[] = []

    for (const id of distinct) {
      const user = byId.get(id)
      if (!user || user.organizationId !== organizationId) {
        errors.push(`Assignee '${id}' is not a user in this organization.`)
        continue
      }

      // Newly selected assignees must be active; a previously assigned user may be retained even
      // if they later became inactive (rule #12).
      if (user.status !== UserStatus.Active && !existingSet.has(id)) {
        errors.push(`Assignee '${user.email}' is not an active user and cannot be newly assigned.`)
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('One or more fields are invalid.', { assigneeUserIds: errors })
    }

    return distinct
  }

  private async resolveTags(
    organizationId: string,
    tagNames: readonly string[] | null,
    nowUtc: Date,
    actorUserId: string | null,
  ): Promise<readonly string[]> {
    const cleaned = (tagNames ?? []).flatMap((t) => {
      const trimmed = t?.trim()
      return trimmed && trimmed.length > 0 ? [trimmed] : []
    })

    if (cleaned.length === 0) {
      return []
    }

    for (const name of cleaned) {
      if (name.length > MAX_TAG_NAME_LENGTH) {
        throw new ValidationError('One or more fields are invalid.', {
          tagNames: [`Tag must be ${MAX_TAG_NAME_LENGTH} characters or fewer.`],
        })
      }
    }

    const firstByNormalized = new Map<string, string>()
    for (const name of cleaned) {
      const normalized = name.trim().toLowerCase()
      if (!firstByNormalized.has(normalized)) {
        firstByNormalized.set(normalized, name)
      }
    }
    const distinctNormalized = [...firstByNormalized.values()]

    if (distinctNormalized.length > MAX_TAGS) {
      throw new ValidationError('One or more fields are invalid.', {
        tagNames: [`An idea can have at most ${MAX_TAGS} tags.`],
      })
    }

    const tags = await this.tags.getOrCreate({
      organizationId,
      requestedNames: distinctNormalized,
      nowUtc,
      actorUserId,
    })
    return tags.map((t) => t.id)
  }

  /** Resolves raw @-mention email strings to same-organization active user ids. Mirrors .NET's
   * `MentionResolver`, kept local since Ideas is the only owner of `IdeaMention`. */
  private async resolveMentions(
    organizationId: string,
    mentionEmails: readonly string[] | null,
    fieldName: string,
  ): Promise<readonly string[]> {
    if (!mentionEmails || mentionEmails.length === 0) {
      return []
    }

    const resolved: string[] = []
    const errors: string[] = []
    const seen = new Set<string>()

    for (const raw of mentionEmails) {
      const trimmed = raw?.trim()
      if (!trimmed) {
        continue
      }

      const normalized = trimmed.toLowerCase()
      if (seen.has(normalized)) {
        continue
      }
      seen.add(normalized)

      const user = await this.users.findByNormalizedEmail(normalized)
      if (
        !user ||
        user.organizationId !== organizationId ||
        user.role === Role.SiteAdmin ||
        user.status !== UserStatus.Active
      ) {
        errors.push(`Mention '${trimmed}' could not be resolved to a user in your organization.`)
        continue
      }

      resolved.push(user.id)
    }

    if (errors.length > 0) {
      throw new ValidationError('One or more fields are invalid.', { [fieldName]: errors })
    }

    return resolved
  }

  private async getActiveIdeaType(
    organizationId: string,
    ideaTypeId: string,
  ): Promise<IdeaTypeSummary> {
    const option = ideaTypeId ? await this.classification.getIdeaTypeById(ideaTypeId) : null
    if (!option || option.organizationId !== organizationId || option.isDeleted) {
      throw new ValidationError('One or more fields are invalid.', {
        ideaTypeId: ['Idea Type must reference an active option in the organization.'],
      })
    }
    return option
  }

  private async ensureActiveBusinessImpact(
    organizationId: string,
    businessImpactId: string,
  ): Promise<void> {
    const option = businessImpactId
      ? await this.classification.getBusinessImpactById(businessImpactId)
      : null
    if (!option || option.organizationId !== organizationId || option.isDeleted) {
      throw new ValidationError('One or more fields are invalid.', {
        businessImpactId: ['Business Impact must reference an active option in the organization.'],
      })
    }
  }

  // Authorization / scoping --------------------------------------------------------------------

  private requireAuthenticatedUserId(): string {
    const currentUser = this.currentUser
    if (!currentUser.isAuthenticated || currentUser.userId === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return currentUser.userId
  }

  private requireAuthenticatedRole(): Role {
    const currentUser = this.currentUser
    if (!currentUser.isAuthenticated || currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return currentUser.role
  }

  private requireIdeaEditRole(): void {
    if (this.requireAuthenticatedRole() === Role.ReadOnly) {
      throw new ForbiddenError('Read Only users cannot create or edit ideas.')
    }
  }

  private ensureOrganizationScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    if (role === Role.SiteAdmin) {
      return
    }
    if (this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Idea not found.')
    }
  }

  /** User-role status moves are allowed only when the board opts in (rule #34); Site Admin and
   * in-scope Org Admin may always move; Read Only never. */
  private ensureCanMoveIdea(board: BoardContext): void {
    const role = this.requireAuthenticatedRole()
    if (role === Role.SiteAdmin || role === Role.OrgAdmin) {
      return
    }
    if (role === Role.User && board.allowUserStatusUpdate) {
      return
    }
    throw new ForbiddenError('You are not allowed to move ideas on this board.')
  }

  private canAdministerIdeaContent(
    idea: Idea,
    actorUserId: string | null,
    adminOnly = false,
  ): boolean {
    const role = this.requireAuthenticatedRole()
    if (role === Role.SiteAdmin) {
      return true
    }
    if (role === Role.OrgAdmin && this.currentUser.organizationId === idea.organizationId) {
      return true
    }
    if (adminOnly) {
      return false
    }
    return this.currentUser.userId === idea.authorUserId && !!actorUserId
  }

  // Audit ----------------------------------------------------------------------------------------

  private async writeAudit(input: {
    eventType: string
    entityType: string
    entityId: string | null
    organizationId: string | null
    intendedActorUserId: string | null
    message: string
    nowUtc: Date
    metadata: unknown
  }): Promise<void> {
    await this.auditEvents.write({
      eventType: input.eventType,
      entityType: input.entityType,
      message: input.message,
      occurredAtUtc: input.nowUtc,
      organizationId: input.organizationId,
      attribution: attributeAudit(this.currentUser, input.intendedActorUserId),
      entityId: input.entityId,
      metadataJson: input.metadata === null ? null : JSON.stringify(input.metadata),
    })
  }

  private async auditIdea(
    eventType: string,
    idea: Idea,
    actorUserId: string | null,
    message: string,
    nowUtc: Date,
    metadata: unknown,
  ): Promise<void> {
    await this.writeAudit({
      eventType,
      entityType: 'Idea',
      entityId: idea.id,
      organizationId: idea.organizationId,
      intendedActorUserId: actorUserId,
      message,
      nowUtc,
      metadata,
    })
  }

  /** Emits an `IdeaFieldValueChanged` audit event for each User-Defined Field value that was
   * added, changed, or cleared. */
  private async emitFieldValueAudit(
    idea: Idea,
    previousValues: ReadonlyMap<string, string | null>,
    actorId: string,
    nowUtc: Date,
  ): Promise<void> {
    const currentValues = new Map(idea.fieldValues.map((v) => [v.fieldDefinitionId, v.value]))
    const allIds = new Set([...previousValues.keys(), ...currentValues.keys()])
    if (allIds.size === 0) {
      return
    }

    const fieldNames = await this.fieldValues.getFieldNames(idea.organizationId, [...allIds])

    for (const fieldDefinitionId of allIds) {
      const previousValue = previousValues.get(fieldDefinitionId) ?? null
      const newValue = currentValues.get(fieldDefinitionId) ?? null
      if (previousValue === newValue) {
        continue
      }

      const fieldName = fieldNames.get(fieldDefinitionId) ?? fieldDefinitionId
      await this.auditIdea(
        'IdeaFieldValueChanged',
        idea,
        actorId,
        `Custom field '${fieldName}' changed on idea '${idea.title}'.`,
        nowUtc,
        { fieldDefinitionId, fieldName, previousValue, newValue },
      )
    }
  }

  // Notification emission --------------------------------------------------------------------
  // Persisted only (never delivered). Self- and duplicate-recipient suppression is applied here
  // and defensively again in the writer.

  private async notifyMentions(
    idea: Idea,
    mentionedUserIds: readonly string[],
    actorId: string,
  ): Promise<void> {
    const seen = new Set<string>()
    for (const recipientId of mentionedUserIds) {
      if (!recipientId || recipientId === actorId || seen.has(recipientId)) {
        continue
      }
      seen.add(recipientId)
      await this.notifications.notify({
        eventType: 'IdeaMention',
        organizationId: idea.organizationId,
        boardId: idea.boardId,
        ideaId: idea.id,
        ideaTitle: idea.title,
        actorUserId: actorId,
        recipientUserId: recipientId,
      })
    }
  }

  private async notifyIdeaFollowers(
    eventType: NotificationEventType,
    idea: Idea,
    actorId: string,
  ): Promise<void> {
    const recipients = new Set<string>([idea.authorUserId, ...idea.assigneeUserIds])
    for (const recipientId of recipients) {
      if (!recipientId || recipientId === actorId) {
        continue
      }
      await this.notifications.notify({
        eventType,
        organizationId: idea.organizationId,
        boardId: idea.boardId,
        ideaId: idea.id,
        ideaTitle: idea.title,
        actorUserId: actorId,
        recipientUserId: recipientId,
      })
    }
  }
}

// Module-level helpers ---------------------------------------------------------------------------

/** One user as the idea payloads carry a person - assignees and the detail's author alike. */
function toPersonDto(user: UserSummary): IdeaAssigneeDto {
  return {
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: displayName(user),
    isActive: user.status === UserStatus.Active,
    portraitDataUrl: portraitDataUrl(user),
  }
}

function displayName(user: UserSummary): string {
  return `${user.firstName} ${user.lastName}`.trim()
}

// Portraits ride along as inline data URLs so any avatar surface can render the picture wherever
// it renders initials, without a second per-user request. Null -> initials fallback.
function portraitDataUrl(user: UserSummary): string | null {
  return user.portraitPng && user.portraitPng.length > 0
    ? `data:image/png;base64,${Buffer.from(user.portraitPng).toString('base64')}`
    : null
}

function compareIgnoreCase(a: string, b: string): number {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}

function distinctNonEmpty(ids: readonly string[] | null | undefined): string[] {
  if (!ids) {
    return []
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    result.push(id)
  }
  return result
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const item of a) {
    if (!b.has(item)) {
      return false
    }
  }
  return true
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false
  }
  const [rawYear, rawMonth, rawDay] = value.split('-')
  const year = Number(rawYear)
  const month = Number(rawMonth)
  const day = Number(rawDay)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

function parsePriority(value: string | null): Priority {
  const parsed = parseOptionalPriority(value)
  if (parsed === null) {
    throw new ValidationError('One or more fields are invalid.', {
      priority: [
        `Priority must be one of: ${Priority.Low}, ${Priority.Medium}, ${Priority.High}, ${Priority.Critical}.`,
      ],
    })
  }
  return parsed
}

function parseOptionalPriority(value: string | null | undefined): Priority | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  const lower = trimmed.toLowerCase()
  const match = Object.values(Priority).find((p) => p.toLowerCase() === lower)
  return match ?? null
}

function parseDueDate(value: string | null): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  if (!isValidIsoDate(trimmed)) {
    throw new ValidationError('One or more fields are invalid.', {
      dueDate: ['Due Date must be a valid date (YYYY-MM-DD).'],
    })
  }
  return trimmed
}

function parseOptionalDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  return isValidIsoDate(trimmed) ? trimmed : null
}

function splitTags(value: string | null): readonly string[] {
  if (!value) {
    return []
  }
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function flattenValidationErrors(error: ValidationError): string {
  return Object.values(error.failures).flat().join('; ')
}

/**
 * Wraps a domain transition so an `IdeaDomainError` (a plain-Error invariant violation - packages/
 * domain imports nothing, so it cannot throw the kernel's `ValidationError` itself) surfaces as a
 * proper field-level 400, mirroring how .NET let `Idea`'s `ArgumentException` reach the API.
 *
 * Takes `fn` and its arguments separately, rather than a `() => T` thunk, so a narrowed `let`
 * (e.g. `idea` after a `null` guard) is read as a plain argument expression instead of inside a
 * closure body - TypeScript does not carry narrowing for a mutable binding into a closure.
 */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof IdeaDomainError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}

function createIdeaOrThrow(props: Parameters<typeof createIdea>[0]): Idea {
  return runDomain(createIdea, props)
}
