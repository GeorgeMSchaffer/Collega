import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type {
  GroupMemberLookup,
  GroupRepository,
  OrganizationExistenceLookup,
} from '@collega/application/groups'
import { GroupService } from '@collega/application/groups'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { GroupsController } from './groups.controller.js'

/** Named sets of an organization's users, granted access to Restricted boards. */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [GroupsController],
  providers: [
    {
      provide: GroupService,
      useFactory: (
        groups: GroupRepository,
        users: GroupMemberLookup,
        organizations: OrganizationExistenceLookup,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new GroupService(groups, users, organizations, unitOfWork, auditEvents, currentUser, clock),
      inject: [
        PORT_TOKENS.GroupRepository,
        PORT_TOKENS.GroupMemberLookup,
        PORT_TOKENS.OrganizationExistenceLookup,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
  exports: [GroupService],
})
export class GroupsModule {}
