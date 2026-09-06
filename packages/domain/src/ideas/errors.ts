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
