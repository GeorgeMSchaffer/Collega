import type { Organization } from '@collega/domain/organizations'
import type { PageRequest } from '../common/index.js'

/**
 * Store-facing filter for organization listing. Archived organizations are excluded unless
 * `includeArchived` is set (SPEC/30-Contracts.md "Collection Conventions").
 */
export type OrganizationListFilter = {
  readonly page: PageRequest
  readonly search: string | null
  readonly includeArchived: boolean
  readonly sortBy: string | null
  readonly sortDirection: string | null
}

/** A page of organizations plus the sort actually applied - the store resolves the default
 * sort, so the result carries it back rather than the caller guessing. */
export type OrganizationPage = {
  readonly items: readonly Organization[]
  readonly page: number
  readonly pageSize: number
  readonly totalCount: number
  readonly sortBy: string | null
  readonly sortDirection: string
}

export interface OrganizationRepository {
  getById(organizationId: string): Promise<Organization | null>
  getByInviteCode(inviteCode: string): Promise<Organization | null>
  /** Paged organization list for Site Admin (SPEC/30-Contracts.md `GET /organizations`). */
  list(filter: OrganizationListFilter): Promise<OrganizationPage>
  inviteCodeExists(inviteCode: string): Promise<boolean>
  add(organization: Organization): Promise<void>
  /** Persists changes to an organization already added - the domain functions return a new
   * immutable value rather than mutating in place, so update is its own call. */
  update(organization: Organization): Promise<void>
}

/**
 * Generates organization invite codes. Lives behind an abstraction so the randomness stays out
 * of the Application layer (keeping use cases hermetic); Infrastructure supplies the
 * implementation.
 */
export interface InviteCodeGenerator {
  /** A fresh, random invite code. Uniqueness across organizations is the caller's concern. */
  generate(): string
}

/** Identifiers/counts a caller needs to report after provisioning (contract create response). */
export type OrganizationBootstrapResult = {
  readonly defaultBoardId: string
  readonly defaultStatusCount: number
}

/**
 * Provisions the default statuses and one default board for a newly created organization
 * (SPEC/20-feature-organizations-and-users.md rule #10, boards-and-statuses "Board Rules" #4).
 * The concrete implementation needs the Boards/Statuses/IdeaTypes/BusinessImpacts ports those
 * features own (outside this slice's globs), so only the port is declared here; a later
 * integration slice supplies it. Staged into the current unit of work - the caller owns the
 * commit.
 */
export interface OrganizationBootstrapPort {
  provisionDefaults(
    organizationId: string,
    nowUtc: Date,
    actorUserId: string | null,
  ): Promise<OrganizationBootstrapResult>
}

// Clock, UnitOfWork, and AuditEventWriter/AuditEventInput come from the shared kernel
// (packages/application/src/common) - not redeclared here.
