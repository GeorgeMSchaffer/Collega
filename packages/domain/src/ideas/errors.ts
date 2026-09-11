// Domain-level invariant violations for the Idea aggregate. packages/domain imports nothing, so
// this cannot be a kernel ValidationError (that lives in packages/application/common) - the
// Application layer catches this and re-throws it as one, keyed on `field`, exactly mirroring how
// the .NET side let Idea's ArgumentException surface as a per-field 400 (see CSV import's
// `catch (ArgumentException ex) { Reject(ex.Message) }`, ideas/idea.service.ts's counterpart).
export class IdeaDomainError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'IdeaDomainError'
    this.field = field
  }
}

/**
 * A delivery transition asked for from the wrong phase, where the contract answers `409` rather
 * than the field-keyed `400` `IdeaDomainError` carries - promoting an item that is already in
 * Delivery, or returning one that was never promoted
 * (SPEC/20-feature-issues-and-delivery.md "API Endpoints").
 *
 * Deliberately NOT a subclass of `IdeaDomainError`: every existing catch site maps that to a
 * field-keyed 400, so inheriting would silently answer 400 where the contract says 409. A sibling
 * class surfaces as an unhandled error until the Application slice maps it to `ConflictError`,
 * which is the louder and more honest failure of the two.
 */
export class IdeaPhaseConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IdeaPhaseConflictError'
  }
}
