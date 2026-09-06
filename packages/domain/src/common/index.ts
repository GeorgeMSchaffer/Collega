/**
 * Fields every persisted entity carries, and the two transitions that set them.
 *
 * Expressed as a type plus pure functions rather than the C# abstract base class, because
 * the Wave B partitions independently settled on immutable data with transition functions -
 * a base class buys nothing when every operation already takes an explicit `nowUtc` and
 * actor.
 *
 * Ids are NOT generated here. The C# `EntityBase` defaulted `Id = Guid.NewGuid()` ambiently;
 * generating them in the application layer instead keeps domain free of hidden randomness,
 * which is what makes these functions trivially testable.
 */
export type Auditable = {
  readonly createdAtUtc: Date
  readonly updatedAtUtc: Date
  readonly createdByUserId: string | null
  readonly updatedByUserId: string | null
}

/**
 * Stamps a newly created entity. Both timestamps are the same instant, deliberately - the
 * .NET `MarkCreated` did the same, and the golden corpus records the equality.
 *
 * `actorUserId` is the ACTING user, which during a View As session is the impersonated one.
 * That is rule 15 and it is the opposite of audit attribution's rule 14: content created
 * through View As belongs to the organization it was created in, not to the administrator.
 */
export function markCreated(nowUtc: Date, actorUserId: string | null): Auditable {
  return {
    createdAtUtc: nowUtc,
    updatedAtUtc: nowUtc,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId,
  }
}

/** Stamps a modification, leaving the creation fields untouched. */
export function markUpdated<T extends Auditable>(
  entity: T,
  nowUtc: Date,
  actorUserId: string | null,
): T {
  return { ...entity, updatedAtUtc: nowUtc, updatedByUserId: actorUserId }
}
