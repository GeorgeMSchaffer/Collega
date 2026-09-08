// Domain-level invariant violations for the Organization aggregate. packages/domain imports
// nothing, so this cannot be a kernel ValidationError (that lives in packages/application/
// common) - the Application layer catches this and re-throws it as one, keyed on `field`,
// exactly mirroring how the .NET side let a blank Title/Description surface as a per-field 400
// (see ideas/errors.ts's IdeaDomainError, the reference for this pattern).
export class OrganizationDomainError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'OrganizationDomainError'
    this.field = field
  }
}
