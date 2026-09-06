// Satisfies `IdeaTypeRepository` (idea-fields/ports.ts). `idea_type_fields` rows carry their own
// id and `IdeaTypeFieldInput.id` is meaningful (an existing id is reused, any other id is a new
// link - `setIdeaTypeFieldSelection`'s doc comment), so `save` diffs the link set the same way
// `field-definition.repository.ts` diffs options, rather than delete-and-recreate.

import type { IdeaTypeRepository } from '@collega/application/idea-fields'
import type { IdeaTypeFieldMode } from '@collega/domain/enums'
import type { IdeaType, IdeaTypeField } from '@collega/domain/idea-fields'
import type {
  idea_type_fields as IdeaTypeFieldRow,
  idea_types as IdeaTypeRow,
} from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

type IdeaTypeRowWithFields = IdeaTypeRow & { idea_type_fields: IdeaTypeFieldRow[] }

function fieldFromRow(row: IdeaTypeFieldRow): IdeaTypeField {
  return {
    id: row.id,
    ideaTypeId: row.idea_type_id,
    fieldDefinitionId: row.field_definition_id,
    displayOrder: row.display_order,
    isRequired: row.is_required,
  }
}

function fromRow(row: IdeaTypeRowWithFields): IdeaType {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    sortOrder: row.sort_order,
    isDeleted: row.is_deleted,
    colorHex: row.color_hex,
    icon: row.icon,
    fieldMode: row.field_mode as IdeaTypeFieldMode,
    fields: [...row.idea_type_fields]
      .sort((a, b) => a.display_order - b.display_order)
      .map(fieldFromRow),
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

export class PrismaIdeaTypeRepository implements IdeaTypeRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(ideaTypeId: string): Promise<IdeaType | null> {
    const row = await this.prisma.idea_types.findUnique({
      where: { id: ideaTypeId },
      include: { idea_type_fields: true },
    })
    return row ? fromRow(row) : null
  }

  async listByOrganization(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly IdeaType[]> {
    const rows = await this.prisma.idea_types.findMany({
      where: {
        organization_id: organizationId,
        ...(includeDeleted ? {} : { is_deleted: false }),
      },
      include: { idea_type_fields: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    })
    return rows.map(fromRow)
  }

  async countActiveByOrganization(organizationId: string): Promise<number> {
    return this.prisma.idea_types.count({
      where: { organization_id: organizationId, is_deleted: false },
    })
  }

  async add(ideaType: IdeaType): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.idea_types.create({ data: this.scalarWriteData(ideaType) }))
    if (ideaType.fields.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.idea_type_fields.createMany({
          data: ideaType.fields.map((f) => this.fieldWriteData(ideaType.id, f)),
        }),
      )
    }
  }

  async addMany(ideaTypes: readonly IdeaType[]): Promise<void> {
    if (ideaTypes.length === 0) {
      return
    }
    this.unitOfWork.enqueue(
      this.prisma.idea_types.createMany({ data: ideaTypes.map((t) => this.scalarWriteData(t)) }),
    )
  }

  async save(ideaType: IdeaType): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.idea_types.update({
        where: { id: ideaType.id },
        data: this.scalarWriteData(ideaType),
      }),
    )

    const existing = await this.prisma.idea_type_fields.findMany({
      where: { idea_type_id: ideaType.id },
      select: { id: true },
    })
    const existingIds = new Set(existing.map((f) => f.id))
    const nextIds = new Set(ideaType.fields.map((f) => f.id))

    for (const field of ideaType.fields) {
      const data = this.fieldWriteData(ideaType.id, field)
      if (existingIds.has(field.id)) {
        this.unitOfWork.enqueue(
          this.prisma.idea_type_fields.update({ where: { id: field.id }, data }),
        )
      } else {
        this.unitOfWork.enqueue(this.prisma.idea_type_fields.create({ data }))
      }
    }

    for (const existingId of existingIds) {
      if (!nextIds.has(existingId)) {
        this.unitOfWork.enqueue(this.prisma.idea_type_fields.delete({ where: { id: existingId } }))
      }
    }
  }

  private scalarWriteData(ideaType: IdeaType) {
    return {
      id: ideaType.id,
      organization_id: ideaType.organizationId,
      name: ideaType.name,
      sort_order: ideaType.sortOrder,
      is_deleted: ideaType.isDeleted,
      color_hex: ideaType.colorHex,
      icon: ideaType.icon,
      field_mode: ideaType.fieldMode,
      created_at_utc: ideaType.createdAtUtc,
      updated_at_utc: ideaType.updatedAtUtc,
      created_by_user_id: ideaType.createdByUserId,
      updated_by_user_id: ideaType.updatedByUserId,
    }
  }

  private fieldWriteData(ideaTypeId: string, field: IdeaTypeField) {
    return {
      id: field.id,
      idea_type_id: ideaTypeId,
      field_definition_id: field.fieldDefinitionId,
      display_order: field.displayOrder,
      is_required: field.isRequired,
    }
  }
}
