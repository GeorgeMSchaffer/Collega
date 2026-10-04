// Persistence ports for fieldsets (SPEC/contracts/fieldsets.md). Infrastructure implements these
// against Prisma; this feature depends only on the shapes below.

import type { Fieldset } from '@collega/domain/fieldsets'

/** How many idea types have a fieldset attached: `active` excludes archived types (what the UI
 * shows as "used by"), `total` includes them (what blocks a delete). */
export type FieldsetUsage = {
  readonly active: number
  readonly total: number
}

export interface FieldsetRepository {
  add(fieldset: Fieldset): Promise<void>

  /** Persists a mutation made through `updateFieldset` or `setFieldsetFields`, members included. */
  save(fieldset: Fieldset): Promise<void>

  /** Hard delete; the members go with it. */
  delete(fieldsetId: string): Promise<void>

  /** Single fetch, members loaded. */
  getById(fieldsetId: string): Promise<Fieldset | null>

  /** Every fieldset of the organization, members loaded, in no guaranteed order. */
  listByOrganization(organizationId: string): Promise<readonly Fieldset[]>

  /** Batch loader, members loaded; ids that do not exist are simply absent from the result. */
  getManyByIds(fieldsetIds: readonly string[]): Promise<readonly Fieldset[]>

  /** Whether the organization already has a fieldset of this name (case-insensitive), excluding
   * `excludeId`. */
  existsByName(organizationId: string, name: string, excludeId: string | null): Promise<boolean>

  /** Usage per fieldset id; every requested id has an entry. */
  getUsage(fieldsetIds: readonly string[]): Promise<ReadonlyMap<string, FieldsetUsage>>
}

export interface OrganizationExistenceLookup {
  existsById(organizationId: string): Promise<boolean>
}
