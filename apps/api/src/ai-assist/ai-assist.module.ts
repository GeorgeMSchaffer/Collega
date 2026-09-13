import type {
  AiBoardLookupPort,
  AiBusinessImpactsPort,
  AiIdeaTypesPort,
  AiMembersPort,
  AiOrganizationRepository,
  AiPromptVersionRepository,
  AiStatusesPort,
  AiTagsPort,
  AiUsageGate,
  AiUsageRepository,
  AiUsersPort,
  IdeaDraftModel,
} from '@collega/application/ai'
import {
  AiPromptService,
  AiUsageService,
  DEFAULT_AI_USAGE_LIMITS,
  IdeaAssistContextBuilder,
  IdeaAssistService,
} from '@collega/application/ai'
import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { AiPromptController } from './ai-prompt.controller.js'
import { AiUsageController } from './ai-usage.controller.js'
import { IdeaAssistController } from './idea-assist.controller.js'

/**
 * D6's AI assist surface: eleven routes across three controllers - drafting and settings
 * (`IdeaAssistController`), the Site-Admin prompt (`AiPromptController`), and the usage meter
 * (`AiUsageController`).
 *
 * **`AiUsageGate` is deliberately not a `PORT_TOKENS` entry**, and this is the module
 * `common/tokens.ts` names as its owner: it is satisfied by an APPLICATION-layer class,
 * `AiUsageService`, built from ports that ARE tokens (`AiUsageRepository` plus the kernel's), not
 * by an infrastructure adapter. It is registered once here under its own class reference and
 * injected into both services that need it, so the daily ceiling and the rate-limit window are one
 * shared counter rather than two.
 *
 * `AiUsageLimits` comes from `DEFAULT_AI_USAGE_LIMITS` rather than the environment, matching how
 * `adapters.providers.ts` already pins the model and effort for `AnthropicIdeaDraftModel`: these
 * are decided settings (`SPEC/20-feature-ai-idea-assist.md` rules 28a-28e), and the one thing that
 * IS environment-read - `ANTHROPIC_API_KEY` - is read by the config fragment, whose absence is a
 * supported state rather than a boot failure.
 *
 * `IdeaAssistContextBuilder` is likewise an Application class assembled from seven read ports, not
 * an adapter; it is the retrieval half of a turn and has no reason to be reachable elsewhere.
 *
 * Everything is built with `useFactory` rather than `@Injectable()` because
 * `packages/application` may not import `@nestjs/common` (`SPEC/50-typescript-migration.md`
 * section 3).
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [IdeaAssistController, AiPromptController, AiUsageController],
  providers: [
    {
      provide: AiUsageService,
      useFactory: (
        usageRepository: AiUsageRepository,
        unitOfWork: UnitOfWork,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new AiUsageService(
          usageRepository,
          unitOfWork,
          currentUser,
          clock,
          DEFAULT_AI_USAGE_LIMITS,
        ),
      inject: [
        PORT_TOKENS.AiUsageRepository,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
    {
      provide: IdeaAssistContextBuilder,
      useFactory: (
        organizations: AiOrganizationRepository,
        ideaTypes: AiIdeaTypesPort,
        businessImpacts: AiBusinessImpactsPort,
        statuses: AiStatusesPort,
        tags: AiTagsPort,
        members: AiMembersPort,
        prompts: AiPromptVersionRepository,
      ) =>
        new IdeaAssistContextBuilder(
          organizations,
          ideaTypes,
          businessImpacts,
          statuses,
          tags,
          members,
          prompts,
        ),
      inject: [
        PORT_TOKENS.AiOrganizationRepository,
        PORT_TOKENS.AiIdeaTypesPort,
        PORT_TOKENS.AiBusinessImpactsPort,
        PORT_TOKENS.AiStatusesPort,
        PORT_TOKENS.AiTagsPort,
        PORT_TOKENS.AiMembersPort,
        PORT_TOKENS.AiPromptVersionRepository,
      ],
    },
    {
      provide: IdeaAssistService,
      useFactory: (
        model: IdeaDraftModel,
        contextBuilder: IdeaAssistContextBuilder,
        boards: AiBoardLookupPort,
        organizations: AiOrganizationRepository,
        usage: AiUsageGate,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new IdeaAssistService(
          model,
          contextBuilder,
          boards,
          organizations,
          usage,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
        ),
      inject: [
        PORT_TOKENS.IdeaDraftModel,
        IdeaAssistContextBuilder,
        PORT_TOKENS.AiBoardLookupPort,
        PORT_TOKENS.AiOrganizationRepository,
        AiUsageService,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
    {
      provide: AiPromptService,
      useFactory: (
        versions: AiPromptVersionRepository,
        model: IdeaDraftModel,
        usage: AiUsageGate,
        users: AiUsersPort,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new AiPromptService(
          versions,
          model,
          usage,
          users,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
        ),
      inject: [
        PORT_TOKENS.AiPromptVersionRepository,
        PORT_TOKENS.IdeaDraftModel,
        AiUsageService,
        PORT_TOKENS.AiUsersPort,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
})
export class AiAssistModule {}
