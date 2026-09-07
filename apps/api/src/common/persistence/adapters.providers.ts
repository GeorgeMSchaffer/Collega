import { randomBytes } from 'node:crypto'
import type { Provider } from '@nestjs/common'
import type { ImpersonationResolver } from '@collega/application/auth'
import { TokenAuthenticationService } from '@collega/application/auth'
import { systemClock } from '@collega/application/common'
import { ImpersonationSessionResolver } from '@collega/application/impersonation'
import { AnthropicIdeaDraftModel } from '@collega/infrastructure/integrations/ai'
import { SharpImageProcessor } from '@collega/infrastructure/integrations/image-processing'
import { RandomInviteCodeGenerator } from '@collega/infrastructure/integrations/organizations'
import type { PrismaClient } from '@collega/infrastructure/persistence'
import {
  IdeaClassificationRepository,
  IdeaCommentsLookupRepository,
  IdeaLookupRepository,
  OrganizationBootstrapRepository,
  OrganizationExistenceLookupRepository,
  PrismaAiPromptVersionRepository,
  PrismaAiUsageRepository,
  PrismaAuditEventWriter,
  PrismaBoardRepository,
  PrismaBusinessImpactRepository,
  PrismaCommentRepository,
  PrismaFieldDefinitionRepository,
  PrismaIdeaFieldValuesRepository,
  PrismaIdeaRepository,
  PrismaIdeaTypeRepository,
  PrismaIdeaUpvoteRepository,
  PrismaImpersonationSessionRepository,
  PrismaNotificationEventRepository,
  PrismaOrganizationRepository,
  PrismaStatusRepository,
  PrismaTagRepository,
  PrismaUserRepository,
} from '@collega/infrastructure/repositories'
import { JwtAccessTokenService, Pbkdf2PasswordHasher } from '@collega/infrastructure/security'
import { CONFIG } from '../config/config.module.js'
import type { Config } from '../config/index.js'
import { PORT_TOKENS } from '../tokens.js'
import { AlsUnitOfWork } from './als-unit-of-work.js'

// The 22 concrete adapters, one provider each, keyed by class reference. Port tokens below alias
// onto these - see ../tokens.ts for why aliasing rather than one provider per port.

const CONCRETE_ADAPTERS: Provider[] = [
  {
    provide: PrismaAiPromptVersionRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) =>
      new PrismaAiPromptVersionRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    provide: PrismaAiUsageRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) =>
      new PrismaAiUsageRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    // Commits outside the unit-of-work buffer, matching the .NET original - see
    // packages/infrastructure/src/persistence/unit-of-work.ts's header. No `uow` argument.
    provide: PrismaAuditEventWriter,
    useFactory: (prisma: PrismaClient) => new PrismaAuditEventWriter(prisma),
    inject: [PORT_TOKENS.PrismaClient],
  },
  {
    provide: PrismaBoardRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) => new PrismaBoardRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    provide: PrismaBusinessImpactRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) =>
      new PrismaBusinessImpactRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    provide: PrismaCommentRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) =>
      new PrismaCommentRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    provide: IdeaCommentsLookupRepository,
    useFactory: (prisma: PrismaClient) => new IdeaCommentsLookupRepository(prisma),
    inject: [PORT_TOKENS.PrismaClient],
  },
  {
    provide: PrismaFieldDefinitionRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) =>
      new PrismaFieldDefinitionRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    provide: IdeaClassificationRepository,
    useFactory: (prisma: PrismaClient) => new IdeaClassificationRepository(prisma),
    inject: [PORT_TOKENS.PrismaClient],
  },
  {
    // Prisma-only, deliberately: unlike its siblings, resolveAndValidate/describeForDetail/etc.
    // are all reads or pure translation - packages/infrastructure/src/repositories/idea-field-
    // values.repository.ts takes no PrismaUnitOfWork at all.
    provide: PrismaIdeaFieldValuesRepository,
    useFactory: (prisma: PrismaClient) => new PrismaIdeaFieldValuesRepository(prisma),
    inject: [PORT_TOKENS.PrismaClient],
  },
  {
    provide: IdeaLookupRepository,
    useFactory: (prisma: PrismaClient) => new IdeaLookupRepository(prisma),
    inject: [PORT_TOKENS.PrismaClient],
  },
  {
    provide: PrismaIdeaTypeRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) =>
      new PrismaIdeaTypeRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    provide: PrismaIdeaUpvoteRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) =>
      new PrismaIdeaUpvoteRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    provide: PrismaIdeaRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) => new PrismaIdeaRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    provide: PrismaImpersonationSessionRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) =>
      new PrismaImpersonationSessionRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    provide: PrismaNotificationEventRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) =>
      new PrismaNotificationEventRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    provide: OrganizationExistenceLookupRepository,
    useFactory: (prisma: PrismaClient) => new OrganizationExistenceLookupRepository(prisma),
    inject: [PORT_TOKENS.PrismaClient],
  },
  {
    provide: PrismaOrganizationRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) =>
      new PrismaOrganizationRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    provide: PrismaStatusRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) =>
      new PrismaStatusRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    // No `uow`: tag.repository.ts's getOrCreate owns its own commit-and-retry so a CSV import
    // naming one new tag across many rows converges on one row - see unit-of-work.ts's header.
    provide: PrismaTagRepository,
    useFactory: (prisma: PrismaClient) => new PrismaTagRepository(prisma),
    inject: [PORT_TOKENS.PrismaClient],
  },
  {
    provide: PrismaUserRepository,
    useFactory: (prisma: PrismaClient, uow: AlsUnitOfWork) => new PrismaUserRepository(prisma, uow),
    inject: [PORT_TOKENS.PrismaClient, AlsUnitOfWork],
  },
  {
    // Composes four sibling repositories rather than Prisma directly.
    provide: OrganizationBootstrapRepository,
    useFactory: (
      statuses: PrismaStatusRepository,
      boards: PrismaBoardRepository,
      ideaTypes: PrismaIdeaTypeRepository,
      businessImpacts: PrismaBusinessImpactRepository,
    ) => new OrganizationBootstrapRepository(statuses, boards, ideaTypes, businessImpacts),
    inject: [
      PrismaStatusRepository,
      PrismaBoardRepository,
      PrismaIdeaTypeRepository,
      PrismaBusinessImpactRepository,
    ],
  },
  { provide: Pbkdf2PasswordHasher, useFactory: () => new Pbkdf2PasswordHasher() },
  {
    provide: JwtAccessTokenService,
    useFactory: (config: Config) =>
      new JwtAccessTokenService({
        // A random per-process fallback, exactly like .NET's Auth:TokenSigningKey - fine for one
        // local instance, wrong for more than one. See ../config/fragments/auth.ts.
        signingKey: config.auth.tokenSigningKey ?? randomBytes(32).toString('base64'),
        lifetimeSeconds: config.auth.accessTokenLifetimeSeconds,
      }),
    inject: [CONFIG],
  },
  { provide: SharpImageProcessor, useFactory: () => new SharpImageProcessor() },
  { provide: RandomInviteCodeGenerator, useFactory: () => new RandomInviteCodeGenerator() },
  {
    provide: AnthropicIdeaDraftModel,
    useFactory: (config: Config) =>
      new AnthropicIdeaDraftModel({
        apiKey: config.ai.anthropicApiKey,
        // Decided settings (SPEC/20-feature-ai-idea-assist.md rules 28a-28e), not
        // environment-configurable - matches .NET's `AiUsageLimits` code defaults.
        model: 'claude-sonnet-5',
        effort: 'low',
      }),
    inject: [CONFIG],
  },
  {
    // Application-layer, not infrastructure - constructed here because the auth guard (this
    // slice) is the only current consumer of `TokenAuthenticationService`, which needs it.
    provide: ImpersonationSessionResolver,
    useFactory: (
      sessions: PrismaImpersonationSessionRepository,
      users: PrismaUserRepository,
      organizations: PrismaOrganizationRepository,
      uow: AlsUnitOfWork,
    ) => new ImpersonationSessionResolver(sessions, users, organizations, uow),
    inject: [
      PrismaImpersonationSessionRepository,
      PrismaUserRepository,
      PrismaOrganizationRepository,
      AlsUnitOfWork,
    ],
  },
  {
    provide: TokenAuthenticationService,
    useFactory: (
      tokenValidator: JwtAccessTokenService,
      users: PrismaUserRepository,
      impersonation: ImpersonationResolver,
    ) => new TokenAuthenticationService(tokenValidator, users, impersonation, systemClock),
    inject: [JwtAccessTokenService, PrismaUserRepository, ImpersonationSessionResolver],
  },
]

/** Port token -> the concrete adapter that satisfies it. Many ports share one adapter - see
 * ../tokens.ts's header for why that is intentional, not a shortcut. */
const PORT_ALIASES: Provider[] = [
  { provide: PORT_TOKENS.AuditEventWriter, useExisting: PrismaAuditEventWriter },

  { provide: PORT_TOKENS.PasswordHasher, useExisting: Pbkdf2PasswordHasher },
  { provide: PORT_TOKENS.AccessTokenIssuer, useExisting: JwtAccessTokenService },
  { provide: PORT_TOKENS.AccessTokenValidator, useExisting: JwtAccessTokenService },
  { provide: PORT_TOKENS.ImageProcessor, useExisting: SharpImageProcessor },
  { provide: PORT_TOKENS.ImpersonationResolver, useExisting: ImpersonationSessionResolver },

  { provide: PORT_TOKENS.AiPromptVersionRepository, useExisting: PrismaAiPromptVersionRepository },
  { provide: PORT_TOKENS.AiUsageRepository, useExisting: PrismaAiUsageRepository },
  { provide: PORT_TOKENS.IdeaDraftModel, useExisting: AnthropicIdeaDraftModel },
  { provide: PORT_TOKENS.AiOrganizationRepository, useExisting: PrismaOrganizationRepository },
  { provide: PORT_TOKENS.AiIdeaTypesPort, useExisting: PrismaIdeaFieldValuesRepository },
  { provide: PORT_TOKENS.AiBusinessImpactsPort, useExisting: PrismaBusinessImpactRepository },
  { provide: PORT_TOKENS.AiStatusesPort, useExisting: PrismaStatusRepository },
  { provide: PORT_TOKENS.AiTagsPort, useExisting: PrismaTagRepository },
  { provide: PORT_TOKENS.AiMembersPort, useExisting: PrismaUserRepository },
  { provide: PORT_TOKENS.AiBoardLookupPort, useExisting: PrismaBoardRepository },
  { provide: PORT_TOKENS.AiUsersPort, useExisting: PrismaUserRepository },

  { provide: PORT_TOKENS.BoardRepository, useExisting: PrismaBoardRepository },
  { provide: PORT_TOKENS.OrganizationExistenceLookup, useExisting: OrganizationExistenceLookupRepository },

  { provide: PORT_TOKENS.BusinessImpactRepository, useExisting: PrismaBusinessImpactRepository },

  { provide: PORT_TOKENS.CommentRepository, useExisting: PrismaCommentRepository },
  { provide: PORT_TOKENS.IdeaLookupPort, useExisting: IdeaLookupRepository },
  { provide: PORT_TOKENS.UsersPort, useExisting: PrismaUserRepository },

  { provide: PORT_TOKENS.FieldDefinitionRepository, useExisting: PrismaFieldDefinitionRepository },

  { provide: PORT_TOKENS.IdeaTypeRepository, useExisting: PrismaIdeaTypeRepository },

  { provide: PORT_TOKENS.IdeaRepository, useExisting: PrismaIdeaRepository },
  { provide: PORT_TOKENS.UpvoteCountsPort, useExisting: PrismaIdeaUpvoteRepository },
  { provide: PORT_TOKENS.BoardsPort, useExisting: PrismaBoardRepository },
  { provide: PORT_TOKENS.TagsPort, useExisting: PrismaTagRepository },
  { provide: PORT_TOKENS.CommentsPort, useExisting: IdeaCommentsLookupRepository },
  { provide: PORT_TOKENS.IdeaClassificationPort, useExisting: IdeaClassificationRepository },
  { provide: PORT_TOKENS.IdeaFieldValuesPort, useExisting: PrismaIdeaFieldValuesRepository },

  { provide: PORT_TOKENS.NotificationEventRepository, useExisting: PrismaNotificationEventRepository },

  { provide: PORT_TOKENS.OrganizationRepository, useExisting: PrismaOrganizationRepository },
  { provide: PORT_TOKENS.InviteCodeGenerator, useExisting: RandomInviteCodeGenerator },
  { provide: PORT_TOKENS.OrganizationBootstrapPort, useExisting: OrganizationBootstrapRepository },

  { provide: PORT_TOKENS.ImpersonationSessionRepository, useExisting: PrismaImpersonationSessionRepository },
  { provide: PORT_TOKENS.ImpersonationUsersPort, useExisting: PrismaUserRepository },
  { provide: PORT_TOKENS.ImpersonationOrganizationsPort, useExisting: PrismaOrganizationRepository },

  { provide: PORT_TOKENS.StatusRepository, useExisting: PrismaStatusRepository },

  { provide: PORT_TOKENS.TagRepository, useExisting: PrismaTagRepository },

  { provide: PORT_TOKENS.IdeaUpvoteRepository, useExisting: PrismaIdeaUpvoteRepository },

  { provide: PORT_TOKENS.UserRepository, useExisting: PrismaUserRepository },

  { provide: PORT_TOKENS.TokenAuthenticationService, useExisting: TokenAuthenticationService },
]

export const ADAPTER_PROVIDERS: Provider[] = [...CONCRETE_ADAPTERS, ...PORT_ALIASES]
