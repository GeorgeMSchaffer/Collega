// Satisfies `TagRepository` (tags/ports.ts). Structurally also satisfies `ideas.TagsPort`
// (`listByIds`/`getOrCreate`, a subset) and `AiTagsPort` (`searchByPrefix`, identical shape).
//
// `getOrCreate` OWNS ITS OWN COMMIT AND RETRY - a deliberate exception to this package's usual
// command-buffer discipline (see `persistence/unit-of-work.ts`'s header for the full design and
// why this is the one carve-out). It does NOT take a `PrismaUnitOfWork` and does not enqueue
// anything: every write below is awaited directly, mirroring the .NET `EfTagRepository`, whose own
// doc comment says `GetOrCreateAsync` "deliberately owns its own SaveChanges and a retry (rather
// than deferring to IUnitOfWork) so it can catch the unique-index violation raised when two
// requests create the same normalized tag concurrently and converge both on the single persisted
// row" (SPEC/20-feature-ideas-and-engagement.md "Tags" #7: "If concurrent saves attempt to create
// the same normalized tag, the system merges them into a single tag."). Tags are independent,
// reusable entities - nothing else in the same request depends on a tag row NOT yet existing - so
// committing one ahead of whatever idea/comment referenced it is safe, unlike every other write in
// this package.
//
// Without this, `importBoardIdeas` (packages/application/src/ideas/idea.service.ts) - which calls
// `getOrCreate` once per CSV row inside a loop, with a single `saveChanges()` after the loop -
// would stage a `tags.create` per row with no way for row 2 to see row 1's uncommitted create for
// the same new tag name: both would enqueue a create for the same `(organization_id,
// normalized_name)`, and the batch `$transaction` would reject the whole import on
// `ux_tags_organization_id_normalized_name`, an entirely ordinary import (the same tag used across
// many rows) turning into an unhandled 500 for every row, not just the colliding ones.

import { randomUUID } from 'node:crypto'
import type { AiTagsPort } from '@collega/application/ai'
import type { TagsPort as IdeasTagsPort } from '@collega/application/ideas'
import type { GetOrCreateTagsInput, TagRepository } from '@collega/application/tags'
import type { Tag } from '@collega/domain/tags'
import { createTag, normalizeTagName } from '@collega/domain/tags'
import type { tags as TagRow } from '../generated/prisma/index.js'
import { Prisma } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'

/** Whether `error` is a P2002 on exactly `ux_tags_organization_id_normalized_name`. Tags has no
 * other non-PK unique index, but this is still checked precisely (model + column set, not just
 * "any P2002") - see `constraint-errors.ts`'s header for why guessing at Prisma's error shape
 * without verifying it against a real database is exactly the mistake to not repeat. */
function isNormalizedNameConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false
  }
  if (error.meta?.modelName !== 'tags') {
    return false
  }
  const target = error.meta.target
  const columns = Array.isArray(target) ? target : typeof target === 'string' ? [target] : []
  const columnSet = new Set(columns)
  return (
    columnSet.size === 2 && columnSet.has('organization_id') && columnSet.has('normalized_name')
  )
}

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
  constructor(private readonly prisma: PrismaClient) {}

  async listByIds(tagIds: readonly string[]): Promise<readonly Tag[]> {
    if (tagIds.length === 0) {
      return []
    }
    const rows = await this.prisma.tags.findMany({ where: { id: { in: [...tagIds] } } })
    return rows.map(fromRow)
  }

  /**
   * Resolves requested names to persisted tags, creating any that do not yet exist - one-by-one,
   * committing and retrying itself rather than staging through a `PrismaUnitOfWork` (see this
   * file's header). A create that loses the race on `ux_tags_organization_id_normalized_name` is
   * not an error: it means another request just created the exact tag this one wanted, so this
   * re-reads and uses THAT row - the merge SPEC/20-feature-ideas-and-engagement.md "Tags" #7
   * requires.
   */
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

      // Read-your-own-writes WITHIN this loop: unlike the buffered writes elsewhere in this
      // package, each iteration's create is committed immediately (below), so a later iteration
      // requesting the SAME name in this same call sees it here rather than racing itself.
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
      const data = {
        id: tag.id,
        organization_id: tag.organizationId,
        name: tag.name,
        normalized_name: tag.normalizedName,
        created_at_utc: tag.createdAtUtc,
        updated_at_utc: tag.updatedAtUtc,
        created_by_user_id: tag.createdByUserId,
        updated_by_user_id: tag.updatedByUserId,
      }

      try {
        await this.prisma.tags.create({ data })
        existingByNormalizedName.set(normalizedName, data)
        result.push(tag)
      } catch (error) {
        if (!isNormalizedNameConflict(error)) {
          throw error
        }

        // Lost the race: someone else committed this exact (organization, normalized name)
        // between our read above and our create just now. Converge on their row rather than
        // erroring or leaving two tags with the same name.
        const winner = await this.prisma.tags.findUnique({
          where: {
            organization_id_normalized_name: {
              organization_id: input.organizationId,
              normalized_name: normalizedName,
            },
          },
        })
        if (!winner) {
          // The winner's row is gone by the time we looked (e.g. deleted in between) - not a
          // scenario this port has a way to represent, so surface the original conflict.
          throw error
        }
        existingByNormalizedName.set(normalizedName, winner)
        result.push(fromRow(winner))
      }
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
