// Organization-scoped Business Impact option (SPEC/30-Contracts.md "Idea Field Option
// Contracts"). Like `IdeaType` but carries an editable `#RRGGBB` `color` used on the idea card
// chip. Ordered by `sortOrder`; the first active option is the default; every organization must
// retain at least one active Business Impact.
//
// Modelled as plain immutable data plus transition functions, per `packages/domain/src/common`.

import { type Auditable, markCreated, markUpdated } from '../common/index.js'

/** Every organization must keep at least this many active options. */
export const MINIMUM_ACTIVE_BUSINESS_IMPACTS_PER_ORGANIZATION = 1

/**
 * Raised when a caller asks this module to put a `BusinessImpact` into an invalid state. Carries
 * the field the violation belongs to, mirroring `IdeaTypeDomainError`. In practice every one of
 * these is a defensive backstop: `BusinessImpactService` validates name/color itself before
 * calling in, mirroring how the .NET `IdeaFieldService` never wrapped these calls.
 */
export class BusinessImpactDomainError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'BusinessImpactDomainError'
    this.field = field
  }
}

export type BusinessImpact = Auditable & {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly color: string
  readonly sortOrder: number
  readonly isDeleted: boolean
}

function normalizeName(name: string): string {
  const trimmed = (name ?? '').trim()
  if (trimmed.length === 0) {
    throw new BusinessImpactDomainError('name', 'Name is required.')
  }
  return trimmed
}

function normalizeColor(color: string): string {
  const trimmed = (color ?? '').trim()
  if (trimmed.length === 0) {
    throw new BusinessImpactDomainError('color', 'Color is required.')
  }
  return trimmed
}

export function createBusinessImpact(params: {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly color: string
  readonly sortOrder: number
  readonly nowUtc: Date
  readonly actorUserId: string | null
}): BusinessImpact {
  if (params.organizationId.trim().length === 0) {
    throw new BusinessImpactDomainError('organizationId', 'Organization id is required.')
  }

  return {
    id: params.id,
    organizationId: params.organizationId,
    name: normalizeName(params.name),
    color: normalizeColor(params.color),
    sortOrder: params.sortOrder,
    isDeleted: false,
    ...markCreated(params.nowUtc, params.actorUserId),
  }
}

function ensureNotDeleted(impact: BusinessImpact): void {
  if (impact.isDeleted) {
    throw new BusinessImpactDomainError(
      'businessImpact',
      'A deleted Business Impact cannot be updated.',
    )
  }
}

export function updateBusinessImpact(
  impact: BusinessImpact,
  params: { readonly name: string; readonly color: string; readonly sortOrder: number },
  nowUtc: Date,
  actorUserId: string | null,
): BusinessImpact {
  ensureNotDeleted(impact)
  return markUpdated(
    {
      ...impact,
      name: normalizeName(params.name),
      color: normalizeColor(params.color),
      sortOrder: params.sortOrder,
    },
    nowUtc,
    actorUserId,
  )
}

/** Sets only the catalog sort order, leaving name and color untouched. */
export function setBusinessImpactSortOrder(
  impact: BusinessImpact,
  sortOrder: number,
  nowUtc: Date,
  actorUserId: string | null,
): BusinessImpact {
  return markUpdated({ ...impact, sortOrder }, nowUtc, actorUserId)
}

/** Soft-deletes the option so existing idea references stay valid. Idempotent. */
export function softDeleteBusinessImpact(
  impact: BusinessImpact,
  nowUtc: Date,
  actorUserId: string | null,
): BusinessImpact {
  if (impact.isDeleted) {
    return impact
  }
  return markUpdated({ ...impact, isDeleted: true }, nowUtc, actorUserId)
}
