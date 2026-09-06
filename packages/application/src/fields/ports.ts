// Persistence and infrastructure ports for User-Defined Field definitions
// (SPEC/20-feature-user-defined-fields.md). Wave C implements these against Prisma; this feature
// only depends on the shapes below, never on Prisma or Nest directly.

import type { FieldDefinition } from '@collega/domain/fields'

export interface FieldDefinitionRepository {
  add(definition: FieldDefinition): Promise<void>

  /** Persists a mutation made through `updateFieldDefinition`, `setFieldDefinitionOptions`,
   * `setFieldDefinitionDisplayOrder`, or `softDeleteFieldDefinition`. */
  save(definition: FieldDefinition): Promise<void>

  /** Single fetch (with `options` loaded), for update/delete. */
  getById(id: string): Promise<FieldDefinition | null>

  /** List in display order. When `includeDeleted` is false only active definitions are returned
   * (the set idea forms and value validation use). */
  listByOrganization(
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<readonly FieldDefinition[]>

  /** Active definitions for the organization, for a reorder that persists new display orders. */
  listActiveByOrganization(organizationId: string): Promise<readonly FieldDefinition[]>

  /**
   * Whether an ACTIVE definition already uses `name` (case-insensitive), excluding `excludeId`.
   *
   * MUST query only rows where `is_deleted = false` - the frozen schema's partial unique index
   * `ux_field_definitions_organization_id_normalized_name` is scoped the same way, so a
   * soft-deleted definition's name is available for reuse. An implementation that checks a plain
   * (non-partial) uniqueness condition would reject a legitimate reuse this port must allow.
   *
   * This pre-check is what produces the pinned `400` for a duplicate name
   * (`FieldDefinitionService` never lets the constraint itself answer); a concurrent create that
   * still races past it and hits the partial index should surface as the kernel's `ConflictError`
   * (409) from the repository's own insert path, not a raw constraint-violation 500 - that
   * mapping is Wave C's to implement, since it lives in the Prisma-backed `add`/`save`.
   */
  existsActiveByName(
    organizationId: string,
    name: string,
    excludeId: string | null,
  ): Promise<boolean>
}

/**
 * Narrow existence check so this feature does not need to depend on the Organizations
 * partition's full repository port just to answer "does this organization id exist".
 */
export interface OrganizationExistenceLookup {
  existsById(organizationId: string): Promise<boolean>
}
