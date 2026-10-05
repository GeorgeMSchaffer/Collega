import type { Clock, CurrentUserContext } from '@collega/application/common'
import type {
  NotificationEventRepository,
  NotificationInboxRepository,
  NotificationRecipientsPort,
} from '@collega/application/notifications'
import { NotificationInboxService, NotificationService } from '@collega/application/notifications'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { NotificationsController } from './notifications.controller.js'

/**
 * `NotificationService`, the writer other features' mutations call, and - since 2026-10-01 - the
 * inbox routes that read and mark the caller's own notifications (`NotificationsController`,
 * `NotificationInboxService`, SPEC/contracts/notifications.md).
 *
 * The writer is a module of its own, rather than a provider inlined into `IdeasModule`, because it
 * has several consumers: `IdeaService` takes it as its `NotificationsPort`, `CommentService` as its
 * `NotificationWriter` and `IssueTaskService` as its `IssueTaskNotificationsPort`, and the
 * alternative is several factories building the same service - the thing `UsersModule` importing
 * `AuthenticationModule` already exists to avoid.
 *
 * **This is the wiring `common/tokens.ts` says is NOT on the port-token list.** `NotificationsPort`
 * is satisfied by an Application-layer class, not by an infrastructure adapter, so no
 * `PORT_ALIASES` entry can produce one. It is built here from ports that ARE on the list:
 * `NotificationEventRepository` (the Prisma writer), `NotificationRecipientsPort` (the recipient's
 * account status) and `Clock`. Self-notification suppression and skipping a deactivated recipient
 * live inside the service, which is why consumers must depend on it rather than reaching for
 * `NotificationEventRepository` directly.
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: NotificationService,
      useFactory: (
        notifications: NotificationEventRepository,
        recipients: NotificationRecipientsPort,
        clock: Clock,
      ) => new NotificationService(notifications, recipients, clock),
      inject: [
        PORT_TOKENS.NotificationEventRepository,
        PORT_TOKENS.NotificationRecipientsPort,
        PORT_TOKENS.Clock,
      ],
    },
    {
      provide: NotificationInboxService,
      useFactory: (
        inbox: NotificationInboxRepository,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) => new NotificationInboxService(inbox, currentUser, clock),
      inject: [
        PORT_TOKENS.NotificationInboxRepository,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
