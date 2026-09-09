import type { CommentRepository, IdeaLookupPort, UsersPort } from '@collega/application/comments'
import { CommentService } from '@collega/application/comments'
import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import { NotificationService } from '@collega/application/notifications'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { CommentsController } from './comments.controller.js'

/**
 * D4's comment surface: the four routes on `CommentsController`.
 *
 * **The eight `CommentService` dependencies, and where each comes from.** Seven resolve straight
 * from `PORT_TOKENS` - `CommentRepository`, the two cross-feature read ports `IdeaLookupPort`
 * ("does this idea exist, and whose organization is it") and `UsersPort` (mention resolution by
 * normalized email), and the four kernel ports (`UnitOfWork`, `AuditEventWriter`,
 * `CurrentUserContext`, `Clock`). The two read ports share adapters with other features -
 * `IdeaLookupPort` aliases onto `IdeaLookupRepository`, the same one Upvotes uses, and `UsersPort`
 * onto `PrismaUserRepository`. None of that is decided here;
 * `common/persistence/adapters.providers.ts` owns it.
 *
 * The eighth is the `NotificationWriter`, which is deliberately NOT a token, for the reason
 * `common/tokens.ts` names: it is satisfied by an Application-layer class built from ports that
 * are, so no `PORT_ALIASES` entry could produce one. `NotificationsModule` builds it and this
 * module imports it, injecting `NotificationService` by class reference - exactly what D3 gave
 * that module a separate existence for. Constructing a second `NotificationService` here would
 * work and would be wrong: self-notification suppression is per-instance state's neighbour, and
 * two factories building one service is the duplication the module exists to prevent.
 *
 * Built with `useFactory` rather than `@Injectable()` because `packages/application` may not
 * import `@nestjs/common` (`SPEC/50-typescript-migration.md` section 3).
 */
@Module({
  imports: [PersistenceModule, AuthModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [
    {
      provide: CommentService,
      useFactory: (
        comments: CommentRepository,
        ideas: IdeaLookupPort,
        users: UsersPort,
        notifications: NotificationService,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new CommentService(
          comments,
          ideas,
          users,
          notifications,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
        ),
      inject: [
        PORT_TOKENS.CommentRepository,
        PORT_TOKENS.IdeaLookupPort,
        PORT_TOKENS.UsersPort,
        NotificationService,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
})
export class CommentsModule {}
