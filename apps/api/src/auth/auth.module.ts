import { Module } from '@nestjs/common'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { AuthGuard } from './auth.guard.js'
import { RolesGuard } from './roles.guard.js'

/**
 * Exports `AuthGuard` and `RolesGuard` for any feature module to apply with
 * `@UseGuards(AuthGuard, RolesGuard)` (order matters - `RolesGuard` reads identity `AuthGuard`
 * resolves) plus `@Roles(...)` / `@AllowWhilePasswordChangeRequired()`, the Nest equivalents of
 * `[Authorize(Roles = ...)]` and `AllowWhilePasswordChangeRequiredAttribute`. Nothing else lives
 * here: login/register/change-password/View As are feature controllers (D1/D7), not host wiring.
 */
@Module({
  imports: [PersistenceModule],
  providers: [AuthGuard, RolesGuard],
  exports: [AuthGuard, RolesGuard],
})
export class AuthModule {}
