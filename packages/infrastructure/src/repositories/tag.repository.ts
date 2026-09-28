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
//
// Settings → Tags' `add`, `save` and `delete` (2026-09-28) commit directly too, for a narrower
// reason: each is the only write in its request, and `add`/`save` must answer a lost race on the
// normalized name with the contract's field-keyed 400. Through the command buffer that P2002 would
// surface from `saveChanges()`, where nothing knows it was a tag name; `constraint-errors.ts`
// deliberately leaves this ordinary index alone, since `getOrCreate` merges on it instead.

import { randomUUID } from 'node:crypto'
import type { AiTagsPort } from '@collega/application/ai'
import { NotFoundError, ValidationError } from '@collega/application/common'
import type { TagsPort as IdeasTagsPort } from '@collega/application/ideas'
import {
  DUPLICATE_TAG_NAME_MESSAGE,
  type GetOrCreateTagsInput,
  type TagBoard,
  type TagCreatorName,
  type TagRepository,
  type TagUsage,
} from '@collega/application/tags'
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

/** Rethrows a lost race on the normalized name as the contract's field-keyed 400. */
function translateNameConflict(error: unknown): unknown {
  if (!isNormalizedNameConflict(error)) {
    return error
  }
  const validationError = new ValidationError('One or more fields are invalid.', {
    name: [DUPLICATE_TAG_NAME_MESSAGE],
  })
  validationError.cause = error
  return validationError
}

/** A tag deleted between the service's read and this write is the contract's 404, not a 500. */
function translateMissingTag(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    const notFound = new NotFoundError('Tag not found.')
    notFound.cause = error
    return notFound
  }
  return error
}

function toRow(tag: Tag): TagRow {
  return {
    id: tag.id,
    organization_id: tag.organizationId,
    name: tag.name,
    normalized_name: tag.normalizedName,
    color: tag.color,
    created_at_utc: tag.createdAtUtc,
    updated_at_utc: tag.updatedAtUtc,
    created_by_user_id: tag.createdByUserId,
    updated_by_user_id: tag.updatedByUserId,
  }
}

function fromRow(row: TagRow): Tag {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    normalizedName: row.normalized_name,
    color: row.color,
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
        color: input.pickNewTagColor(),
        nowUtc: input.nowUtc,
        actorUserId: input.actorUserId,
      })
      const data = toRow(tag)

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
      // `normalized_name`, not `name` - `EfTagRepository.SearchByPrefixAsync` ordered by the
      // normalized column and projected the display one. The two differ whenever casing does:
      // `normalized_name` is lowercased, so it sorts case-insensitively where `name` would let
      // the collation decide, and `"UX"` sorts after `"triage"` under a C collation but before
      // it here. The prefix filter already runs on the normalized column; the ordering follows it.
      orderBy: { normalized_name: 'asc' },
      take: limit,
      select: { name: true },
    })
    return rows.map((r) => r.name)
  }
  async listByOrganization(organizationId: string): Promise<readonly Tag[]> {
    const rows = await this.prisma.tags.findMany({ where: { organization_id: organizationId } })
    return rows.map(fromRow)
  }

  async getById(tagId: string): Promise<Tag | null> {
    const row = await this.prisma.tags.findUnique({ where: { id: tagId } })
    return row === null ? null : fromRow(row)
  }

  async findByNormalizedName(organizationId: string, normalizedName: string): Promise<Tag | null> {
    const row = await this.prisma.tags.findUnique({
      where: {
        organization_id_normalized_name: {
          organization_id: organizationId,
          normalized_name: normalizedName,
        },
      },
    })
    return row === null ? null : fromRow(row)
  }

  /** One grouped query for any number of tags: live ideas per (tag, board). Each idea is on one
   * board, so a tag's idea count is the sum over its boards. */
  async usageByTagIds(tagIds: readonly string[]): Promise<ReadonlyMap<string, TagUsage>> {
    if (tagIds.length === 0) {
      return new Map()
    }
    const rows = await this.prisma.$queryRaw<
      { tag_id: string; board_id: string; board_name: string; idea_count: number }[]
    >(Prisma.sql`
      SELECT idea_tag.tag_id, board.id AS board_id, board.name AS board_name,
        COUNT(DISTINCT idea.id)::int AS idea_count
      FROM idea_tags AS idea_tag
      INNER JOIN ideas AS idea ON idea.id = idea_tag.idea_id
      INNER JOIN boards AS board ON board.id = idea.board_id
      WHERE idea_tag.tag_id IN (${Prisma.join(tagIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND idea.is_deleted = FALSE
      GROUP BY idea_tag.tag_id, board.id, board.name
    `)

    const usage = new Map<string, { ideaCount: number; boards: TagBoard[] }>()
    for (const row of rows) {
      const entry = usage.get(row.tag_id) ?? { ideaCount: 0, boards: [] }
      entry.ideaCount += row.idea_count
      entry.boards.push({ boardId: row.board_id, name: row.board_name })
      usage.set(row.tag_id, entry)
    }
    return usage
  }

  async getCreatorNames(userIds: readonly string[]): Promise<ReadonlyMap<string, TagCreatorName>> {
    if (userIds.length === 0) {
      return new Map()
    }
    const rows = await this.prisma.users.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, first_name: true, last_name: true },
    })
    return new Map(
      rows.map((row) => [row.id, { firstName: row.first_name, lastName: row.last_name }]),
    )
  }

  async add(tag: Tag): Promise<void> {
    try {
      await this.prisma.tags.create({ data: toRow(tag) })
    } catch (error) {
      throw translateNameConflict(error)
    }
  }

  async save(tag: Tag): Promise<void> {
    const { id, organization_id, created_at_utc, created_by_user_id, ...changes } = toRow(tag)
    try {
      await this.prisma.tags.update({ where: { id }, data: changes })
    } catch (error) {
      throw translateMissingTag(translateNameConflict(error))
    }
  }

  async delete(tagId: string): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.idea_tags.deleteMany({ where: { tag_id: tagId } }),
        this.prisma.tags.delete({ where: { id: tagId } }),
      ])
    } catch (error) {
      throw translateMissingTag(error)
    }
  }
}
