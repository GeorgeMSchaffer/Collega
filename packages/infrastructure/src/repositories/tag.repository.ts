// Satisfies `TagRepository` (tags/ports.ts). Structurally also satisfies `ideas.TagsPort`
// (`listByIds`/`getOrCreate`, a subset) and `AiTagsPort` (`searchByPrefix`, identical shape).
//
// `getOrCreate` stages new tags through the unit of work rather than creating them immediately:
// the caller already knows each new tag's id (`randomUUID()`, generated here before enqueueing -
// ids are not read back from the database), so the result can be returned before `saveChanges()`
// runs. A race with a concurrent `getOrCreate` for the same normalized name is not specifically
// handled here - see the slice report - `ux_tags_organization_id_normalized_name` still protects
// the data, but a losing concurrent request would see a raw constraint error rather than a
// transparent merge, unlike the three named partial indexes this slice was asked to translate.

import { randomUUID } from 'node:crypto'
import type { AiTagsPort } from '@collega/application/ai'
import type { TagsPort as IdeasTagsPort } from '@collega/application/ideas'
import type { GetOrCreateTagsInput, TagRepository } from '@collega/application/tags'
import type { Tag } from '@collega/domain/tags'
import { createTag, normalizeTagName } from '@collega/domain/tags'
import type { tags as TagRow } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function fromRow(row: TagRow): Tag {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    normalizedName: row.normalized_name,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

export class PrismaTagRepository implements TagRepository, IdeasTagsPort, AiTagsPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async listByIds(tagIds: readonly string[]): Promise<readonly Tag[]> {
    if (tagIds.length === 0) {
      return []
    }
    const rows = await this.prisma.tags.findMany({ where: { id: { in: [...tagIds] } } })
    return rows.map(fromRow)
  }

  async getOrCreate(input: GetOrCreateTagsInput): Promise<readonly Tag[]> {
    const normalizedNames = [
      ...new Set(input.requestedNames.map((n) => normalizeTagName(n))),
    ].filter((n) => n.length > 0)
    if (normalizedNames.length === 0) {
      return []
    }

    const existingRows = await this.prisma.tags.findMany({
      where: { organization_id: input.organizationId, normalized_name: { in: normalizedNames } },
    })
    const existingByNormalizedName = new Map(existingRows.map((r) => [r.normalized_name, r]))

    const result: Tag[] = []
    for (const requestedName of input.requestedNames) {
      const normalizedName = normalizeTagName(requestedName)
      if (normalizedName.length === 0) {
        continue
      }
      const existing = existingByNormalizedName.get(normalizedName)
      if (existing) {
        result.push(fromRow(existing))
        continue
      }

      const tag = createTag({
        id: randomUUID(),
        organizationId: input.organizationId,
        name: requestedName,
        nowUtc: input.nowUtc,
        actorUserId: input.actorUserId,
      })
      this.unitOfWork.enqueue(
        this.prisma.tags.create({
          data: {
            id: tag.id,
            organization_id: tag.organizationId,
            name: tag.name,
            normalized_name: tag.normalizedName,
            created_at_utc: tag.createdAtUtc,
            updated_at_utc: tag.updatedAtUtc,
            created_by_user_id: tag.createdByUserId,
            updated_by_user_id: tag.updatedByUserId,
          },
        }),
      )
      existingByNormalizedName.set(normalizedName, {
        id: tag.id,
        organization_id: tag.organizationId,
        name: tag.name,
        normalized_name: tag.normalizedName,
        created_at_utc: tag.createdAtUtc,
        updated_at_utc: tag.updatedAtUtc,
        created_by_user_id: tag.createdByUserId,
        updated_by_user_id: tag.updatedByUserId,
      })
      result.push(tag)
    }

    return result
  }

  async searchByPrefix(
    organizationId: string,
    normalizedPrefix: string,
    limit: number,
  ): Promise<readonly string[]> {
    const rows = await this.prisma.tags.findMany({
      where: {
        organization_id: organizationId,
        normalized_name: { startsWith: normalizedPrefix },
      },
      orderBy: { name: 'asc' },
      take: limit,
      select: { name: true },
    })
    return rows.map((r) => r.name)
  }
}
