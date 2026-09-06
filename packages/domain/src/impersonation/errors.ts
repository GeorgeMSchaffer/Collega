// Domain-level invariant violations for the ImpersonationSession aggregate. packages/domain
// imports nothing, so this cannot be a kernel ValidationError (that lives in
// packages/application/common) - the Application layer would catch this and re-throw it as one,
// keyed on `field`, exactly mirroring users/errors.ts's UserDomainError and
// ideas/errors.ts's IdeaDomainError.
//
// In practice this is defence in depth rather than a reachable path: the API layer validates a
// missing targetUserId before ViewAsService is ever called (SPEC/30-Contracts.md), and
// ViewAsService's own authorization check refuses a real user acting as themselves with a 403
// before startImpersonationSession is reached. See ImpersonationSession.Start's C# original for
// the same remark.
export class ImpersonationDomainError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'ImpersonationDomainError'
    this.field = field
  }
}
