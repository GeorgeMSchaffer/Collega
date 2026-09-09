import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type {
  BoardsPort,
  CommentsPort,
  IdeaClassificationPort,
  IdeaFieldValuesPort,
  IdeaRepository,
  NotificationsPort,
  TagsPort,
  UpvoteCountsPort,
  UsersPort,
} from '@collega/application/ideas'
import { IdeaService } from '@collega/application/ideas'
import { NotificationService } from '@collega/application/notifications'
import type { IdeaLookupPort, IdeaUpvoteRepository } from '@collega/application/upvotes'
import { UpvoteService } from '@collega/application/upvotes'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { IdeasController } from './ideas.controller.js'

/**
 * D3's idea surface: the eleven routes on `IdeasController`, spanning both services the .NET
 * controller reached through one interface.
 *
 * **The thirteen `IdeaService` dependencies, and where each comes from.** Twelve resolve straight
 * from `PORT_TOKENS` - `IdeaRepository`, `BoardsPort`, `UsersPort`, `TagsPort`, `CommentsPort`,
 * `IdeaClassificationPort`, `IdeaFieldValuesPort`, `UpvoteCountsPort`, and the four kernel ports
 * (`UnitOfWork`, `AuditEventWriter`, `CurrentUserContext`, `Clock`). Several of those are
 * cross-feature read ports rather than this feature's own repository, and several share one
 * concrete adapter: `BoardsPort` and `UpvoteCountsPort` alias onto `PrismaBoardRepository` and
 * `PrismaIdeaUpvoteRepository`, `UsersPort` onto `PrismaUserRepository`. None of that is decided
 * here - `common/persistence/adapters.providers.ts` owns it and `common/tokens.ts` explains why.
 *
 * The thirteenth is `NotificationsPort`, which is deliberately NOT a token: `common/tokens.ts`
 * says so by name, because it is satisfied by an Application-layer class built from ports that
 * are. `NotificationsModule` builds it; this module imports it and injects it by class reference,
 * the same way `UsersModule` imports `AuthenticationModule` for `AuthService`.
 *
 * `UpvoteService` is separate and takes six: `IdeaUpvoteRepository`, `IdeaLookupPort` (the narrow
 * "does this idea exist and whose org is it" slice of Ideas, aliased onto `IdeaLookupRepository`)
 * and the same four kernel ports. The .NET controller called `_ideaService.ToggleUpvoteAsync`, but
 * the conversion moved toggling into its own feature - so the route stays where the corpus
 * recorded it and only the service behind it changed.
 *
 * Both are constructed with `useFactory` rather than `@Injectable()` because
 * `packages/application` may not import `@nestjs/common` (`SPEC/50-typescript-migration.md`
 * section 3).
 */
@Module({
  imports: [PersistenceModule, AuthModule, NotificationsModule],
  controllers: [IdeasController],
  providers: [
    {
      provide: IdeaService,
      useFactory: (
        ideaRepository: IdeaRepository,
        boards: BoardsPort,
        users: UsersPort,
        tags: TagsPort,
        comments: CommentsPort,
        classification: IdeaClassificationPort,
        fieldValues: IdeaFieldValuesPort,
        upvoteCounts: UpvoteCountsPort,
        notifications: NotificationsPort,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new IdeaService(
          ideaRepository,
          boards,
          users,
          tags,
          comments,
          classification,
          fieldValues,
          upvoteCounts,
          notifications,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
        ),
      inject: [
        PORT_TOKENS.IdeaRepository,
        PORT_TOKENS.BoardsPort,
        PORT_TOKENS.UsersPort,
        PORT_TOKENS.TagsPort,
        PORT_TOKENS.CommentsPort,
        PORT_TOKENS.IdeaClassificationPort,
        PORT_TOKENS.IdeaFieldValuesPort,
        PORT_TOKENS.UpvoteCountsPort,
        NotificationService,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
    {
      provide: UpvoteService,
      useFactory: (
        upvoteRepository: IdeaUpvoteRepository,
        ideas: IdeaLookupPort,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) => new UpvoteService(upvoteRepository, ideas, unitOfWork, auditEvents, currentUser, clock),
      inject: [
        PORT_TOKENS.IdeaUpvoteRepository,
        PORT_TOKENS.IdeaLookupPort,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
})
export class IdeasModule {}
