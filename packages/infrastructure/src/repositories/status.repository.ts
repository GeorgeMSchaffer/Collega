// Satisfies `StatusRepository` (statuses/ports.ts). `listActiveNames` is extra - not part of that
// interface - added so this same adapter also satisfies `AiStatusesPort` (ai/ports.ts).

import type { AiStatusesPort } from '@collega/application/ai'
import type { StatusRepository } from '@collega/application/statuses'
import type { Status } from '@collega/domain/statuses'
import type { statuses as StatusRow } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function fromRow(row: StatusRow): Status {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    isDeleted: row.is_deleted,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

export class PrismaStatusRepository implements StatusRepository, AiStatusesPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(statusId: string): Promise<Status | null> {
    const row = await this.prisma.statuses.findUnique({ where: { id: statusId } })
    return row ? fromRow(row) : null
  }

  async listActiveByOrganization(organizationId: string): Promise<readonly Status[]> {
    return this.listByOrganization(organizationId, false)
  }

  async listByOrganization(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly Status[]> {
    const rows = await this.prisma.statuses.findMany({
      where: {
        organization_id: organizationId,
        ...(includeDeleted ? {} : { is_deleted: false }),
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    })
    return rows.map(fromRow)
  }

  /** `AiStatusesPort.listActiveNames` - names only, context for the assistant, never proposed. */
  async listActiveNames(organizationId: string): Promise<readonly string[]> {
    const rows = await this.listActiveByOrganization(organizationId)
    return rows.map((s) => s.name)
  }

  async countActiveByOrganization(organizationId: string): Promise<number> {
    return this.prisma.statuses.count({
      where: { organization_id: organizationId, is_deleted: false },
    })
  }

  async add(status: Status): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.statuses.create({ data: this.toWriteData(status) }))
  }

  async addMany(statuses: readonly Status[]): Promise<void> {
    if (statuses.length === 0) {
      return
    }
    this.unitOfWork.enqueue(
      this.prisma.statuses.createMany({ data: statuses.map((s) => this.toWriteData(s)) }),
    )
  }

  async save(status: Status): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.statuses.update({ where: { id: status.id }, data: this.toWriteData(status) }),
    )
  }

  private toWriteData(status: Status) {
    return {
      id: status.id,
      organization_id: status.organizationId,
      name: status.name,
      color: status.color,
      sort_order: status.sortOrder,
      is_deleted: status.isDeleted,
      created_at_utc: status.createdAtUtc,
      updated_at_utc: status.updatedAtUtc,
      created_by_user_id: status.createdByUserId,
      updated_by_user_id: status.updatedByUserId,
    }
  }
}
