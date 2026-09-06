// See packages/domain/src/ideas/errors.ts for why this is a plain Error rather than the kernel's
// ValidationError: packages/domain imports nothing.
export class NotificationDomainError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'NotificationDomainError'
    this.field = field
  }
}
