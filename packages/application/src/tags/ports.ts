import type { Tag } from '@collega/domain/tags'

export type GetOrCreateTagsInput = {
  readonly organizationId: string
  readonly requestedNames: readonly string[]
  readonly nowUtc: Date
  readonly actorUserId: string | null
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
}
