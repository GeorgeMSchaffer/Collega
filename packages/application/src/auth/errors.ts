import { ApplicationError } from '../common/index.js'

/**
 * Maps to 429: account locked out after too many failed login attempts
 * (SPEC/20-feature-auth.md #6). Not in the shared kernel (`packages/application/src/common`,
 * frozen by S0.3) because lockout is specific to authentication - see the slice report for why
 * this couldn't simply be added there.
 */
export class LockedOutError extends ApplicationError {
  readonly kind = 'lockedOut' as const
}
