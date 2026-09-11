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
// `createdAtUtc` then `title` - NEVER on id - per the golden-capture finding documented on
// `IdeaListFilter.sortBy` and repeated on `OrganizationIdeaListFilter`. `listByOrganization`'s
// search/sort additionally needs the author's, an assignee's, and the status's NAME, and the
// frozen schema declares no Prisma relation from `ideas` to `users` (author) or `statuses` - only
// `organization_id`/`business_impact_id`/`idea_type_id` are modelled as relations there - so that
// one query is raw SQL rather than Prisma's typed query builder, which cannot express the join.
// Everything else in this file uses the typed API.

import { randomUUID } from 'node:crypto'
import type { SortDirection } from '@collega/application/common'
import type {
  IdeaFieldValueSnapshot,
  IdeaListFilter,
  IdeaPage,
  IdeaRepository,
  OrganizationIdeaListFilter,
} from '@collega/application/ideas'
import type { DeliveryStatus, EffortLevel, IdeaPhase, Priority } from '@collega/domain/enums'
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

export class PrismaIdeaRepository implements IdeaRepository {
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

  async listByBoard(filter: IdeaListFilter): Promise<IdeaPage<Idea>> {
    const direction: SortDirection = filter.sortDirection === 'desc' ? 'desc' : 'asc'

    const where: Prisma.ideasWhereInput = {
      board_id: filter.boardId,
      is_deleted: false,
      ...(filter.statusId ? { status_id: filter.statusId } : {}),
      ...(filter.priority ? { priority: filter.priority } : {}),
      ...(filter.dueBefore
        ? { due_date: { lt: new Date(`${filter.dueBefore}T00:00:00.000Z`) } }
        : {}),
      ...(filter.search ? { title: { contains: filter.search, mode: 'insensitive' } } : {}),
      ...(filter.tag ? { idea_tags: { some: { tags: { normalized_name: filter.tag } } } } : {}),
    }

    // TOTAL ORDER: the requested sort, then the mandated tie-break (createdAtUtc, title) -
    // NEVER id (golden-capture finding, see the file header).
    const orderBy: Prisma.ideasOrderByWithRelationInput[] = [
      ...this.boardSortOrderBy(filter.sortBy, direction),
      { created_at_utc: 'asc' },
      { title: 'asc' },
    ]

    const [rows, totalCount] = await Promise.all([
      this.prisma.ideas.findMany({
        where,
        include: IDEA_INCLUDE,
        orderBy,
        skip: (filter.page.page - 1) * filter.page.pageSize,
        take: filter.page.pageSize,
      }),
      this.prisma.ideas.count({ where }),
    ])

    return {
      items: rows.map(fromRow),
      page: filter.page.page,
      pageSize: filter.page.pageSize,
      totalCount,
      sortBy: filter.sortBy,
      sortDirection: direction,
    }
  }

  private boardSortOrderBy(
    sortBy: string | null,
    direction: SortDirection,
  ): Prisma.ideasOrderByWithRelationInput[] {
    // Matched on the trimmed, lowercased value, as `SortBy?.Trim().ToLowerInvariant()` did in
    // `EfIdeaRepository` - so `PRIORITY` and ` dueDate ` sort the way they read.
    switch ((sortBy ?? '').trim().toLowerCase()) {
      case 'updatedat':
        return [{ updated_at_utc: direction }]
      case 'priority':
        return [{ priority: direction }]
      case 'duedate':
        return [{ due_date: direction }]
      case 'upvotecount':
        return [{ idea_upvotes: { _count: direction } }]
      default:
        return [{ created_at_utc: direction }]
    }
  }

  async listByOrganization(filter: OrganizationIdeaListFilter): Promise<IdeaPage<Idea>> {
    const direction: SortDirection = filter.sortDirection === 'desc' ? 'desc' : 'asc'
    // Matched on the trimmed, lowercased value, as `SortBy?.Trim().ToLowerInvariant()` did in
    // `EfIdeaRepository`; anything else falls back to createdAt.
    const sortKey = (filter.sortBy ?? '').trim().toLowerCase()
    const sortBy =
      sortKey === 'title'
        ? 'title'
        : sortKey === 'createdby'
          ? 'createdBy'
          : sortKey === 'assignedto'
            ? 'assignedTo'
            : sortKey === 'status'
              ? 'status'
              : 'createdAt'

    const conditions: Prisma.Sql[] = [
      Prisma.sql`i.organization_id = ${filter.organizationId}::uuid`,
      Prisma.sql`i.is_deleted = false`,
    ]

    if (filter.createdByUserId) {
      conditions.push(Prisma.sql`i.author_user_id = ${filter.createdByUserId}::uuid`)
    }
    if (filter.assignedToUserId) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM idea_assignees ia WHERE ia.idea_id = i.id AND ia.user_id = ${filter.assignedToUserId}::uuid)`,
      )
    }
    if (filter.tag) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM idea_tags it JOIN tags t ON t.id = it.tag_id WHERE it.idea_id = i.id AND t.normalized_name = ${filter.tag})`,
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
      const term = `%${filter.search}%`
      const searchClauses: Prisma.Sql[] = [
        Prisma.sql`i.title ILIKE ${term}`,
        Prisma.sql`(au.first_name ILIKE ${term} OR au.last_name ILIKE ${term} OR (au.first_name || ' ' || au.last_name) ILIKE ${term})`,
        Prisma.sql`EXISTS (SELECT 1 FROM idea_assignees ia3 JOIN users u3 ON u3.id = ia3.user_id WHERE ia3.idea_id = i.id AND (u3.first_name ILIKE ${term} OR u3.last_name ILIKE ${term} OR (u3.first_name || ' ' || u3.last_name) ILIKE ${term}))`,
        Prisma.sql`s.name ILIKE ${term}`,
      ]
      if (filter.searchTextFieldIds.length > 0) {
        searchClauses.push(
          Prisma.sql`EXISTS (SELECT 1 FROM idea_field_values v WHERE v.idea_id = i.id AND v.field_definition_id IN (${Prisma.join(filter.searchTextFieldIds.map((id) => Prisma.sql`${id}::uuid`))}) AND v.value ILIKE ${term})`,
        )
      }
      if (filter.searchCreatedOnDate) {
        searchClauses.push(
          Prisma.sql`i.created_at_utc >= ${filter.searchCreatedOnDate}::date AND i.created_at_utc < (${filter.searchCreatedOnDate}::date + 1)`,
        )
      }
      conditions.push(Prisma.sql`(${Prisma.join(searchClauses, ' OR ')})`)
    }

    const whereClause = Prisma.join(conditions, ' AND ')

    const sortColumn: Record<typeof sortBy, Prisma.Sql> = {
      createdAt: Prisma.sql`i.created_at_utc`,
      title: Prisma.sql`i.title`,
      createdBy: Prisma.sql`(au.first_name || ' ' || au.last_name)`,
      assignedTo: Prisma.sql`assigned_to_name`,
      status: Prisma.sql`s.name`,
    }
    const directionSql = direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`

    // TOTAL ORDER: the requested sort, then the mandated tie-break (createdAtUtc, title) - NEVER
    // id - matching `listByBoard` and the finding this repository's file header documents.
    const orderByClause = Prisma.sql`ORDER BY ${sortColumn[sortBy]} ${directionSql}, i.created_at_utc ASC, i.title ASC`

    const fromClause = Prisma.sql`
      FROM ideas i
      LEFT JOIN users au ON au.id = i.author_user_id
      LEFT JOIN statuses s ON s.id = i.status_id
      LEFT JOIN LATERAL (
        SELECT (u.first_name || ' ' || u.last_name) AS name
        FROM idea_assignees ia
        JOIN users u ON u.id = ia.user_id
        WHERE ia.idea_id = i.id
        ORDER BY u.first_name ASC, u.last_name ASC
        LIMIT 1
      ) assignee ON true
    `

    const idRows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT i.id, assignee.name AS assigned_to_name
      ${fromClause}
      WHERE ${whereClause}
      ${orderByClause}
      LIMIT ${filter.page.pageSize} OFFSET ${(filter.page.page - 1) * filter.page.pageSize}
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
      page: filter.page.page,
      pageSize: filter.page.pageSize,
      totalCount,
      sortBy: filter.sortBy,
      sortDirection: direction,
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
