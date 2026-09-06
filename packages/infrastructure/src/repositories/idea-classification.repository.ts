// Satisfies `IdeaClassificationPort` (ideas/ports.ts). Declared as its own small adapter rather
// than reused from `PrismaIdeaTypeRepository`/`PrismaBusinessImpactRepository`: this port names
// its methods differently (`getIdeaTypeById` vs. `getById`, `listIdeaTypesByOrganization` vs.
// `listByOrganization`), so structural typing can't satisfy it from those classes without adding
// aliases that would only exist for this one caller.

import type { IdeaClassificationPort } from '@collega/application/ideas'
import type { PrismaClient } from '../persistence/prisma-client.js'

type IdeaTypeSummary = {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly colorHex: string | null
  readonly icon: string | null
  readonly isDeleted: boolean
}

type BusinessImpactSummary = {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly color: string
  readonly isDeleted: boolean
}

export class IdeaClassificationRepository implements IdeaClassificationPort {
  constructor(private readonly prisma: PrismaClient) {}

  async getIdeaTypeById(ideaTypeId: string): Promise<IdeaTypeSummary | null> {
    const row = await this.prisma.idea_types.findUnique({ where: { id: ideaTypeId } })
    return row
      ? {
          id: row.id,
          organizationId: row.organization_id,
          name: row.name,
          colorHex: row.color_hex,
          icon: row.icon,
          isDeleted: row.is_deleted,
        }
      : null
  }

  async listIdeaTypesByOrganization(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly IdeaTypeSummary[]> {
    const rows = await this.prisma.idea_types.findMany({
      where: { organization_id: organizationId, ...(includeDeleted ? {} : { is_deleted: false }) },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    })
    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      colorHex: row.color_hex,
      icon: row.icon,
      isDeleted: row.is_deleted,
    }))
  }

  async getBusinessImpactById(businessImpactId: string): Promise<BusinessImpactSummary | null> {
    const row = await this.prisma.business_impacts.findUnique({ where: { id: businessImpactId } })
    return row
      ? {
          id: row.id,
          organizationId: row.organization_id,
          name: row.name,
          color: row.color,
          isDeleted: row.is_deleted,
        }
      : null
  }

  async listBusinessImpactsByOrganization(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly BusinessImpactSummary[]> {
    const rows = await this.prisma.business_impacts.findMany({
      where: { organization_id: organizationId, ...(includeDeleted ? {} : { is_deleted: false }) },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    })
    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      color: row.color,
      isDeleted: row.is_deleted,
    }))
  }
}
