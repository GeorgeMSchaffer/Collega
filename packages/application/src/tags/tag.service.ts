// Tag autocomplete use case (SPEC/30-Contracts.md "Tag Contracts"). Tag creation itself happens
// implicitly when an idea is saved (owned by Ideas' `TagsPort.getOrCreate`), so this service only
// serves organization-scoped suggestions - mirrors .NET's `TagService`.

import { Role } from '@collega/domain/enums'
import { normalizeTagName } from '@collega/domain/tags'
import { type CurrentUserContext, NotFoundError, UnauthorizedError } from '../common/index.js'
import type { TagRepository } from './ports.js'

const MIN_SEARCH_LENGTH = 2
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

export class TagService {
  constructor(
    private readonly tags: TagRepository,
    private readonly currentUser: CurrentUserContext,
  ) {}

  /**
   * Organization-scoped tag names whose normalized form starts with the search prefix, ordered
   * alphabetically. Autocomplete begins after 2 characters
   * (SPEC/20-feature-ideas-and-engagement.md "Tags" #4).
   */
  async suggest(
    organizationId: string,
    search: string,
    limit: number | null,
  ): Promise<readonly string[]> {
    this.ensureOrganizationScope(organizationId)

    const prefix = normalizeTagName(search)
    if (prefix.length < MIN_SEARCH_LENGTH) {
      return []
    }

    const effectiveLimit = Math.min(MAX_LIMIT, Math.max(1, limit ?? DEFAULT_LIMIT))
    return this.tags.searchByPrefix(organizationId, prefix, effectiveLimit)
  }

  private ensureOrganizationScope(organizationId: string): void {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    if (this.currentUser.role === Role.SiteAdmin) {
      return
    }

    if (this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Organization not found.')
    }
  }
}
