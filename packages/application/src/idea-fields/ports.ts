// Persistence and infrastructure ports for Idea Type administration. Wave C implements these
// against Prisma; this feature only depends on the shapes below, never on Prisma or Nest
// directly.

import type { IdeaType } from '@collega/domain/idea-fields'

export interface IdeaTypeRepository {
  add(ideaType: IdeaType): Promise<void>

  /** Used once, at organization bootstrap, to provision the canonical default option set. */
  addMany(ideaTypes: readonly IdeaType[]): Promise<void>

  /** Persists a mutation made through `updateIdeaType`, `setIdeaTypeSortOrder`,
   * `softDeleteIdeaType`, `setIdeaTypeAppearance`, `setIdeaTypeFieldSelection`, or
   * `clearIdeaTypeFieldSelection`. */
  save(ideaType: IdeaType): Promise<void>

  getById(ideaTypeId: string): Promise<IdeaType | null>

  /** Organization options in catalog order; active only unless `includeDeleted`. */
  listByOrganization(organizationId: string, includeDeleted: boolean): Promise<readonly IdeaType[]>

  countActiveByOrganization(organizationId: string): Promise<number>
}

/**
 * Narrow existence check so this feature does not need to depend on the Organizations
 * partition's full repository port just to answer "does this organization id exist".
 */
export interface OrganizationExistenceLookup {
  existsById(organizationId: string): Promise<boolean>
}
