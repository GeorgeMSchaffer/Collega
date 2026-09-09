import {
  type AccessTokenIssuer,
  AuthService,
  type ImageProcessor,
  type PasswordHasher,
} from '@collega/application/auth'
import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type { OrganizationRepository } from '@collega/application/organizations'
import type { UserRepository } from '@collega/application/users'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { AuthenticationController } from './authentication.controller.js'

/**
 * D1's session surface: `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`.
 *
 * **Why this is not `apps/api/src/auth/`.** That directory is host wiring - the guards every
 * feature applies - and the module generator's `FOUNDATION_DIRS` denylist excludes it from
 * `FEATURE_MODULES` for that reason. `auth.module.ts` says so in its own header: "login/register/
 * change-password/View As are feature controllers (D1/D7), not host wiring." So the feature lives
 * beside it under its own name and is picked up by the generator like any other D-wave module.
 *
 * `AuthService` is constructed here rather than carrying an `@Injectable()` because
 * `packages/application` may not import `@nestjs/common` (layer rule,
 * `SPEC/50-typescript-migration.md` section 3). Every dependency is a port resolved from
 * `PORT_TOKENS` and bound to an adapter by `PersistenceModule`; nothing is constructed by hand.
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [AuthenticationController],
  providers: [
    {
      provide: AuthService,
      useFactory: (
        users: UserRepository,
        organizations: OrganizationRepository,
        unitOfWork: UnitOfWork,
        passwordHasher: PasswordHasher,
        tokenIssuer: AccessTokenIssuer,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        imageProcessor: ImageProcessor,
        clock: Clock,
      ) =>
        new AuthService(
          users,
          organizations,
          unitOfWork,
          passwordHasher,
          tokenIssuer,
          auditEvents,
          currentUser,
          imageProcessor,
          clock,
        ),
      inject: [
        PORT_TOKENS.UserRepository,
        PORT_TOKENS.OrganizationRepository,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.PasswordHasher,
        PORT_TOKENS.AccessTokenIssuer,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.ImageProcessor,
        PORT_TOKENS.Clock,
      ],
    },
  ],
  // The users controller's temporary-password endpoint is an `AuthService` call under a `/users`
  // route, so that module imports this one rather than building a second copy of the same
  // nine-port service.
  exports: [AuthService],
})
export class AuthenticationModule {}
