import type { Clock, CurrentUserContext, UnitOfWork } from '@collega/application/common'
import type {
  IssueTaskIdeaPort,
  IssueTaskNotificationsPort,
  IssueTaskRepository,
  IssueTaskUsersPort,
} from '@collega/application/issue-tasks'
import { IssueTaskService } from '@collega/application/issue-tasks'
import { NotificationService } from '@collega/application/notifications'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { IssueTasksController } from './issue-tasks.controller.js'

/**
 * The six task routes.
 *
 * Three of `IssueTaskService`'s dependencies resolve from `PORT_TOKENS` - `IssueTaskRepository`,
 * plus `IssueTaskIdeaPort` and `IssueTaskUsersPort`, which are the narrow "resolve the parent
 * Issue" and "is this assignee active in the org" slices of `PrismaIdeaRepository` and
 * `PrismaUserRepository`. The fourth is `IssueTaskNotificationsPort`, satisfied by
 * `NotificationService` and therefore injected by class reference, exactly as `IdeasModule` takes
 * its `NotificationsPort`: `common/tokens.ts` records why that one is not a token.
 *
 * `AuditEventWriter` is deliberately absent, and that is the feature's one asymmetry rather than an
 * omission: task mutations are NOT audited (spec "Audit & Notifications"), because a checklist
 * ticked a dozen times a day would drown the log that exists to answer "who committed us to this
 * work". `completedAtUtc`/`completedByUserId` on the row carry the only record that matters.
 */
@Module({
  imports: [PersistenceModule, AuthModule, NotificationsModule],
  controllers: [IssueTasksController],
  providers: [
    {
      provide: IssueTaskService,
      useFactory: (
        tasks: IssueTaskRepository,
        ideas: IssueTaskIdeaPort,
        users: IssueTaskUsersPort,
        notifications: IssueTaskNotificationsPort,
        unitOfWork: UnitOfWork,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) => new IssueTaskService(tasks, ideas, users, notifications, unitOfWork, currentUser, clock),
      inject: [
        PORT_TOKENS.IssueTaskRepository,
        PORT_TOKENS.IssueTaskIdeaPort,
        PORT_TOKENS.IssueTaskUsersPort,
        NotificationService,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
})
export class IssueTasksModule {}
