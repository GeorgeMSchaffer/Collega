import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  RandomSource,
} from '@collega/application/common'
import type { OrganizationExistenceLookup, TagRepository } from '@collega/application/tags'
import { TagService } from '@collega/application/tags'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { TagsController } from './tags.controller.js'

/**
 * The tag surface: autocomplete, the catalog, and Settings → Tags' create, update and delete.
 *
 * `TagRepository` aliases onto `PrismaTagRepository`, the same adapter Ideas reaches through its
 * own narrower `TagsPort` and the AI features through `AiTagsPort`; `common/tokens.ts` explains
 * why one adapter answers to three tokens.
 *
 * `useFactory` rather than `@Injectable()`, as everywhere: `packages/application` may not import
 * `@nestjs/common` (`SPEC/50-typescript-migration.md` section 3).
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [TagsController],
  providers: [
    {
      provide: TagService,
      useFactory: (
        tags: TagRepository,
        organizations: OrganizationExistenceLookup,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
        random: RandomSource,
      ) => new TagService(tags, organizations, auditEvents, currentUser, clock, random),
      inject: [
        PORT_TOKENS.TagRepository,
        PORT_TOKENS.OrganizationExistenceLookup,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
        PORT_TOKENS.RandomSource,
      ],
    },
  ],
})
export class TagsModule {}
