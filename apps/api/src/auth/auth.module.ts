import { Module } from '@nestjs/common'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { AuthGuard } from './auth.guard.js'
import { AuthRateLimitGuard } from './rate-limit.guard.js'
import { RolesGuard } from './roles.guard.js'

/**
 * Exports `AuthGuard` and `RolesGuard` for any feature module to apply with
 * `@UseGuards(AuthGuard, RolesGuard)` (order matters - `RolesGuard` reads identity `AuthGuard`
 * resolves) plus `@Roles(...)` / `@AllowWhilePasswordChangeRequired()`, the Nest equivalents of
 * `[Authorize(Roles = ...)]` and `AllowWhilePasswordChangeRequiredAttribute`. Nothing else lives
 * here: login/register/change-password/View As are feature controllers (D1/D7), not host wiring.
 *
 * `AuthRateLimitGuard` is exported alongside them and applied FIRST where it is used, so an
 * anonymous caller hammering an authenticated route is turned away before the session lookup.
 */
@Module({
  imports: [PersistenceModule],
  providers: [AuthGuard, AuthRateLimitGuard, RolesGuard],
  exports: [AuthGuard, AuthRateLimitGuard, RolesGuard],
})
export class AuthModule {}
