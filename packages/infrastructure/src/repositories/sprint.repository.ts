// Satisfies `SprintRepository` (sprints/ports.ts) and, structurally, `ideas.SprintLookupPort` -
// the narrow read-only slice the promotion gate and the delivery card need. One adapter per
// entity, as `user.repository.ts` does for its five ports.
//
// `start_date`/`end_date` are `date` columns and the domain carries them as `YYYY-MM-DD` strings,
// matching `Idea.dueDate`: a `date` has no time and no zone, and round-tripping it through a
// `Date` is how a sprint that starts on the 1st starts showing up as the 31st for anyone west of
// UTC. The conversion is pinned to midnight UTC in both directions, as `idea.repository.ts` does.

import type { SprintLookupPort, SprintSummary } from '@collega/application/ideas'
import type { SprintRepository } from '@collega/application/sprints'
import type { SprintState } from '@collega/domain/enums'
import type { Sprint } from '@collega/domain/sprints'
import type { sprints as SprintRow } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function fromDateString(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function fromRow(row: SprintRow): Sprint {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    goal: row.goal,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    ownerUserId: row.owner_user_id,
    state: row.state as SprintState,
    isDeleted: row.is_deleted,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

export class PrismaSprintRepository implements SprintRepository, SprintLookupPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(sprintId: string): Promise<Sprint | null> {
    const row = await this.prisma.sprints.findUnique({ where: { id: sprintId } })
    return row ? fromRow(row) : null
  }

  async listByIds(sprintIds: readonly string[]): Promise<readonly SprintSummary[]> {
    if (sprintIds.length === 0) {
      return []
    }
    const rows = await this.prisma.sprints.findMany({ where: { id: { in: [...sprintIds] } } })
    return rows.map(fromRow)
  }

  /**
   * Active sprints for an organization, newest window first.
   *
   * TOTAL ORDER, per the golden-capture finding the idea repository's header documents: the
   * tie-break is `startDate` then `name`, never id - two sprints can legitimately share a window,
   * and an id tie-break is stable inside one deployment but not across a fresh seed.
   */
  async listByOrganization(
    organizationId: string,
    state: SprintState | null,
  ): Promise<readonly Sprint[]> {
    const rows = await this.prisma.sprints.findMany({
      where: {
        organization_id: organizationId,
        is_deleted: false,
        ...(state ? { state } : {}),
      },
      orderBy: [{ start_date: 'desc' }, { name: 'asc' }],
    })
    return rows.map(fromRow)
  }

  async add(sprint: Sprint): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.sprints.create({ data: writeData(sprint) }))
  }

  async save(sprint: Sprint): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.sprints.update({ where: { id: sprint.id }, data: writeData(sprint) }),
    )
  }
}

function writeData(sprint: Sprint) {
  return {
    id: sprint.id,
    organization_id: sprint.organizationId,
    name: sprint.name,
    goal: sprint.goal,
    start_date: fromDateString(sprint.startDate),
    end_date: fromDateString(sprint.endDate),
    owner_user_id: sprint.ownerUserId,
    state: sprint.state,
    is_deleted: sprint.isDeleted,
    created_at_utc: sprint.createdAtUtc,
    updated_at_utc: sprint.updatedAtUtc,
    created_by_user_id: sprint.createdByUserId,
    updated_by_user_id: sprint.updatedByUserId,
  }
}
