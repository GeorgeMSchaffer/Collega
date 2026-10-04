// Satisfies `FieldsetRepository` (fieldsets/ports.ts). `fieldset_fields` rows carry their own id and
// the service reuses an existing member's id on a reorder, so `save` diffs the member set the way
// `idea-type.repository.ts` diffs its links: absent ids are deleted first (so a removed member can
// never collide with a re-added one on the unique pair), then present ids are updated or inserted.

import type { FieldsetRepository, FieldsetUsage } from '@collega/application/fieldsets'
import type { Fieldset, FieldsetField } from '@collega/domain/fieldsets'
import type {
  fieldset_fields as FieldsetFieldRow,
  fieldsets as FieldsetRow,
} from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

type FieldsetRowWithFields = FieldsetRow & { fieldset_fields: FieldsetFieldRow[] }

function memberFromRow(row: FieldsetFieldRow): FieldsetField {
  return {
    id: row.id,
    fieldsetId: row.fieldset_id,
    fieldDefinitionId: row.field_definition_id,
    displayOrder: row.display_order,
  }
}

function fromRow(row: FieldsetRowWithFields): Fieldset {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    normalizedName: row.normalized_name,
    description: row.description,
    displayOrder: row.display_order,
    fields: [...row.fieldset_fields]
      .sort((a, b) => a.display_order - b.display_order)
      .map(memberFromRow),
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

export class PrismaFieldsetRepository implements FieldsetRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(fieldsetId: string): Promise<Fieldset | null> {
    const row = await this.prisma.fieldsets.findUnique({
      where: { id: fieldsetId },
      include: { fieldset_fields: true },
    })
    return row ? fromRow(row) : null
  }

  async listByOrganization(organizationId: string): Promise<readonly Fieldset[]> {
    const rows = await this.prisma.fieldsets.findMany({
      where: { organization_id: organizationId },
      include: { fieldset_fields: true },
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
    })
    return rows.map(fromRow)
  }

  async getManyByIds(fieldsetIds: readonly string[]): Promise<readonly Fieldset[]> {
    if (fieldsetIds.length === 0) {
      return []
    }
    const rows = await this.prisma.fieldsets.findMany({
      where: { id: { in: [...fieldsetIds] } },
      include: { fieldset_fields: true },
    })
    return rows.map(fromRow)
  }

  async existsByName(
    organizationId: string,
    name: string,
    excludeId: string | null,
  ): Promise<boolean> {
    const found = await this.prisma.fieldsets.findFirst({
      where: {
        organization_id: organizationId,
        normalized_name: name.trim().toLowerCase(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })
    return found !== null
  }

  async getUsage(fieldsetIds: readonly string[]): Promise<ReadonlyMap<string, FieldsetUsage>> {
    const usage = new Map<string, { active: number; total: number }>(
      fieldsetIds.map((id) => [id, { active: 0, total: 0 }] as const),
    )
    if (fieldsetIds.length === 0) {
      return usage
    }
    const rows = await this.prisma.idea_type_fieldsets.findMany({
      where: { fieldset_id: { in: [...fieldsetIds] } },
      select: { fieldset_id: true, idea_types: { select: { is_deleted: true } } },
    })
    for (const row of rows) {
      const entry = usage.get(row.fieldset_id)
      if (entry) {
        entry.total += 1
        if (!row.idea_types.is_deleted) {
          entry.active += 1
        }
      }
    }
    return usage
  }

  async add(fieldset: Fieldset): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.fieldsets.create({ data: this.scalarWriteData(fieldset) }))
    if (fieldset.fields.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.fieldset_fields.createMany({
          data: fieldset.fields.map((f) => this.memberWriteData(fieldset.id, f)),
        }),
      )
    }
  }

  async save(fieldset: Fieldset): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.fieldsets.update({
        where: { id: fieldset.id },
        data: this.scalarWriteData(fieldset),
      }),
    )

    const existing = await this.prisma.fieldset_fields.findMany({
      where: { fieldset_id: fieldset.id },
      select: { id: true },
    })
    const existingIds = new Set(existing.map((f) => f.id))
    const nextIds = new Set(fieldset.fields.map((f) => f.id))

    for (const existingId of existingIds) {
      if (!nextIds.has(existingId)) {
        this.unitOfWork.enqueue(this.prisma.fieldset_fields.delete({ where: { id: existingId } }))
      }
    }

    for (const member of fieldset.fields) {
      const data = this.memberWriteData(fieldset.id, member)
      if (existingIds.has(member.id)) {
        this.unitOfWork.enqueue(
          this.prisma.fieldset_fields.update({ where: { id: member.id }, data }),
        )
      } else {
        this.unitOfWork.enqueue(this.prisma.fieldset_fields.create({ data }))
      }
    }
  }

  async delete(fieldsetId: string): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.fieldsets.delete({ where: { id: fieldsetId } }))
  }

  private scalarWriteData(fieldset: Fieldset) {
    return {
      id: fieldset.id,
      organization_id: fieldset.organizationId,
      name: fieldset.name,
      normalized_name: fieldset.normalizedName,
      description: fieldset.description,
      display_order: fieldset.displayOrder,
      created_at_utc: fieldset.createdAtUtc,
      updated_at_utc: fieldset.updatedAtUtc,
      created_by_user_id: fieldset.createdByUserId,
      updated_by_user_id: fieldset.updatedByUserId,
    }
  }

  private memberWriteData(fieldsetId: string, member: FieldsetField) {
    return {
      id: member.id,
      fieldset_id: fieldsetId,
      field_definition_id: member.fieldDefinitionId,
      display_order: member.displayOrder,
    }
  }
}
