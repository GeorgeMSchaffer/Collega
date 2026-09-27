// Satisfies `IdeaRepository` (ideas/ports.ts) - the largest aggregate in this slice.
//
// `add`/`update` persist the idea row plus its four child collections (assignees, mentions, tags,
// field values) as a full replace: every one of those junction tables is either keyed by a
// composite unique index with no id of its own semantics that matter to the domain
// (`idea_assignees`, `idea_mentions`, `idea_tags`) or carries values the domain always submits as
// a complete replacement set (`idea_field_values`, per `Idea.replaceFieldValues`'s own reconcile
// semantics) - so delete-then-recreate is simpler than a diff and behaviourally identical, matching
// `board.repository.ts`'s swimlanes.
//
// `listByBoard` and `listByOrganization` both carry a MANDATORY total order, tie-broken on
// `createdAtUtc` then `title` - never on id alone - per the golden-capture finding documented on
// `IdeaListFilter.sortBy` and repeated on `OrganizationIdeaListFilter`; the id follows them only
// as the last key. Both lists' search/sort need the author's, an assignee's, the status's and the
// board's NAME, and the frozen schema declares no Prisma relation from `ideas` to `users`
// (author), `statuses` or `boards` - only `organization_id`/`business_impact_id`/`idea_type_id`
// are modelled as relations there - so those two queries are raw SQL rather than Prisma's typed
// query builder, which cannot express the join. Everything else in this file uses the typed API.

import { randomUUID } from 'node:crypto'
import type { SortDirection } from '@collega/application/common'
import type {
  DeliveryFilter,
  IdeaFieldValueSnapshot,
  IdeaListFilter,
  IdeaPage,
  IdeaRepository,
  OrganizationIdeaListFilter,
} from '@collega/application/ideas'
import type { SprintIssueCounts, SprintIssuesPort } from '@collega/application/sprints'
import type { DeliveryStatus, EffortLevel, IdeaPhase, Priority } from '@collega/domain/enums'
import { DeliveryStatus as Delivery, IdeaPhase as Phase } from '@collega/domain/enums'
import type { Idea, IdeaFieldValueRecord } from '@collega/domain/ideas'
import type {
  idea_assignees as AssigneeRow,
  idea_field_values as FieldValueRow,
  ideas as IdeaRow,
  idea_mentions as MentionRow,
  idea_tags as TagLinkRow,
} from '../generated/prisma/index.js'
import { Prisma } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

type IdeaRowFull = IdeaRow & {
  idea_assignees: AssigneeRow[]
  idea_mentions: MentionRow[]
  idea_tags: TagLinkRow[]
  idea_field_values: FieldValueRow[]
}

const IDEA_INCLUDE = {
  idea_assignees: true,
  idea_mentions: true,
  idea_tags: true,
  idea_field_values: true,
} as const

function toDueDateString(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

function fromDueDateString(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}

function fromRow(row: IdeaRowFull): Idea {
  const fieldValues: IdeaFieldValueRecord[] = row.idea_field_values.map((v) => ({
    fieldDefinitionId: v.field_definition_id,
    value: v.value ?? '',
  }))

  return {
    id: row.id,
    organizationId: row.organization_id,
    boardId: row.board_id,
    statusId: row.status_id,
    title: row.title,
    description: row.description,
    problem: row.problem,
    proposedSolutions: row.proposed_solutions,
    impactRationale: row.impact_rationale,
    priority: row.priority as Priority,
    ideaTypeId: row.idea_type_id,
    businessImpactId: row.business_impact_id,
    dueDate: toDueDateString(row.due_date),
    authorUserId: row.author_user_id,
    isDeleted: row.is_deleted,
    assigneeUserIds: row.idea_assignees.map((a) => a.user_id),
    tagIds: row.idea_tags.map((t) => t.tag_id),
    mentionedUserIds: row.idea_mentions.map((m) => m.mentioned_user_id),
    fieldValues,
    phase: row.phase as IdeaPhase,
    effort: row.effort as EffortLevel | null,
    deliveryStatus: row.delivery_status as DeliveryStatus | null,
    sprintId: row.sprint_id,
    promotedAtUtc: row.promoted_at_utc,
    promotedByUserId: row.promoted_by_user_id,
    upvoteCountAtPromotion: row.upvote_count_at_promotion,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

/** Live upvotes on the idea, for the `upvoteCount` sort. */
const UPVOTE_COUNT_SQL = Prisma.sql`(SELECT COUNT(*) FROM idea_upvotes iu WHERE iu.idea_id = i.id)`

/** The idea's alphabetically-first tag, case-insensitively, for the `tags` sort; NULL untagged. */
const FIRST_TAG_SQL = Prisma.sql`(SELECT MIN(LOWER(t.name)) FROM idea_tags it JOIN tags t ON t.id = it.tag_id WHERE it.idea_id = i.id)`

function uuidList(ids: readonly string[]): Prisma.Sql {
  return Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))
}

export class PrismaIdeaRepository implements IdeaRepository, SprintIssuesPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(ideaId: string, includeDeleted = false): Promise<Idea | null> {
    const row = await this.prisma.ideas.findFirst({
      where: { id: ideaId, ...(includeDeleted ? {} : { is_deleted: false }) },
      include: IDEA_INCLUDE,
    })
    return row ? fromRow(row) : null
  }

  async add(idea: Idea): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.ideas.create({ data: this.scalarWriteData(idea) }))
    this.enqueueChildren(idea)
  }

  async update(idea: Idea): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.ideas.update({ where: { id: idea.id }, data: this.scalarWriteData(idea) }),
    )
    this.unitOfWork.enqueue(this.prisma.idea_assignees.deleteMany({ where: { idea_id: idea.id } }))
    this.unitOfWork.enqueue(this.prisma.idea_mentions.deleteMany({ where: { idea_id: idea.id } }))
    this.unitOfWork.enqueue(this.prisma.idea_tags.deleteMany({ where: { idea_id: idea.id } }))
    this.unitOfWork.enqueue(
      this.prisma.idea_field_values.deleteMany({ where: { idea_id: idea.id } }),
    )
    this.enqueueChildren(idea)
  }

  private enqueueChildren(idea: Idea): void {
    if (idea.assigneeUserIds.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.idea_assignees.createMany({
          data: idea.assigneeUserIds.map((userId) => ({
            id: randomUUID(),
            idea_id: idea.id,
            user_id: userId,
          })),
        }),
      )
    }
    if (idea.mentionedUserIds.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.idea_mentions.createMany({
          data: idea.mentionedUserIds.map((userId) => ({
            id: randomUUID(),
            idea_id: idea.id,
            mentioned_user_id: userId,
          })),
        }),
      )
    }
    if (idea.tagIds.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.idea_tags.createMany({
          data: idea.tagIds.map((tagId) => ({ id: randomUUID(), idea_id: idea.id, tag_id: tagId })),
        }),
      )
    }
    if (idea.fieldValues.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.idea_field_values.createMany({
          data: idea.fieldValues.map((v) => ({
            id: randomUUID(),
            idea_id: idea.id,
            field_definition_id: v.fieldDefinitionId,
            value: v.value,
            created_at_utc: idea.updatedAtUtc,
            updated_at_utc: idea.updatedAtUtc,
            created_by_user_id: idea.updatedByUserId,
            updated_by_user_id: idea.updatedByUserId,
          })),
        }),
      )
    }
  }

  private scalarWriteData(idea: Idea) {
    return {
      id: idea.id,
      organization_id: idea.organizationId,
      board_id: idea.boardId,
      status_id: idea.statusId,
      title: idea.title,
      description: idea.description,
      problem: idea.problem,
      proposed_solutions: [...idea.proposedSolutions],
      impact_rationale: idea.impactRationale,
      priority: idea.priority,
      idea_type_id: idea.ideaTypeId,
      business_impact_id: idea.businessImpactId,
      due_date: fromDueDateString(idea.dueDate),
      author_user_id: idea.authorUserId,
      is_deleted: idea.isDeleted,
      phase: idea.phase,
      effort: idea.effort,
      delivery_status: idea.deliveryStatus,
      sprint_id: idea.sprintId,
      promoted_at_utc: idea.promotedAtUtc,
      promoted_by_user_id: idea.promotedByUserId,
      upvote_count_at_promotion: idea.upvoteCountAtPromotion,
      created_at_utc: idea.createdAtUtc,
      updated_at_utc: idea.updatedAtUtc,
      created_by_user_id: idea.createdByUserId,
      updated_by_user_id: idea.updatedByUserId,
    }
  }

  async getFieldValuesByIdeaIds(
    ideaIds: readonly string[],
  ): Promise<readonly IdeaFieldValueSnapshot[]> {
    if (ideaIds.length === 0) {
      return []
    }
    const rows = await this.prisma.idea_field_values.findMany({
      where: { idea_id: { in: [...ideaIds] } },
    })
    return rows.map((row) => ({
      ideaId: row.idea_id,
      fieldDefinitionId: row.field_definition_id,
      value: row.value,
    }))
  }

  // Delivery (Issues-and-Delivery Slice 1) ------------------------------------------------------

  /**
   * The sprint board and the delivery backlog. Unpaged - a sprint is a small, time-boxed set and a
   * board that pages is not a board - but still totally ordered on `createdAtUtc` then `title`,
   * never id, per the golden-capture finding in this file's header: the sprint board groups by
   * delivery status client-side, so a wobbling order inside a swimlane is just as visible.
   */
  async listDelivery(filter: DeliveryFilter): Promise<readonly Idea[]> {
    const rows = await this.prisma.ideas.findMany({
      where: {
        organization_id: filter.organizationId,
        is_deleted: false,
        phase: Phase.Delivery,
        ...(filter.backlogOnly ? { sprint_id: null } : {}),
        ...(filter.sprintId ? { sprint_id: filter.sprintId } : {}),
        ...(filter.deliveryStatus ? { delivery_status: filter.deliveryStatus } : {}),
      },
      include: IDEA_INCLUDE,
      orderBy: [{ created_at_utc: 'asc' }, { title: 'asc' }],
    })
    return rows.map(fromRow)
  }

  async listBySprint(sprintId: string): Promise<readonly Idea[]> {
    const rows = await this.prisma.ideas.findMany({
      where: { sprint_id: sprintId, is_deleted: false },
      include: IDEA_INCLUDE,
      orderBy: [{ created_at_utc: 'asc' }, { title: 'asc' }],
    })
    return rows.map(fromRow)
  }

  /** One grouped query for every sprint on the page - see `SprintIssuesPort.countsBySprintIds`. */
  async countsBySprintIds(
    sprintIds: readonly string[],
  ): Promise<ReadonlyMap<string, SprintIssueCounts>> {
    if (sprintIds.length === 0) {
      return new Map()
    }

    const grouped = await this.prisma.ideas.groupBy({
      by: ['sprint_id', 'delivery_status'],
      where: { sprint_id: { in: [...sprintIds] }, is_deleted: false },
      _count: { _all: true },
    })

    const counts = new Map<string, SprintIssueCounts>()
    for (const group of grouped) {
      if (!group.sprint_id) {
        continue
      }
      const current = counts.get(group.sprint_id) ?? { issueCount: 0, doneCount: 0 }
      const count = group._count._all
      counts.set(group.sprint_id, {
        issueCount: current.issueCount + count,
        doneCount: current.doneCount + (group.delivery_status === Delivery.Complete ? count : 0),
      })
    }
    return counts
  }

  async listByBoard(filter: IdeaListFilter): Promise<IdeaPage<Idea>> {
    const direction: SortDirection = filter.sortDirection === 'desc' ? 'desc' : 'asc'

    const conditions: Prisma.Sql[] = [
      Prisma.sql`i.board_id = ${filter.boardId}::uuid`,
      Prisma.sql`i.is_deleted = FALSE`,
      ...this.listFilterConditions(filter),
    ]
    if (filter.phase) {
      conditions.push(Prisma.sql`i.phase = ${filter.phase}::"IdeaPhase"`)
    }
    if (filter.dueBefore) {
      conditions.push(Prisma.sql`i.due_date < ${filter.dueBefore}::date`)
    }
    if (filter.search) {
      conditions.push(this.searchCondition(filter, false))
    }

    return this.listPage({
      conditions,
      sortSql: this.boardSortSql(filter.sortBy),
      direction,
      page: filter.page,
      sortBy: filter.sortBy,
    })
  }

  /**
   * `sortBy` for the board list, matched on the trimmed, lowercased value as
   * `SortBy?.Trim().ToLowerInvariant()` did in `EfIdeaRepository` - so `PRIORITY` and ` dueDate `
   * sort the way they read. `title`, `status` (lane order), `assignedTo` and `tags` were added
   * 2026-09-27; anything unrecognised is createdAt.
   */
  private boardSortSql(sortBy: string | null): Prisma.Sql {
    switch ((sortBy ?? '').trim().toLowerCase()) {
      case 'updatedat':
        return Prisma.sql`i.updated_at_utc`
      case 'priority':
        return Prisma.sql`i.priority`
      case 'duedate':
        return Prisma.sql`i.due_date`
      case 'upvotecount':
        return UPVOTE_COUNT_SQL
      case 'title':
        return Prisma.sql`i.title`
      case 'status':
        return Prisma.sql`(SELECT bs.display_order FROM board_swimlanes bs WHERE bs.board_id = i.board_id AND bs.status_id = i.status_id)`
      case 'assignedto':
        return Prisma.sql`assignee.name`
      case 'tags':
        return FIRST_TAG_SQL
      default:
        return Prisma.sql`i.created_at_utc`
    }
  }

  async listByOrganization(filter: OrganizationIdeaListFilter): Promise<IdeaPage<Idea>> {
    const direction: SortDirection = filter.sortDirection === 'desc' ? 'desc' : 'asc'

    const conditions: Prisma.Sql[] = [
      Prisma.sql`i.organization_id = ${filter.organizationId}::uuid`,
      Prisma.sql`i.is_deleted = FALSE`,
      ...this.listFilterConditions(filter),
    ]

    if (filter.phase) {
      conditions.push(Prisma.sql`i.phase = ${filter.phase}::"IdeaPhase"`)
    }
    if (filter.boardIds.length > 0) {
      conditions.push(Prisma.sql`i.board_id IN (${uuidList(filter.boardIds)})`)
    }
    if (filter.createdByUserId) {
      conditions.push(Prisma.sql`i.author_user_id = ${filter.createdByUserId}::uuid`)
    }
    if (filter.assignedToUserId) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM idea_assignees ia WHERE ia.idea_id = i.id AND ia.user_id = ${filter.assignedToUserId}::uuid)`,
      )
    }
    if (filter.associatedUserId) {
      conditions.push(
        Prisma.sql`(i.author_user_id = ${filter.associatedUserId}::uuid OR EXISTS (SELECT 1 FROM idea_assignees ia2 WHERE ia2.idea_id = i.id AND ia2.user_id = ${filter.associatedUserId}::uuid))`,
      )
    }
    for (const fieldFilter of filter.fieldFilters) {
      const fragment = this.fieldFilterFragment(fieldFilter)
      if (fragment) {
        conditions.push(fragment)
      }
    }
    if (filter.search) {
      conditions.push(this.searchCondition(filter, true))
    }

    return this.listPage({
      conditions,
      sortSql: this.organizationSortSql(filter.sortBy),
      direction,
      page: filter.page,
      sortBy: filter.sortBy,
    })
  }

  /**
   * `sortBy` for the organization list, matched the same way as the board list's. `board`,
   * `priority` (Low to Critical, the enum's declared order), `upvoteCount` and `tags` were added
   * 2026-09-27; anything unrecognised is createdAt.
   */
  private organizationSortSql(sortBy: string | null): Prisma.Sql {
    switch ((sortBy ?? '').trim().toLowerCase()) {
      case 'title':
        return Prisma.sql`i.title`
      case 'createdby':
        return Prisma.sql`(au.first_name || ' ' || au.last_name)`
      case 'assignedto':
        return Prisma.sql`assignee.name`
      case 'status':
        return Prisma.sql`s.name`
      case 'board':
        return Prisma.sql`b.name`
      case 'priority':
        return Prisma.sql`i.priority`
      case 'upvotecount':
        return UPVOTE_COUNT_SQL
      case 'tags':
        return FIRST_TAG_SQL
      default:
        return Prisma.sql`i.created_at_utc`
    }
  }

  /** The repeatable filters both lists share: any-of within one, AND across them. */
  private listFilterConditions(filter: {
    readonly statusIds: readonly string[]
    readonly priorities: readonly string[]
    readonly tags: readonly string[]
  }): Prisma.Sql[] {
    const conditions: Prisma.Sql[] = []
    if (filter.statusIds.length > 0) {
      conditions.push(Prisma.sql`i.status_id IN (${uuidList(filter.statusIds)})`)
    }
    if (filter.priorities.length > 0) {
      conditions.push(
        Prisma.sql`i.priority IN (${Prisma.join(filter.priorities.map((p) => Prisma.sql`${p}::"Priority"`))})`,
      )
    }
    if (filter.tags.length > 0) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM idea_tags it JOIN tags t ON t.id = it.tag_id WHERE it.idea_id = i.id AND t.normalized_name IN (${Prisma.join(filter.tags)}))`,
      )
    }
    return conditions
  }

  /**
   * The all-column search (SPEC/30-Contracts.md): case-insensitive substring over title, author
   * and assignee names, status name, priority, tag names, Problem and the Text/Url field values,
   * plus ideas created on the day the term names when it is an ISO date. The organization list also
   * matches the board name; on a board's own list every idea shares one, so it would match all or
   * nothing.
   */
  private searchCondition(
    filter: {
      readonly search: string | null
      readonly searchTextFieldIds: readonly string[]
      readonly searchCreatedOnDate: string | null
    },
    includeBoardName: boolean,
  ): Prisma.Sql {
    const term = `%${filter.search ?? ''}%`
    const clauses: Prisma.Sql[] = [
      Prisma.sql`i.title ILIKE ${term}`,
      Prisma.sql`i.problem ILIKE ${term}`,
      Prisma.sql`i.priority::text ILIKE ${term}`,
      Prisma.sql`(au.first_name ILIKE ${term} OR au.last_name ILIKE ${term} OR (au.first_name || ' ' || au.last_name) ILIKE ${term})`,
      Prisma.sql`EXISTS (SELECT 1 FROM idea_assignees ia3 JOIN users u3 ON u3.id = ia3.user_id WHERE ia3.idea_id = i.id AND (u3.first_name ILIKE ${term} OR u3.last_name ILIKE ${term} OR (u3.first_name || ' ' || u3.last_name) ILIKE ${term}))`,
      Prisma.sql`s.name ILIKE ${term}`,
      Prisma.sql`EXISTS (SELECT 1 FROM idea_tags it2 JOIN tags t2 ON t2.id = it2.tag_id WHERE it2.idea_id = i.id AND t2.name ILIKE ${term})`,
    ]
    if (includeBoardName) {
      clauses.push(Prisma.sql`b.name ILIKE ${term}`)
    }
    if (filter.searchTextFieldIds.length > 0) {
      clauses.push(
        Prisma.sql`EXISTS (SELECT 1 FROM idea_field_values v WHERE v.idea_id = i.id AND v.field_definition_id IN (${uuidList(filter.searchTextFieldIds)}) AND v.value ILIKE ${term})`,
      )
    }
    if (filter.searchCreatedOnDate) {
      clauses.push(
        Prisma.sql`i.created_at_utc >= ${filter.searchCreatedOnDate}::date AND i.created_at_utc < (${filter.searchCreatedOnDate}::date + 1)`,
      )
    }
    return Prisma.sql`(${Prisma.join(clauses, ' OR ')})`
  }

  /**
   * One page of ideas in a TOTAL ORDER: the requested sort, then the mandated tie-break
   * (createdAtUtc, title) and finally the id, which can only decide between ideas those two leave
   * tied (see the file header and `IdeaListFilter.sortBy`).
   *
   * Raw SQL for both lists, because search and sort need the author's, an assignee's, the
   * status's and the board's names and the frozen schema models no relation from `ideas` to
   * `users`, `statuses` or `boards`.
   */
  private async listPage(input: {
    readonly conditions: readonly Prisma.Sql[]
    readonly sortSql: Prisma.Sql
    readonly direction: SortDirection
    readonly page: { readonly page: number; readonly pageSize: number }
    readonly sortBy: string | null
  }): Promise<IdeaPage<Idea>> {
    const whereClause = Prisma.join([...input.conditions], ' AND ')
    const directionSql = input.direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`
    const orderByClause = Prisma.sql`ORDER BY ${input.sortSql} ${directionSql}, i.created_at_utc ASC, i.title ASC, i.id ASC`

    const fromClause = Prisma.sql`
      FROM ideas i
      LEFT JOIN users au ON au.id = i.author_user_id
      LEFT JOIN statuses s ON s.id = i.status_id
      LEFT JOIN boards b ON b.id = i.board_id
      LEFT JOIN LATERAL (
        SELECT (u.first_name || ' ' || u.last_name) AS name
        FROM idea_assignees ia
        JOIN users u ON u.id = ia.user_id
        WHERE ia.idea_id = i.id
        ORDER BY u.first_name ASC, u.last_name ASC
        LIMIT 1
      ) assignee ON TRUE
    `

    const idRows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT i.id
      ${fromClause}
      WHERE ${whereClause}
      ${orderByClause}
      LIMIT ${input.page.pageSize} OFFSET ${(input.page.page - 1) * input.page.pageSize}
    `)

    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      ${fromClause}
      WHERE ${whereClause}
    `)
    const totalCount = Number(countRows[0]?.count ?? 0n)

    const ids = idRows.map((r) => r.id)
    const rowsById = new Map(
      (await this.prisma.ideas.findMany({ where: { id: { in: ids } }, include: IDEA_INCLUDE })).map(
        (row) => [row.id, row] as const,
      ),
    )
    const items = ids.flatMap((id) => {
      const row = rowsById.get(id)
      return row ? [fromRow(row)] : []
    })

    return {
      items,
      page: input.page.page,
      pageSize: input.page.pageSize,
      totalCount,
      sortBy: input.sortBy,
      sortDirection: input.direction,
    }
  }

  private fieldFilterFragment(filter: {
    readonly fieldDefinitionId: string
    readonly kind: string
    readonly value: string | null
    readonly min: string | null
    readonly max: string | null
  }): Prisma.Sql | null {
    const base = Prisma.sql`v.idea_id = i.id AND v.field_definition_id = ${filter.fieldDefinitionId}::uuid`

    switch (filter.kind) {
      case 'contains':
        if (!filter.value) return null
        return Prisma.sql`EXISTS (SELECT 1 FROM idea_field_values v WHERE ${base} AND v.value ILIKE ${`%${filter.value}%`})`
      case 'equals':
        if (!filter.value) return null
        return Prisma.sql`EXISTS (SELECT 1 FROM idea_field_values v WHERE ${base} AND v.value = ${filter.value})`
      case 'multiSelectContains':
        if (!filter.value) return null
        return Prisma.sql`EXISTS (SELECT 1 FROM idea_field_values v WHERE ${base} AND (v.value = ${filter.value} OR v.value LIKE ${`${filter.value},%`} OR v.value LIKE ${`%,${filter.value}`} OR v.value LIKE ${`%,${filter.value},%`}))`
      case 'numberRange': {
        const bounds: Prisma.Sql[] = [Prisma.sql`v.value ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'`]
        if (filter.min) bounds.push(Prisma.sql`CAST(v.value AS numeric) >= ${filter.min}::numeric`)
        if (filter.max) bounds.push(Prisma.sql`CAST(v.value AS numeric) <= ${filter.max}::numeric`)
        return Prisma.sql`EXISTS (SELECT 1 FROM idea_field_values v WHERE ${base} AND ${Prisma.join(bounds, ' AND ')})`
      }
      case 'dateRange': {
        const bounds: Prisma.Sql[] = []
        if (filter.min) bounds.push(Prisma.sql`v.value >= ${filter.min}`)
        if (filter.max) bounds.push(Prisma.sql`v.value <= ${filter.max}`)
        if (bounds.length === 0) return null
        return Prisma.sql`EXISTS (SELECT 1 FROM idea_field_values v WHERE ${base} AND ${Prisma.join(bounds, ' AND ')})`
      }
      default:
        return null
    }
  }
}
