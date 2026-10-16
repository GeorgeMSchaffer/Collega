// Satisfies `OutcomeRepository` and `OutcomeReadsPort` (outcomes/ports.ts). The rollups are derived
// in the query on every read and never stored; an item is done when it sits in a final lane
// (`board_swimlanes.is_final`) of its OWN board.
//
// `target_*_date` and the sprint dates are `date` columns carried as `YYYY-MM-DD` strings, pinned
// to midnight UTC in both directions, as `sprint.repository.ts` does.

import type {
  OutcomeIdea,
  OutcomeReadsPort,
  OutcomeRepository,
  OutcomeRollup,
} from '@collega/application/outcomes'
import type { Outcome } from '@collega/domain/outcomes'
import type { outcomes as OutcomeRow } from '../generated/prisma/index.js'
import { Prisma } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function fromDateString(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function fromRow(row: OutcomeRow): Outcome {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    targetStartDate: toDateString(row.target_start_date),
    targetEndDate: toDateString(row.target_end_date),
    ownerUserId: row.owner_user_id,
    sortOrder: row.sort_order,
    color: row.color,
    isDeleted: row.is_deleted,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

function writeData(outcome: Outcome) {
  return {
    id: outcome.id,
    organization_id: outcome.organizationId,
    name: outcome.name,
    description: outcome.description,
    target_start_date: fromDateString(outcome.targetStartDate),
    target_end_date: fromDateString(outcome.targetEndDate),
    owner_user_id: outcome.ownerUserId,
    sort_order: outcome.sortOrder,
    color: outcome.color,
    is_deleted: outcome.isDeleted,
    created_at_utc: outcome.createdAtUtc,
    updated_at_utc: outcome.updatedAtUtc,
    created_by_user_id: outcome.createdByUserId,
    updated_by_user_id: outcome.updatedByUserId,
  }
}

function uuidList(ids: readonly string[]): Prisma.Sql {
  return Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))
}

type IdeaQueryRow = {
  outcome_id: string | null
  idea_id: string
  title: string
  status_id: string
  effort: string | null
  assignee_user_ids: string[]
  sprint_id: string | null
  sprint_start: string | null
  sprint_end: string | null
}

function toIdea(row: IdeaQueryRow): OutcomeIdea {
  return {
    ideaId: row.idea_id,
    title: row.title,
    statusId: row.status_id,
    effort: row.effort,
    assigneeUserIds: row.assignee_user_ids,
    sprintId: row.sprint_id,
    sprintStart: row.sprint_start,
    sprintEnd: row.sprint_end,
  }
}

export class PrismaOutcomeRepository implements OutcomeRepository, OutcomeReadsPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(outcomeId: string): Promise<Outcome | null> {
    const row = await this.prisma.outcomes.findUnique({ where: { id: outcomeId } })
    return row ? fromRow(row) : null
  }

  /** TOTAL ORDER: `sort_order`, then creation time, then name - never id. */
  async listByOrganization(organizationId: string): Promise<readonly Outcome[]> {
    const rows = await this.prisma.outcomes.findMany({
      where: { organization_id: organizationId, is_deleted: false },
      orderBy: [{ sort_order: 'asc' }, { created_at_utc: 'asc' }, { name: 'asc' }],
    })
    return rows.map(fromRow)
  }

  async add(outcome: Outcome): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.outcomes.create({ data: writeData(outcome) }))
  }

  async save(outcome: Outcome): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.outcomes.update({ where: { id: outcome.id }, data: writeData(outcome) }),
    )
  }

  async ungroupIdeas(outcomeId: string): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.ideas.updateMany({
        where: { outcome_id: outcomeId },
        data: { outcome_id: null },
      }),
    )
  }

  async rollupsByOutcomeIds(
    outcomeIds: readonly string[],
  ): Promise<ReadonlyMap<string, OutcomeRollup>> {
    if (outcomeIds.length === 0) {
      return new Map()
    }
    const ideaRows = await this.prisma.$queryRaw<
      { outcome_id: string; idea_count: number; done_idea_count: number }[]
    >(Prisma.sql`
      SELECT i.outcome_id AS outcome_id,
             COUNT(*)::int AS idea_count,
             COUNT(*) FILTER (WHERE l.is_final)::int AS done_idea_count
      FROM ideas i
      LEFT JOIN board_swimlanes l ON l.board_id = i.board_id AND l.status_id = i.status_id
      WHERE i.outcome_id IN (${uuidList(outcomeIds)})
        AND i.is_deleted = FALSE
      GROUP BY i.outcome_id
    `)
    const taskRows = await this.prisma.$queryRaw<
      {
        outcome_id: string
        task_count: number
        done_task_count: number
        sprint_start: string | null
        sprint_end: string | null
      }[]
    >(Prisma.sql`
      SELECT p.outcome_id AS outcome_id,
             COUNT(*)::int AS task_count,
             COUNT(*) FILTER (WHERE l.is_final)::int AS done_task_count,
             TO_CHAR(MIN(s.start_date), 'YYYY-MM-DD') AS sprint_start,
             TO_CHAR(MAX(s.end_date), 'YYYY-MM-DD') AS sprint_end
      FROM ideas c
      JOIN ideas p ON p.id = c.parent_idea_id
      LEFT JOIN board_swimlanes l ON l.board_id = c.board_id AND l.status_id = c.status_id
      LEFT JOIN sprints s ON s.id = c.sprint_id AND s.is_deleted = FALSE
      WHERE p.outcome_id IN (${uuidList(outcomeIds)})
        AND p.is_deleted = FALSE
        AND c.is_deleted = FALSE
      GROUP BY p.outcome_id
    `)

    const rollups = new Map<string, OutcomeRollup>()
    for (const id of outcomeIds) {
      rollups.set(id, {
        ideaCount: 0,
        doneIdeaCount: 0,
        taskCount: 0,
        doneTaskCount: 0,
        sprintStart: null,
        sprintEnd: null,
      })
    }
    for (const row of ideaRows) {
      const current = rollups.get(row.outcome_id)
      if (current) {
        rollups.set(row.outcome_id, {
          ...current,
          ideaCount: row.idea_count,
          doneIdeaCount: row.done_idea_count,
        })
      }
    }
    for (const row of taskRows) {
      const current = rollups.get(row.outcome_id)
      if (current) {
        rollups.set(row.outcome_id, {
          ...current,
          taskCount: row.task_count,
          doneTaskCount: row.done_task_count,
          sprintStart: row.sprint_start,
          sprintEnd: row.sprint_end,
        })
      }
    }
    return rollups
  }

  async ideasByOutcomeIds(
    outcomeIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly OutcomeIdea[]>> {
    const grouped = new Map<string, OutcomeIdea[]>()
    if (outcomeIds.length === 0) {
      return grouped
    }
    const rows = await this.prisma.$queryRaw<IdeaQueryRow[]>(Prisma.sql`
      SELECT i.outcome_id AS outcome_id,
             i.id AS idea_id,
             i.title AS title,
             i.status_id AS status_id,
             i.effort AS effort,
             ARRAY(
               SELECT a.user_id::text FROM idea_assignees a WHERE a.idea_id = i.id ORDER BY a.user_id
             ) AS assignee_user_ids,
             i.sprint_id AS sprint_id,
             TO_CHAR(s.start_date, 'YYYY-MM-DD') AS sprint_start,
             TO_CHAR(s.end_date, 'YYYY-MM-DD') AS sprint_end
      FROM ideas i
      LEFT JOIN sprints s ON s.id = i.sprint_id AND s.is_deleted = FALSE
      WHERE i.outcome_id IN (${uuidList(outcomeIds)})
        AND i.is_deleted = FALSE
      ORDER BY i.created_at_utc ASC, i.title ASC
    `)
    for (const row of rows) {
      if (row.outcome_id === null) {
        continue
      }
      const list = grouped.get(row.outcome_id) ?? []
      list.push(toIdea(row))
      grouped.set(row.outcome_id, list)
    }
    return grouped
  }

  async listUngroupedIdeas(organizationId: string): Promise<readonly OutcomeIdea[]> {
    const rows = await this.prisma.$queryRaw<IdeaQueryRow[]>(Prisma.sql`
      SELECT i.outcome_id AS outcome_id,
             i.id AS idea_id,
             i.title AS title,
             i.status_id AS status_id,
             i.effort AS effort,
             ARRAY(
               SELECT a.user_id::text FROM idea_assignees a WHERE a.idea_id = i.id ORDER BY a.user_id
             ) AS assignee_user_ids,
             i.sprint_id AS sprint_id,
             TO_CHAR(s.start_date, 'YYYY-MM-DD') AS sprint_start,
             TO_CHAR(s.end_date, 'YYYY-MM-DD') AS sprint_end
      FROM ideas i
      LEFT JOIN sprints s ON s.id = i.sprint_id AND s.is_deleted = FALSE
      WHERE i.organization_id = ${organizationId}::uuid
        AND i.outcome_id IS NULL
        AND i.parent_idea_id IS NULL
        AND i.is_deleted = FALSE
      ORDER BY i.created_at_utc ASC, i.title ASC
    `)
    return rows.map(toIdea)
  }
}
