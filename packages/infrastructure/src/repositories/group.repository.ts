// Satisfies `GroupRepository` (groups/ports.ts). A membership row is only the (group, user) pair, so
// `save` replaces the member set by deleting the pairs that left and inserting the ones that joined.

import type { GroupRepository } from '@collega/application/groups'
import type { Group } from '@collega/domain/groups'
import type {
  user_group_members as GroupMemberRow,
  user_groups as GroupRow,
} from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

type GroupRowWithMembers = GroupRow & { user_group_members: GroupMemberRow[] }

function fromRow(row: GroupRowWithMembers): Group {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    normalizedName: row.normalized_name,
    description: row.description,
    memberUserIds: row.user_group_members.map((member) => member.user_id),
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

export class PrismaGroupRepository implements GroupRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(groupId: string): Promise<Group | null> {
    const row = await this.prisma.user_groups.findUnique({
      where: { id: groupId },
      include: { user_group_members: true },
    })
    return row ? fromRow(row) : null
  }

  async listByOrganization(organizationId: string): Promise<readonly Group[]> {
    const rows = await this.prisma.user_groups.findMany({
      where: { organization_id: organizationId },
      include: { user_group_members: true },
    })
    return rows.map(fromRow)
  }

  async existsByName(
    organizationId: string,
    name: string,
    excludeId: string | null,
  ): Promise<boolean> {
    const found = await this.prisma.user_groups.findFirst({
      where: {
        organization_id: organizationId,
        normalized_name: name.trim().toLowerCase(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })
    return found !== null
  }

  async add(group: Group): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.user_groups.create({ data: this.scalarWriteData(group) }))
    if (group.memberUserIds.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.user_group_members.createMany({
          data: group.memberUserIds.map((userId) => ({ group_id: group.id, user_id: userId })),
        }),
      )
    }
  }

  async save(group: Group): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.user_groups.update({
        where: { id: group.id },
        data: this.scalarWriteData(group),
      }),
    )

    const existing = await this.prisma.user_group_members.findMany({
      where: { group_id: group.id },
      select: { user_id: true },
    })
    const before = new Set(existing.map((member) => member.user_id))
    const after = new Set(group.memberUserIds)

    const removed = [...before].filter((userId) => !after.has(userId))
    if (removed.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.user_group_members.deleteMany({
          where: { group_id: group.id, user_id: { in: removed } },
        }),
      )
    }
    const added = group.memberUserIds.filter((userId) => !before.has(userId))
    if (added.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.user_group_members.createMany({
          data: added.map((userId) => ({ group_id: group.id, user_id: userId })),
        }),
      )
    }
  }

  async delete(groupId: string): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.user_groups.delete({ where: { id: groupId } }))
  }

  private scalarWriteData(group: Group) {
    return {
      id: group.id,
      organization_id: group.organizationId,
      name: group.name,
      normalized_name: group.normalizedName,
      description: group.description,
      created_at_utc: group.createdAtUtc,
      updated_at_utc: group.updatedAtUtc,
      created_by_user_id: group.createdByUserId,
      updated_by_user_id: group.updatedByUserId,
    }
  }
}
