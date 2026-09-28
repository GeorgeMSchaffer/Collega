// Tag autocomplete, the tag catalog, and Settings → Tags (SPEC/30-Contracts.md "Tag Contracts" and
// "Tag colour and management"; SPEC/20-feature-ideas-and-engagement.md Tags rules 9-15). Inline
// creation while tagging an idea stays with Ideas' `TagsPort.getOrCreate`.

import { randomUUID } from 'node:crypto'
import { Role } from '@collega/domain/enums'
import {
  createTag,
  normalizeTagColor,
  normalizeTagName,
  type Tag,
  TagDomainError,
  updateTag,
  validateTagName,
} from '@collega/domain/tags'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ensureNotDirectSiteAdmin,
  ForbiddenError,
  NotFoundError,
  type RandomSource,
  UnauthorizedError,
  ValidationError,
} from '../common/index.js'
import type { CreateTagCommand, TagItem, UpdateTagCommand } from './models.js'
import type { OrganizationExistenceLookup, TagRepository, TagUsage } from './ports.js'
import { randomTagColor } from './random-color.js'

const MIN_SEARCH_LENGTH = 2
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

export const DUPLICATE_TAG_NAME_MESSAGE = 'A tag with this name already exists.'

const NO_USAGE: TagUsage = { ideaCount: 0, boards: [] }

export class TagService {
  constructor(
    private readonly tags: TagRepository,
    private readonly organizations: OrganizationExistenceLookup,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
    private readonly random: RandomSource,
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
    this.ensureReadScope(organizationId)

    const prefix = normalizeTagName(search)
    if (prefix.length < MIN_SEARCH_LENGTH) {
      return []
    }

    const effectiveLimit = Math.min(MAX_LIMIT, Math.max(1, limit ?? DEFAULT_LIMIT))
    return this.tags.searchByPrefix(organizationId, prefix, effectiveLimit)
  }

  /** Every tag in the organization - member-readable on purpose, because the Ideas Tags filter
   * every role uses needs the full set (SPEC/30-Contracts.md `tags/catalog`). */
  async catalog(organizationId: string): Promise<readonly TagItem[]> {
    this.ensureReadScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const tags = await this.tags.listByOrganization(organizationId)
    const items = await this.toItems(tags)
    return [...items].sort(
      (a, b) =>
        compareStrings(a.name.toLowerCase(), b.name.toLowerCase()) ||
        compareStrings(a.name, b.name) ||
        compareStrings(a.tagId, b.tagId),
    )
  }

  /** Adds a tag before anyone uses it (Tags rule 13). Writes no audit event. */
  async create(organizationId: string, command: CreateTagCommand): Promise<TagItem> {
    this.ensureAdminScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const { name, color } = validateInput(command)
    await this.ensureNameAvailable(organizationId, name, null)

    const tag = runDomain(createTag, {
      id: randomUUID(),
      organizationId,
      name,
      color: color ?? randomTagColor(this.random),
      nowUtc: this.clock.now(),
      actorUserId: this.currentUser.userId,
    })
    await this.tags.add(tag)

    return this.toItem(tag)
  }

  /**
   * Renames and/or recolours (Tags rule 14). A rename reaches every idea at once because ideas
   * reference the tag's id; the ideas themselves are not touched, so no idea's `updatedAtUtc`
   * moves. One `TagRenamed` event when the name changes; none for a colour-only edit.
   */
  async update(tagId: string, command: UpdateTagCommand): Promise<TagItem> {
    const existing = await this.tags.getById(tagId)
    if (existing === null) {
      throw new NotFoundError('Tag not found.')
    }
    this.ensureAdminScope(existing.organizationId)

    const { name, color } = validateInput(command)
    await this.ensureNameAvailable(existing.organizationId, name, existing.id)

    const now = this.clock.now()
    const tag = runDomain(updateTag, existing, { name, color }, now, this.currentUser.userId)
    await this.tags.save(tag)

    const item = await this.toItem(tag)

    // A case-only rename changes the name people see, so it counts; an unchanged name does not.
    if (tag.name !== existing.name) {
      await this.audit('TagRenamed', tag, `Tag '${existing.name}' renamed to '${tag.name}'.`, now, {
        tagId: tag.id,
        oldName: existing.name,
        newName: tag.name,
        ideaCount: item.ideaCount,
      })
    }

    return item
  }

  /**
   * Removes the tag from every idea - both phases, archived boards and soft-deleted ideas - and
   * deletes it, in one transaction (Tags rule 15). Not reversible. The ideas' `updatedAtUtc`
   * stays: their labels changed, not their content.
   */
  async delete(tagId: string): Promise<void> {
    const existing = await this.tags.getById(tagId)
    if (existing === null) {
      throw new NotFoundError('Tag not found.')
    }
    this.ensureAdminScope(existing.organizationId)

    const usage = (await this.tags.usageByTagIds([existing.id])).get(existing.id) ?? NO_USAGE
    const now = this.clock.now()

    await this.tags.delete(existing.id)

    await this.audit('TagDeleted', existing, `Tag '${existing.name}' deleted.`, now, {
      tagId: existing.id,
      name: existing.name,
      ideaCount: usage.ideaCount,
    })
  }

  private async toItem(tag: Tag): Promise<TagItem> {
    const [item] = await this.toItems([tag])
    if (item === undefined) {
      throw new Error('toItems returned no item for one tag.')
    }
    return item
  }

  private async toItems(tags: readonly Tag[]): Promise<readonly TagItem[]> {
    if (tags.length === 0) {
      return []
    }
    const usage = await this.tags.usageByTagIds(tags.map((t) => t.id))
    const creatorIds = [
      ...new Set(tags.flatMap((t) => (t.createdByUserId === null ? [] : [t.createdByUserId]))),
    ]
    const creators = await this.tags.getCreatorNames(creatorIds)

    return tags.map((tag) => {
      const tagUsage = usage.get(tag.id) ?? NO_USAGE
      const creator = tag.createdByUserId === null ? undefined : creators.get(tag.createdByUserId)
      return {
        tagId: tag.id,
        name: tag.name,
        color: tag.color,
        ideaCount: tagUsage.ideaCount,
        boards: [...tagUsage.boards].sort(
          (a, b) =>
            compareStrings(a.name.toLowerCase(), b.name.toLowerCase()) ||
            compareStrings(a.name, b.name) ||
            compareStrings(a.boardId, b.boardId),
        ),
        createdAtUtc: tag.createdAtUtc,
        createdBy:
          tag.createdByUserId === null || creator === undefined
            ? null
            : {
                userId: tag.createdByUserId,
                displayName: `${creator.firstName} ${creator.lastName}`.trim(),
              },
      }
    })
  }

  /** Refused onto another tag's normalized name; the same tag (a case-only rename) is fine. A race
   * past this check is caught by the unique index and answered the same way (`TagRepository.add`). */
  private async ensureNameAvailable(
    organizationId: string,
    name: string,
    selfTagId: string | null,
  ): Promise<void> {
    const clash = await this.tags.findByNormalizedName(organizationId, normalizeTagName(name))
    if (clash !== null && clash.id !== selfTagId) {
      throw new ValidationError('One or more fields are invalid.', {
        name: [DUPLICATE_TAG_NAME_MESSAGE],
      })
    }
  }

  private async ensureOrganizationExists(organizationId: string): Promise<void> {
    if (!(await this.organizations.existsById(organizationId))) {
      throw new NotFoundError('Organization not found.')
    }
  }

  /** Site Admin reads any organization; everyone else only their own, a mismatch being a 404. */
  private ensureReadScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    if (role === Role.SiteAdmin) {
      return
    }
    if (this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Organization not found.')
    }
  }

  /** An in-scope Org Admin; a Site Admin only through View As (rule 25). Another organization's
   * tag is a 404 before the role is considered, so a member cannot probe for it. */
  private ensureAdminScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    ensureNotDirectSiteAdmin(this.currentUser)

    if (this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Tag not found.')
    }
    if (role !== Role.OrgAdmin) {
      throw new ForbiddenError('You are not allowed to manage tags in this organization.')
    }
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.role
  }

  private async audit(
    eventType: string,
    tag: Tag,
    message: string,
    occurredAtUtc: Date,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    // Rule 14: while acting as someone, the real administrator is the actor.
    const attribution = attributeAudit(this.currentUser, this.currentUser.userId)
    await this.auditEvents.write({
      eventType,
      entityType: 'Tag',
      entityId: tag.id,
      organizationId: tag.organizationId,
      attribution,
      message,
      occurredAtUtc,
      metadataJson: JSON.stringify(metadata),
    })
  }
}

/** Name and colour are checked together, so one response names every bad field. */
function validateInput(command: { readonly name: string; readonly color: string | null }): {
  readonly name: string
  readonly color: string | null
} {
  const failures: Record<string, string[]> = {}
  let name = ''
  let color: string | null = null
  try {
    name = validateTagName(command.name)
  } catch (error) {
    collect(error, failures)
  }
  if (command.color !== null) {
    try {
      color = normalizeTagColor(command.color)
    } catch (error) {
      collect(error, failures)
    }
  }
  if (Object.keys(failures).length > 0) {
    throw new ValidationError('One or more fields are invalid.', failures)
  }
  return { name, color }
}

function collect(error: unknown, failures: Record<string, string[]>): void {
  if (!(error instanceof TagDomainError)) {
    throw error
  }
  failures[error.field] = [...(failures[error.field] ?? []), error.message]
}

function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof TagDomainError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}

function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}
