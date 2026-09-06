// Satisfies `BusinessImpactRepository` (business-impacts/ports.ts). The `listActive` method is
// extra - not part of that interface - added so this same adapter also satisfies
// `AiBusinessImpactsPort` (ai/ports.ts: `listActive(organizationId)` -> {id, name}, a narrower
// projection of `BusinessImpact`).

import type { AiBusinessImpactsPort } from '@collega/application/ai'
import type { BusinessImpactRepository } from '@collega/application/business-impacts'
import type { BusinessImpact } from '@collega/domain/business-impacts'
import type { business_impacts as BusinessImpactRow } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function fromRow(row: BusinessImpactRow): BusinessImpact {
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

export class PrismaBusinessImpactRepository
  implements BusinessImpactRepository, AiBusinessImpactsPort
{
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(businessImpactId: string): Promise<BusinessImpact | null> {
    const row = await this.prisma.business_impacts.findUnique({ where: { id: businessImpactId } })
    return row ? fromRow(row) : null
  }

  async listByOrganization(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly BusinessImpact[]> {
    const rows = await this.prisma.business_impacts.findMany({
      where: {
        organization_id: organizationId,
        ...(includeDeleted ? {} : { is_deleted: false }),
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    })
    return rows.map(fromRow)
  }

  /** `AiBusinessImpactsPort.listActive` - active options only, in catalog order. */
  async listActive(organizationId: string): Promise<readonly BusinessImpact[]> {
    return this.listByOrganization(organizationId, false)
  }

  async countActiveByOrganization(organizationId: string): Promise<number> {
    return this.prisma.business_impacts.count({
      where: { organization_id: organizationId, is_deleted: false },
    })
  }

  async add(impact: BusinessImpact): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.business_impacts.create({ data: this.toWriteData(impact) }))
  }

  async addMany(impacts: readonly BusinessImpact[]): Promise<void> {
    if (impacts.length === 0) {
      return
    }
    this.unitOfWork.enqueue(
      this.prisma.business_impacts.createMany({ data: impacts.map((i) => this.toWriteData(i)) }),
    )
  }

  async save(impact: BusinessImpact): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.business_impacts.update({
        where: { id: impact.id },
        data: this.toWriteData(impact),
      }),
    )
  }

  private toWriteData(impact: BusinessImpact) {
    return {
      id: impact.id,
      organization_id: impact.organizationId,
      name: impact.name,
      color: impact.color,
      sort_order: impact.sortOrder,
      is_deleted: impact.isDeleted,
      created_at_utc: impact.createdAtUtc,
      updated_at_utc: impact.updatedAtUtc,
      created_by_user_id: impact.createdByUserId,
      updated_by_user_id: impact.updatedByUserId,
    }
  }
}
