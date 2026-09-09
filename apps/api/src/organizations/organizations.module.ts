import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type {
  InviteCodeGenerator,
  OrganizationBootstrapPort,
  OrganizationRepository,
} from '@collega/application/organizations'
import { OrganizationService } from '@collega/application/organizations'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { UsersModule } from '../users/users.module.js'
import { OrganizationsController } from './organizations.controller.js'

/**
 * D1's organization surface, including the four user endpoints scoped by organization.
 *
 * `UsersModule` is imported for `UserService` rather than rebuilding it, for the same reason
 * `UsersModule` imports `AuthenticationModule` for `AuthService`: one factory per service, so
 * there is nothing to keep in step.
 */
@Module({
  imports: [PersistenceModule, AuthModule, UsersModule],
  controllers: [OrganizationsController],
  providers: [
    {
      provide: OrganizationService,
      useFactory: (
        organizations: OrganizationRepository,
        bootstrap: OrganizationBootstrapPort,
        inviteCodeGenerator: InviteCodeGenerator,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new OrganizationService(
          organizations,
          bootstrap,
          inviteCodeGenerator,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
        ),
      inject: [
        PORT_TOKENS.OrganizationRepository,
        PORT_TOKENS.OrganizationBootstrapPort,
        PORT_TOKENS.InviteCodeGenerator,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
})
export class OrganizationsModule {}
