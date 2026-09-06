// Satisfies `FieldDefinitionRepository` (fields/ports.ts).
//
// `field_definition_options` rows DO carry their own id (unlike `board_swimlanes`), and
// `FieldDefinition.options` identity matters - an idea's stored Dropdown/MultiSelect value
// references an option id, so a reorder/rename must preserve ids rather than delete-and-recreate
// blindly (`FieldOptionInput.id` reuse, per the domain's own doc comment). `save` therefore diffs:
// options whose id already exists are updated in place, ids not currently present are inserted,
// and existing ids absent from the new set are deleted.

import { randomUUID } from 'node:crypto'
import type { FieldDefinitionRepository } from '@collega/application/fields'
import type { FieldType } from '@collega/domain/enums'
import type { FieldDefinition, FieldDefinitionOption } from '@collega/domain/fields'
import type {
  field_definitions as FieldDefinitionRow,
  field_definition_options as OptionRow,
} from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

type FieldDefinitionRowWithOptions = FieldDefinitionRow & { field_definition_options: OptionRow[] }

function optionFromRow(row: OptionRow): FieldDefinitionOption {
  return {
    id: row.id,
    fieldDefinitionId: row.field_definition_id,
    label: row.label,
    displayOrder: row.display_order,
  }
}

function fromRow(row: FieldDefinitionRowWithOptions): FieldDefinition {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    normalizedName: row.normalized_name,
    description: row.description,
    fieldType: row.field_type as FieldType,
    isRequired: row.is_required,
    displayOrder: row.display_order,
    isDeleted: row.is_deleted,
    deletedAtUtc: row.deleted_at_utc,
    deletedByUserId: row.deleted_by_user_id,
    options: [...row.field_definition_options]
      .sort((a, b) => a.display_order - b.display_order)
      .map(optionFromRow),
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

export class PrismaFieldDefinitionRepository implements FieldDefinitionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(id: string): Promise<FieldDefinition | null> {
    const row = await this.prisma.field_definitions.findUnique({
      where: { id },
      include: { field_definition_options: true },
    })
    return row ? fromRow(row) : null
  }

  async listByOrganization(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly FieldDefinition[]> {
    const rows = await this.prisma.field_definitions.findMany({
      where: {
        organization_id: organizationId,
        ...(includeDeleted ? {} : { is_deleted: false }),
      },
      include: { field_definition_options: true },
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
    })
    return rows.map(fromRow)
  }

  async listActiveByOrganization(organizationId: string): Promise<readonly FieldDefinition[]> {
    return this.listByOrganization(organizationId, false)
  }

  /** MUST query only `is_deleted = false`, matching the partial unique index's own predicate -
   * a soft-deleted definition's name is available for reuse. */
  async existsActiveByName(
    organizationId: string,
    name: string,
    excludeId: string | null,
  ): Promise<boolean> {
    const normalizedName = name.trim().toLowerCase()
    const found = await this.prisma.field_definitions.findFirst({
      where: {
        organization_id: organizationId,
        normalized_name: normalizedName,
        is_deleted: false,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })
    return found !== null
  }

  async add(definition: FieldDefinition): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.field_definitions.create({ data: this.scalarWriteData(definition) }),
    )
    if (definition.options.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.field_definition_options.createMany({
          data: definition.options.map((o) => this.optionWriteData(definition.id, o)),
        }),
      )
    }
  }

  async save(definition: FieldDefinition): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.field_definitions.update({
        where: { id: definition.id },
        data: this.scalarWriteData(definition),
      }),
    )

    const existing = await this.prisma.field_definition_options.findMany({
      where: { field_definition_id: definition.id },
      select: { id: true },
    })
    const existingIds = new Set(existing.map((o) => o.id))
    const nextIds = new Set(definition.options.map((o) => o.id))

    for (const option of definition.options) {
      const data = this.optionWriteData(definition.id, option)
      if (existingIds.has(option.id)) {
        this.unitOfWork.enqueue(
          this.prisma.field_definition_options.update({ where: { id: option.id }, data }),
        )
      } else {
        this.unitOfWork.enqueue(this.prisma.field_definition_options.create({ data }))
      }
    }

    for (const existingId of existingIds) {
      if (!nextIds.has(existingId)) {
        this.unitOfWork.enqueue(
          this.prisma.field_definition_options.delete({ where: { id: existingId } }),
        )
      }
    }
  }

  private scalarWriteData(definition: FieldDefinition) {
    return {
      id: definition.id,
      organization_id: definition.organizationId,
      name: definition.name,
      normalized_name: definition.normalizedName,
      description: definition.description,
      field_type: definition.fieldType,
      is_required: definition.isRequired,
      display_order: definition.displayOrder,
      is_deleted: definition.isDeleted,
      deleted_at_utc: definition.deletedAtUtc,
      deleted_by_user_id: definition.deletedByUserId,
      created_at_utc: definition.createdAtUtc,
      updated_at_utc: definition.updatedAtUtc,
      created_by_user_id: definition.createdByUserId,
      updated_by_user_id: definition.updatedByUserId,
    }
  }

  private optionWriteData(fieldDefinitionId: string, option: FieldDefinitionOption) {
    return {
      id: option.id || randomUUID(),
      field_definition_id: fieldDefinitionId,
      label: option.label,
      display_order: option.displayOrder,
    }
  }
}
