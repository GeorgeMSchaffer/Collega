import type { PasswordHasher } from '@collega/application/auth'
import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import { type UserRepository, UserService } from '@collega/application/users'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { AuthenticationModule } from '../authentication/authentication.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { UsersController } from './users.controller.js'

/**
 * D1's user surface: `GET`/`PUT /users/{userId}` and the admin-issued temporary password.
 *
 * `AuthenticationModule` is imported rather than re-declaring `AuthService`, which the temporary
 * password endpoint needs. Two factories building the same nine-port service would be two things
 * to keep in step, and the second one to drift would fail somewhere unrelated to its own file.
 *
 * `UserService` is constructed here rather than carrying `@Injectable()` because
 * `packages/application` may not import `@nestjs/common` (layer rule,
 * `SPEC/50-typescript-migration.md` section 3).
 */
@Module({
  imports: [PersistenceModule, AuthModule, AuthenticationModule],
  controllers: [UsersController],
  providers: [
    {
      provide: UserService,
      useFactory: (
        users: UserRepository,
        passwordHasher: PasswordHasher,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) => new UserService(users, passwordHasher, unitOfWork, auditEvents, currentUser, clock),
      inject: [
        PORT_TOKENS.UserRepository,
        PORT_TOKENS.PasswordHasher,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
  exports: [UserService],
})
export class UsersModule {}
