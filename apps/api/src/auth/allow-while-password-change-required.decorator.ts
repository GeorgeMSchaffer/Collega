import { SetMetadata } from '@nestjs/common'

export const ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED_KEY = 'collega:allowWhilePasswordChangeRequired'

/**
 * Opts a handler into the mandatory-password-change allowlist (SPEC/30-Contracts.md: while
 * `mustChangePassword` is true, only `GET /api/v1/auth/me` and `POST /api/v1/auth/change-password`
 * answer; everything else is refused). Deliberately opt-IN, mirroring .NET's
 * `AllowWhilePasswordChangeRequiredAttribute`: "a new endpoint is closed by default and only
 * joins the allowlist when someone writes this attribute on it" - an opt-out design would
 * silently expose every endpoint added after this guard was written.
 */
export const AllowWhilePasswordChangeRequired = () =>
  SetMetadata(ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED_KEY, true)
