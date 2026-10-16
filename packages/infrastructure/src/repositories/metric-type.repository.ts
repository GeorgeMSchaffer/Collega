// Satisfies `MetricTypeRepository` and `IdeaMetricValuesPort` (metric-types/ports.ts). Values are
// `numeric(17,2)`: written from the validated number's own text, so no float arithmetic is
// involved, and read back as JSON numbers.

import type {
  IdeaMetric,
  IdeaMetricValuesPort,
  IdeaMetricWrite,
  MetricTypeRepository,
} from '@collega/application/metric-types'
import type { MetricType } from '@collega/domain/metric-types'
import type { metric_types as MetricTypeRow } from '../generated/prisma/index.js'
import { Prisma } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function fromRow(row: MetricTypeRow): MetricType {
  return {
    id: row.metric_type_id,
    organizationId: row.organization_id,
    name: row.name,
    unit: row.unit,
    isArchived: row.is_archived,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    // The table carries no actor columns.
    createdByUserId: null,
    updatedByUserId: null,
  }
}

function writeData(metricType: MetricType) {
  return {
    metric_type_id: metricType.id,
    organization_id: metricType.organizationId,
    name: metricType.name,
    unit: metricType.unit,
    is_archived: metricType.isArchived,
    created_at_utc: metricType.createdAtUtc,
    updated_at_utc: metricType.updatedAtUtc,
  }
}

function toDecimal(value: number | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(String(value))
}

export class PrismaMetricTypeRepository implements MetricTypeRepository, IdeaMetricValuesPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(metricTypeId: string): Promise<MetricType | null> {
    const row = await this.prisma.metric_types.findUnique({
      where: { metric_type_id: metricTypeId },
    })
    return row ? fromRow(row) : null
  }

  async listByOrganization(
    organizationId: string,
    includeArchived: boolean,
  ): Promise<readonly MetricType[]> {
    const rows = await this.prisma.metric_types.findMany({
      where: {
        organization_id: organizationId,
        ...(includeArchived ? {} : { is_archived: false }),
      },
      orderBy: [{ created_at_utc: 'asc' }, { metric_type_id: 'asc' }],
    })
    return rows.map(fromRow)
  }

  async add(metricType: MetricType): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.metric_types.create({ data: writeData(metricType) }))
  }

  async save(metricType: MetricType): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.metric_types.update({
        where: { metric_type_id: metricType.id },
        data: writeData(metricType),
      }),
    )
  }

  async listByIdea(ideaId: string): Promise<readonly IdeaMetric[]> {
    const rows = await this.prisma.idea_metric_values.findMany({
      where: { idea_id: ideaId },
      include: { metric_types: true },
      orderBy: [{ metric_types: { created_at_utc: 'asc' } }, { metric_type_id: 'asc' }],
    })
    return rows.map((row) => ({
      metricTypeId: row.metric_type_id,
      name: row.metric_types.name,
      unit: row.metric_types.unit,
      isArchived: row.metric_types.is_archived,
      projected: row.projected?.toNumber() ?? null,
      realized: row.realized?.toNumber() ?? null,
    }))
  }

  async apply(
    ideaId: string,
    upserts: readonly IdeaMetricWrite[],
    clearedTypeIds: readonly string[],
  ): Promise<void> {
    if (clearedTypeIds.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.idea_metric_values.deleteMany({
          where: { idea_id: ideaId, metric_type_id: { in: [...clearedTypeIds] } },
        }),
      )
    }
    for (const write of upserts) {
      const data = { projected: toDecimal(write.projected), realized: toDecimal(write.realized) }
      this.unitOfWork.enqueue(
        this.prisma.idea_metric_values.upsert({
          where: {
            idea_id_metric_type_id: { idea_id: ideaId, metric_type_id: write.metricTypeId },
          },
          create: { idea_id: ideaId, metric_type_id: write.metricTypeId, ...data },
          update: data,
        }),
      )
    }
  }
}
