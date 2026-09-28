import type { Tag } from '@collega/domain/tags'

export type GetOrCreateTagsInput = {
  readonly organizationId: string
  readonly requestedNames: readonly string[]
  /** Called once per tag actually created, for its colour (Tags rule 10). */
  readonly pickNewTagColor: () => string
  readonly nowUtc: Date
  readonly actorUserId: string | null
}

/** A board one of a tag's live ideas is on. */
export type TagBoard = {
  readonly boardId: string
  readonly name: string
}

/** How a tag is used: live (not soft-deleted) ideas in either phase, and the boards they are on. */
export type TagUsage = {
  readonly ideaCount: number
  /** Unordered; the service orders them. */
  readonly boards: readonly TagBoard[]
}

export type TagCreatorName = {
  readonly firstName: string
  readonly lastName: string
}

export interface TagRepository {
  /** Loads tags by their ids (used to project idea tag names). */
  listByIds(tagIds: readonly string[]): Promise<readonly Tag[]>

  /**
   * Resolves the requested tag display names to persisted `Tag` rows within the organization,
   * creating any that do not yet exist and reusing those that do. Normalized names are trimmed
   * and compared case-insensitively; the unique (organization, normalized name) index guarantees
   * concurrent creation of the same name merges to a single tag
   * (SPEC/20-feature-ideas-and-engagement.md "Tags" #6-7).
   */
  getOrCreate(input: GetOrCreateTagsInput): Promise<readonly Tag[]>

  /**
   * Autocomplete: active tag display names in the organization whose normalized form starts with
   * the given normalized prefix, ordered alphabetically (SPEC/30-Contracts.md "Tag Contracts").
   */
  searchByPrefix(
    organizationId: string,
    normalizedPrefix: string,
    limit: number,
  ): Promise<readonly string[]>

  /** Every tag in the organization, unordered. */
  listByOrganization(organizationId: string): Promise<readonly Tag[]>

  getById(tagId: string): Promise<Tag | null>

  findByNormalizedName(organizationId: string, normalizedName: string): Promise<Tag | null>

  /**
   * Usage for each of the given tags, in a fixed number of grouped queries however many there
   * are. A tag with no live idea is absent from the map.
   */
  usageByTagIds(tagIds: readonly string[]): Promise<ReadonlyMap<string, TagUsage>>

  getCreatorNames(userIds: readonly string[]): Promise<ReadonlyMap<string, TagCreatorName>>

  /**
   * Inserts the tag, committing immediately - the one write in its request, like `getOrCreate`'s.
   * Losing a race on the organization's normalized name is a `ValidationError` keyed `name`
   * (SPEC/30-Contracts.md: the concurrent duplicate answers the loser `400`, not `500`).
   */
  add(tag: Tag): Promise<void>

  /** Updates the tag, committing immediately, with the same answer to a lost race as `add`. */
  save(tag: Tag): Promise<void>

  /** Removes every `idea_tags` row for the tag - soft-deleted ideas included - and the tag itself,
   * in one transaction, committed immediately. */
  delete(tagId: string): Promise<void>
}

/** Narrow organization existence check, as the other catalog features declare it. */
export interface OrganizationExistenceLookup {
  existsById(organizationId: string): Promise<boolean>
}
