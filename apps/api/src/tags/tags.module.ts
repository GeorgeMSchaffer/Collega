import type { CurrentUserContext } from '@collega/application/common'
import type { TagRepository } from '@collega/application/tags'
import { TagService } from '@collega/application/tags'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { TagsController } from './tags.controller.js'

/**
 * D4's tag surface: the single autocomplete route.
 *
 * `TagService` is the smallest service in the app - `TagRepository` and `CurrentUserContext`, both
 * plain `PORT_TOKENS` entries. `TagRepository` aliases onto `PrismaTagRepository`, the same
 * adapter Ideas reaches through its own narrower `TagsPort` and the AI features through
 * `AiTagsPort`; `common/tokens.ts` explains why one adapter answers to three tokens.
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
      useFactory: (tags: TagRepository, currentUser: CurrentUserContext) =>
        new TagService(tags, currentUser),
      inject: [PORT_TOKENS.TagRepository, PORT_TOKENS.CurrentUserContext],
    },
  ],
})
export class TagsModule {}
