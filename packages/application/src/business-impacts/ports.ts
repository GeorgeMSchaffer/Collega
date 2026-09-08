// Persistence and infrastructure ports for Business Impact administration. Wave C implements
// these against Prisma; this feature only depends on the shapes below, never on Prisma or Nest
// directly.

import type { BusinessImpact } from '@collega/domain/business-impacts'

export interface BusinessImpactRepository {
  add(impact: BusinessImpact): Promise<void>

  /** Used once, at organization bootstrap, to provision the canonical default option set. */
  addMany(impacts: readonly BusinessImpact[]): Promise<void>

  /** Persists a mutation made through `updateBusinessImpact`, `setBusinessImpactSortOrder`, or
   * `softDeleteBusinessImpact`. */
  save(impact: BusinessImpact): Promise<void>

  getById(businessImpactId: string): Promise<BusinessImpact | null>

  /** Organization options in catalog order; active only unless `includeDeleted`. */
  listByOrganization(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly BusinessImpact[]>

  countActiveByOrganization(organizationId: string): Promise<number>
}

/**
 * Narrow existence check so this feature does not need to depend on the Organizations
 * partition's full repository port just to answer "does this organization id exist".
 */
export interface OrganizationExistenceLookup {
  existsById(organizationId: string): Promise<boolean>
}
