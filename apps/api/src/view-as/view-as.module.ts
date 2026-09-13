import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type {
  ImpersonationOrganizationsPort,
  ImpersonationSessionRepository,
  ImpersonationUsersPort,
} from '@collega/application/impersonation'
import { ViewAsService } from '@collega/application/impersonation'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { ViewAsController } from './view-as.controller.js'

/**
 * D7's View As surface: the three routes on `ViewAsController`.
 *
 * The other half of the feature is already wired and is deliberately NOT here.
 * `ImpersonationSessionResolver` - which turns an open session into the acting principal on every
 * authenticated request - is built in `common/persistence/adapters.providers.ts` and injected into
 * `TokenAuthenticationService`, because the auth guard needed it from D0 onward. This module adds
 * only the three endpoints that manage a session; the resolver is what makes every OTHER endpoint
 * behave as the target.
 *
 * `ViewAsService`'s seven dependencies all resolve straight from `PORT_TOKENS` - the three
 * impersonation ports plus the four kernel ones. `ImpersonationUsersPort` and
 * `ImpersonationOrganizationsPort` alias onto the same Prisma repositories other features reach
 * through wider ports; `common/tokens.ts` explains why one adapter answers to several tokens.
 *
 * `useFactory` rather than `@Injectable()`, as everywhere: `packages/application` may not import
 * `@nestjs/common` (`SPEC/50-typescript-migration.md` section 3).
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [ViewAsController],
  providers: [
    {
      provide: ViewAsService,
      useFactory: (
        sessions: ImpersonationSessionRepository,
        users: ImpersonationUsersPort,
        organizations: ImpersonationOrganizationsPort,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new ViewAsService(
          sessions,
          users,
          organizations,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
        ),
      inject: [
        PORT_TOKENS.ImpersonationSessionRepository,
        PORT_TOKENS.ImpersonationUsersPort,
        PORT_TOKENS.ImpersonationOrganizationsPort,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
})
export class ViewAsModule {}
