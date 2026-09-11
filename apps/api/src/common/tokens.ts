/**
 * Nest DI tokens for every port declared across `packages/application/src/*\/ports.ts` (plus the
 * kernel's `packages/application/src/common`), bound to a concrete adapter in
 * `apps/api/src/common/persistence/adapters.providers.ts`.
 *
 * WHY STRING TOKENS, NOT CLASS REFERENCES. Every port is a TypeScript `interface` - erased at
 * runtime, so there is no class Nest could use as a token. `packages/application` and
 * `packages/domain` may not import `@nestjs/common` (layer rule, SPEC/50-typescript-migration.md
 * section 3), so a port cannot carry its own token either. The token is therefore just the
 * interface's own name as a string, defined once here rather than repeated at every injection
 * site - a typo in a repeated string is a runtime "no provider" error Nest reports far from its
 * cause; a typo referencing this file is a compile error at the reference.
 *
 * ONE TOKEN PER DISTINCT PORT NAME, NOT PER FEATURE FOLDER. Several features declare their own
 * narrow copy of the same shape under the same name on purpose (`OrganizationExistenceLookup`
 * appears in boards/business-impacts/fields/idea-fields/statuses; `UsersPort` in ideas/comments;
 * `IdeaLookupPort` in comments/upvotes) - "each feature declares the exact shape it needs" per
 * those files' own comments, satisfied in every case by the SAME concrete adapter Wave C1 wrote.
 * One provider under one shared token serves every one of them; nothing here special-cases which
 * feature is asking.
 *
 * NOT ON THIS LIST: `NotificationsPort` (ideas' local shape) and `AiUsageGate`. Both are
 * satisfied by an APPLICATION-layer class - `NotificationService` and `AiUsageService`
 * respectively - built from ports that ARE on this list (`NotificationEventRepository`, `Clock`;
 * `AiUsageRepository` and configuration), not by an infrastructure adapter. Wiring those two
 * belongs to whichever feature module first needs them, not to this host slice - see the D0
 * slice report for the reasoning.
 */
export const PORT_TOKENS = {
  // Kernel (packages/application/src/common) ----------------------------------------------------
  Clock: 'Clock',
  UnitOfWork: 'UnitOfWork',
  AuditEventWriter: 'AuditEventWriter',
  CurrentUserContext: 'CurrentUserContext',

  // Auth (packages/application/src/auth/ports.ts) ------------------------------------------------
  PasswordHasher: 'PasswordHasher',
  AccessTokenIssuer: 'AccessTokenIssuer',
  AccessTokenValidator: 'AccessTokenValidator',
  ImageProcessor: 'ImageProcessor',
  ImpersonationResolver: 'ImpersonationResolver',

  // AI (packages/application/src/ai/ports.ts) ---------------------------------------------------
  AiPromptVersionRepository: 'AiPromptVersionRepository',
  AiUsageRepository: 'AiUsageRepository',
  IdeaDraftModel: 'IdeaDraftModel',
  AiOrganizationRepository: 'AiOrganizationRepository',
  AiIdeaTypesPort: 'AiIdeaTypesPort',
  AiBusinessImpactsPort: 'AiBusinessImpactsPort',
  AiStatusesPort: 'AiStatusesPort',
  AiTagsPort: 'AiTagsPort',
  AiMembersPort: 'AiMembersPort',
  AiBoardLookupPort: 'AiBoardLookupPort',
  AiUsersPort: 'AiUsersPort',

  // Boards (packages/application/src/boards/ports.ts) --------------------------------------------
  BoardRepository: 'BoardRepository',
  OrganizationExistenceLookup: 'OrganizationExistenceLookup',

  // Business impacts (packages/application/src/business-impacts/ports.ts) -----------------------
  BusinessImpactRepository: 'BusinessImpactRepository',

  // Comments (packages/application/src/comments/ports.ts) ----------------------------------------
  CommentRepository: 'CommentRepository',
  IdeaLookupPort: 'IdeaLookupPort',
  UsersPort: 'UsersPort',

  // Fields (packages/application/src/fields/ports.ts) --------------------------------------------
  FieldDefinitionRepository: 'FieldDefinitionRepository',

  // Idea Fields (packages/application/src/idea-fields/ports.ts) ----------------------------------
  IdeaTypeRepository: 'IdeaTypeRepository',

  // Ideas (packages/application/src/ideas/ports.ts) -----------------------------------------------
  IdeaRepository: 'IdeaRepository',
  UpvoteCountsPort: 'UpvoteCountsPort',
  BoardsPort: 'BoardsPort',
  TagsPort: 'TagsPort',
  CommentsPort: 'CommentsPort',
  IdeaClassificationPort: 'IdeaClassificationPort',
  IdeaFieldValuesPort: 'IdeaFieldValuesPort',
  SprintLookupPort: 'SprintLookupPort',
  IssueTaskRollupPort: 'IssueTaskRollupPort',

  // Sprints (packages/application/src/sprints/ports.ts) ------------------------------------------
  SprintRepository: 'SprintRepository',
  SprintIssuesPort: 'SprintIssuesPort',
  SprintUsersPort: 'SprintUsersPort',

  // Issue tasks (packages/application/src/issue-tasks/ports.ts) ----------------------------------
  IssueTaskRepository: 'IssueTaskRepository',
  IssueTaskIdeaPort: 'IssueTaskIdeaPort',
  IssueTaskUsersPort: 'IssueTaskUsersPort',

  // Notifications (packages/application/src/notifications/ports.ts) ------------------------------
  NotificationEventRepository: 'NotificationEventRepository',

  // Organizations (packages/application/src/organizations/ports.ts) ------------------------------
  OrganizationRepository: 'OrganizationRepository',
  InviteCodeGenerator: 'InviteCodeGenerator',
  OrganizationBootstrapPort: 'OrganizationBootstrapPort',

  // Impersonation (packages/application/src/impersonation/ports.ts) ------------------------------
  ImpersonationSessionRepository: 'ImpersonationSessionRepository',
  ImpersonationUsersPort: 'ImpersonationUsersPort',
  ImpersonationOrganizationsPort: 'ImpersonationOrganizationsPort',

  // Statuses (packages/application/src/statuses/ports.ts) -----------------------------------------
  StatusRepository: 'StatusRepository',

  // Tags (packages/application/src/tags/ports.ts) --------------------------------------------------
  TagRepository: 'TagRepository',

  // Upvotes (packages/application/src/upvotes/ports.ts) --------------------------------------------
  IdeaUpvoteRepository: 'IdeaUpvoteRepository',

  // Users (packages/application/src/users/ports.ts) ------------------------------------------------
  UserRepository: 'UserRepository',

  // apps/api's own auth wiring - not a packages/application port, but every feature module that
  // needs to authenticate a token (there should only ever be one: the auth guard) asks for it
  // the same way it asks for anything else.
  TokenAuthenticationService: 'TokenAuthenticationService',

  /**
   * `@collega/infrastructure/persistence` exports `PrismaClient` as a TYPE ONLY
   * (`export type { PrismaClient }` in `prisma-client.ts` - the file's own header explains why:
   * lifecycle belongs to whoever wires DI, not to the package). There is no class value to use
   * as a token, so - exactly like every port above - a string token stands in for it.
   */
  PrismaClient: 'PrismaClient',
} as const
