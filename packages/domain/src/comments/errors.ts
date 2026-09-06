// See packages/domain/src/ideas/errors.ts for why this is a plain Error rather than the kernel's
// ValidationError: packages/domain imports nothing. The Application layer catches this and
// re-throws it as one, keyed on `field`.
export class CommentDomainError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'CommentDomainError'
    this.field = field
  }
}
