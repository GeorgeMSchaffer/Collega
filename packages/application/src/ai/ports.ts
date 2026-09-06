import type { AiPromptVersion, AiUsageRecord } from '@collega/domain/ai'
import type { AiCallOutcome } from '@collega/domain/enums'
import type { Organization } from '@collega/domain/organizations'
import type {
  AiCallCounts,
  AiUsageSummary,
  IdeaAssistContext,
  IdeaAssistTurn,
  IdeaDraft,
  IdeaDraftModelResponse,
  RecordAiUsageInput,
} from './models.js'

// Prompt version persistence -------------------------------------------------------------------

/**
 * Reads and writes published versions of the idea-assist prompt (SPEC/20-feature-ai-idea-assist.md
 * rules 34-36). Not organization-scoped, unlike every other repository here: the prompt is one
 * deployment-wide setting, the same scope as the API key (rule 29).
 */
export interface AiPromptVersionRepository {
  /** The version currently in force, or null when none is - in which case callers fall back to
   * the built-in default. Null is the normal initial state, not a missing row. */
  getActive(): Promise<AiPromptVersion | null>

  /** Every version, newest first. */
  list(): Promise<readonly AiPromptVersion[]>

  getByVersion(version: number): Promise<AiPromptVersion | null>

  /** The highest version number issued so far, or 0 when the table is empty. */
  getMaxVersion(): Promise<number>

  /**
   * Adds a new version. `ai_prompt_versions` carries a PARTIAL UNIQUE INDEX on `is_active` WHERE
   * `is_active` (`ux_ai_prompt_versions_active`) - "at most one active version" is a database
   * guarantee, not merely the application's `deactivateAll()`-then-`add()` sequence.
   *
   * The implementation MUST translate a violation of that index into the kernel's
   * `ConflictError` rather than letting a raw persistence error escape, so two concurrent
   * publishes resolve as one success and one 409, never a 500 and never two silently-both-active
   * rows. `AiPromptService` does not (and structurally cannot, since it holds no Prisma/SQL
   * knowledge) catch a driver-specific unique-violation error itself - the obligation lives at
   * this seam, exactly like `IdeaFieldValuesPort.resolveAndValidate` is contracted to throw the
   * kernel's `ValidationError`.
   */
  add(version: AiPromptVersion): Promise<void>

  /** Stands down every active row. Called before publishing, and on its own when resetting to
   * the built-in default - which is why it is a separate operation rather than folded into a
   * publish. */
  deactivateAll(): Promise<void>
}

// Usage meter persistence ------------------------------------------------------------------------

/** Reads and writes the AI consumption meter (SPEC/20-feature-ai-idea-assist.md rules 28a-28d). */
export interface AiUsageRepository {
  /** Records one model call's consumption. */
  add(record: AiUsageRecord): Promise<void>

  /** Total tokens consumed across EVERY organization at or after `fromUtc` - the number the
   * daily budget gate compares against. Deliberately not org-scoped: the ceiling is one shared
   * pool. */
  getTotalTokensSince(fromUtc: Date): Promise<number>

  /** Per-organization totals over a window, ordered by consumption descending. Aggregated in the
   * database rather than by materializing rows. */
  getUsageByOrganization(
    fromUtc: Date,
    toUtc: Date,
    organizationId?: string | null,
  ): Promise<readonly AiUsageSummary[]>

  /**
   * Call counts in the rate-limit window (rule 26) - the organization's total and, within it,
   * the given actor's. `actorUserId` is the REAL caller: during a View As session that is the
   * administrator, not the impersonated user - otherwise an administrator could reset their own
   * allowance by switching who they are acting as.
   */
  countCallsSince(
    organizationId: string,
    actorUserId: string | null,
    fromUtc: Date,
  ): Promise<AiCallCounts>

  /**
   * The most recent call outcomes for one actor on one board, newest first. Exists because the
   * three-strikes close of rule 10 must not be computed from the transcript the client sends -
   * the client owns that transcript and drops its own refusals by design, so a caller probing
   * the boundary could simply omit the evidence and never be cut off. These rows are written by
   * the server for every turn and cannot be edited by the caller.
   */
  getRecentOutcomes(
    organizationId: string,
    actorUserId: string | null,
    boardId: string,
    limit: number,
    fromUtc: Date,
  ): Promise<readonly AiCallOutcome[]>
}

// The AI cost-control gate ------------------------------------------------------------------------
//
// Declared as a port - not just consumed as the concrete `AiUsageService` class - for the same
// reason `IIdeaDraftModel` is a port in .NET: `AiPromptService` and `IdeaAssistService` must be
// unit-testable with a fake budget/rate-limit/meter, never a real one, and `AiUsageService` uses
// `#private` fields, which TypeScript's structural typing would otherwise force a test double to
// literally extend rather than merely resemble.

export interface AiUsageGate {
  /** Whether another model call is allowed under today's ceiling. Check BEFORE calling the
   * provider - a gate consulted afterwards has already spent the money it was meant to save. */
  isWithinDailyBudget(): Promise<boolean>

  /** Enforces the per-user and per-organization request limits (rule 26). Also check BEFORE
   * calling the provider, for the same reason.
   * @throws {RateLimitedError} either limit is exhausted for the current window. */
  enforceRateLimit(organizationId: string): Promise<void>

  /** Meters one model call, including refused and failed turns - they consumed tokens too, and a
   * meter that counted only successes would not bound spend. */
  recordUsage(input: RecordAiUsageInput): Promise<void>

  /** Recent outcomes for the current actor on one board, newest first - server-side truth about
   * how a conversation has gone, for callers that must not trust the client's transcript. */
  getRecentOutcomes(
    organizationId: string,
    boardId: string,
    limit: number,
    fromUtc: Date,
  ): Promise<readonly AiCallOutcome[]>
}

// Model provider -----------------------------------------------------------------------------

/** A model call that could not produce a usable answer. Carries no provider detail worth
 * showing a user - the degradation path is the same whatever went wrong. */
export class IdeaDraftModelError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'IdeaDraftModelError'
  }
}

/**
 * The seam between idea drafting and whichever model provider backs it (SPEC/20-feature-
 * ai-idea-assist.md "Model Configuration"). Implemented in Infrastructure (Wave C2) so no vendor
 * SDK type ever appears in Application or Domain, and so a test can substitute a fake here
 * instead of ever constructing a real provider client (spec item 5).
 */
export interface IdeaDraftModel {
  /** Whether a credential is configured. False is a SUPPORTED STATE, not an error: the product
   * must work with the feature dark (rule 31), so callers answer 503 and the client falls back
   * to the scripted brainstorm rather than surfacing a failure. */
  readonly isConfigured: boolean

  /**
   * Advances the conversation by one turn.
   *
   * The implementation builds the response schema's closed enums from `context`, which is what
   * makes an out-of-org classification structurally impossible rather than merely discouraged
   * (rule 16). The returned draft is UNTRUSTED - the caller re-validates every id against
   * `context` before any of it reaches a client.
   *
   * @throws {IdeaDraftModelError} the provider failed, timed out, or returned something unusable.
   * Callers degrade for that turn rather than propagating an error (rule 32).
   */
  continueTurn(
    context: IdeaAssistContext,
    transcript: readonly IdeaAssistTurn[],
    currentDraft: IdeaDraft,
  ): Promise<IdeaDraftModelResponse>
}

// Cross-feature read ports for retrieval (rules 11-12) -------------------------------------------
//
// Declared locally rather than importing another feature partition's port types, matching the
// convention `packages/application/src/ideas/ports.ts` set for Boards/Users/Tags/etc: each
// feature folder stays independently reachable per the subpath-export convention, and Wave C can
// satisfy several of these narrow ports from the same concrete repository that already
// implements a wider one owned by another partition.

/**
 * Organization lookup/update for the scope statement (rule 6) and retrieval (rules 11-12). The
 * full domain `Organization` is used - imported from `@collega/domain/organizations`, which is
 * shared, unlike another feature's own `ports.ts` - rather than a narrower projection, because
 * `setOrganizationAiScopeStatement` needs the whole entity to construct the updated one.
 */
export interface AiOrganizationRepository {
  getById(organizationId: string): Promise<Organization | null>
  /** Persists changes to an organization already loaded - the domain function returns a new
   * immutable value rather than mutating in place, so update is its own call. */
  update(organization: Organization): Promise<void>
}

export type AiIdeaTypeOption = {
  readonly id: string
  readonly name: string
  /** This type's resolved field set (`IdeaTypeFieldResolver`, B5-owned), included as context for
   * question-asking only - v1 never fills those values (rule 21). */
  readonly fieldNames: readonly string[]
}

export interface AiIdeaTypesPort {
  /** Active idea types for the organization, in canonical display order, each with its resolved
   * field set already computed - delegating that complexity to the implementation exactly as
   * `IdeaFieldValuesPort` does for idea create/update, rather than re-deriving
   * `IdeaTypeFieldResolver` here. */
  listActiveWithFieldNames(organizationId: string): Promise<readonly AiIdeaTypeOption[]>
}

export type AiBusinessImpactOption = {
  readonly id: string
  readonly name: string
}

export interface AiBusinessImpactsPort {
  /** Active business impacts for the organization, in canonical display order. */
  listActive(organizationId: string): Promise<readonly AiBusinessImpactOption[]>
}

export interface AiStatusesPort {
  /** Active status names for the organization, in canonical display order - context only, never
   * proposed by the model (rule 22). */
  listActiveNames(organizationId: string): Promise<readonly string[]>
}

export interface AiTagsPort {
  /** Vocabulary only, capped by the caller - enough tag names to recognize house terms, not a
   * full catalog (rule 12). */
  searchByPrefix(organizationId: string, prefix: string, limit: number): Promise<readonly string[]>
}

export interface AiMembersPort {
  /** Active members' display names, capped by the caller - enough to recognize who someone
   * means, not the whole directory (rule 12). Never assigned or mentioned by the model. */
  listActiveDisplayNames(organizationId: string, limit: number): Promise<readonly string[]>
}

export type AiBoardSummary = {
  readonly id: string
  readonly organizationId: string
}

export interface AiBoardLookupPort {
  getById(boardId: string): Promise<AiBoardSummary | null>
}

export interface AiUsersPort {
  /** Display names for the prompt-version authors shown in the settings history - id -> name,
   * omitting ids with no user found. */
  getDisplayNames(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>
}
