import type { Priority } from '@collega/domain/enums'

// Prompt management (Site-Admin settings surface) -------------------------------------------

/**
 * The prompt text in force for a turn: the template plus the two redirect strings. `version` is
 * null when this is the built-in default.
 */
export type AiPromptSet = {
  readonly systemPromptTemplate: string
  readonly outOfScopeRedirect: string
  readonly conversationClosedRedirect: string
  readonly version: number | null
}

/**
 * What the Site-Admin settings surface reads back (contract `GET /ai-assist/prompt`).
 * `isBuiltInDefault` is distinct from `version` being null only in intent - the flag is what the
 * UI keys its "reset to default" affordance off, so it is stated rather than inferred.
 */
export type AiPromptSettings = {
  readonly body: string
  readonly outOfScopeRedirect: string
  readonly conversationClosedRedirect: string
  readonly version: number | null
  readonly isBuiltInDefault: boolean
  readonly versions: readonly AiPromptVersionSummary[]
}

/** One row in the version history. Carries no body - the list is for choosing, not reading. */
export type AiPromptVersionSummary = {
  readonly version: number
  readonly createdAtUtc: Date
  readonly createdByUserId: string | null
  readonly createdByDisplayName: string | null
  readonly isActive: boolean
}

/** A publish request. */
export type PublishAiPromptCommand = {
  readonly body: string
  readonly outOfScopeRedirect: string
  readonly conversationClosedRedirect: string
}

/**
 * One advisory safety probe result (rule 37). `expectedRefused` is always true today - every
 * probe is an attack or an off-topic message - but it is returned rather than assumed so the UI
 * renders outcomes without encoding that assumption, and so an in-scope control probe can be
 * added later.
 */
export type AiPromptProbeResult = {
  readonly id: string
  readonly prompt: string
  readonly refused: boolean
  readonly expectedRefused: boolean
}

/** The full probe run. */
export type AiPromptProbeReport = {
  readonly probes: readonly AiPromptProbeResult[]
}

export function probeRefusedCount(report: AiPromptProbeReport): number {
  return report.probes.filter((p) => p.refused).length
}

export function probeTotalCount(report: AiPromptProbeReport): number {
  return report.probes.length
}

// Idea drafting conversation ------------------------------------------------------------------

export const IDEA_ASSIST_USER_ROLE = 'user'
export const IDEA_ASSIST_ASSISTANT_ROLE = 'assistant'

/**
 * One entry in the conversation so far. The client owns the transcript and resends it each turn
 * - the server holds no chat state (SPEC/20-feature-ai-idea-assist.md rule 1: no persistent
 * history).
 */
export type IdeaAssistTurn = {
  readonly role: string
  readonly text: string
}

export function isUserTurn(turn: IdeaAssistTurn): boolean {
  return turn.role.toLowerCase() === IDEA_ASSIST_USER_ROLE
}

/**
 * The fields the assistant may propose (D-PREFILL). Every one is optional: an early turn may
 * return nothing but a question, and "the assistant hasn't decided yet" must stay
 * distinguishable from "the assistant chose nothing" all the way to the draft strip (rule 20a).
 *
 * Deliberately excludes UDF values, tags, board, and status. Board is chosen before the chat
 * opens and status defaults to the board's left-most swimlane (rule 22); UDFs and tags are v2
 * (rule 21).
 */
export type IdeaDraft = {
  readonly title: string | null
  readonly description: string | null
  readonly ideaTypeId: string | null
  readonly businessImpactId: string | null
  readonly priority: Priority | null
}

export const EMPTY_IDEA_DRAFT: IdeaDraft = {
  title: null,
  description: null,
  ideaTypeId: null,
  businessImpactId: null,
  priority: null,
}

export function hasAnyDraftValue(draft: IdeaDraft): boolean {
  return (
    draft.title !== null ||
    draft.description !== null ||
    draft.ideaTypeId !== null ||
    draft.businessImpactId !== null ||
    draft.priority !== null
  )
}

/** What the caller asks for: one turn of conversation against a board. */
export type IdeaAssistTurnRequest = {
  readonly boardId: string
  readonly transcript: readonly IdeaAssistTurn[]
  readonly draft: IdeaDraft | null
}

/**
 * What the caller gets back. `nextQuestion` is the ONLY free-text field the model produces (rule
 * 15) - there is deliberately no channel in which a limerick or a general-knowledge answer could
 * be returned.
 */
export type IdeaAssistTurnResult = {
  readonly inScope: boolean
  readonly conversationClosed: boolean
  readonly nextQuestion: string
  readonly draft: IdeaDraft
  readonly turnsRemaining: number
}

/**
 * One selectable option with the context needed to ask a good question about it. `fieldNames` is
 * the type's resolved field set - included so the assistant knows what a type will eventually
 * need, NOT so it can fill those values (rule 12; UDF pre-fill is out of v1 scope). Business
 * Impact options simply omit it.
 */
export type IdeaAssistOption = {
  readonly id: string
  readonly name: string
  readonly fieldNames?: readonly string[]
}

/**
 * The organization context assembled server-side and handed to the model (rules 11-12). The
 * client never sends any of this; it is built from the caller's token claims alone, which is
 * what makes cross-org retrieval structurally impossible rather than prompt-discouraged.
 */
export type IdeaAssistContext = {
  readonly organizationId: string
  readonly organizationName: string
  readonly scopeStatement: string | null
  readonly ideaTypes: readonly IdeaAssistOption[]
  readonly businessImpacts: readonly IdeaAssistOption[]
  readonly statuses: readonly string[]
  readonly tags: readonly string[]
  readonly memberNames: readonly string[]
  /** The prompt text in force - deployment-level, not organization-level, and the one member
   * here that is not org-scoped. It rides on the context because that is the only object
   * reaching the prompt builder, and because the model port has no scoped repository of its
   * own to resolve one from. */
  readonly prompts: AiPromptSet
}

/** Active idea-type ids - the closed enum the response schema is built from (rule 16). */
export function ideaTypeIdsOf(context: IdeaAssistContext): readonly string[] {
  return context.ideaTypes.map((t) => t.id)
}

export function businessImpactIdsOf(context: IdeaAssistContext): readonly string[] {
  return context.businessImpacts.map((b) => b.id)
}

/**
 * What the model returned, before the service re-validates it - everything here is UNTRUSTED
 * until every id has been checked against the retrieved set (rule 16 / contract line 1274).
 */
export type IdeaDraftModelResponse = {
  readonly inScope: boolean
  readonly nextQuestion: string
  readonly draft: IdeaDraft
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadInputTokens: number
  readonly cacheCreationInputTokens: number
}

/**
 * The four token counts the provider reports for one call - what the daily ceiling is measured in
 * and what a usage record stores.
 *
 * A projection of the response rather than a second shape, because it is also carried by
 * `IdeaDraftModelError` for the failures that arrive as a BILLED HTTP 200 (a safety refusal, a
 * malformed body). Those cost what a successful turn costs; metering them at zero lets anyone who
 * can reliably trip the provider's classifier walk past the ceiling that is the last line of
 * defence.
 */
export type AiTokenUsage = Pick<
  IdeaDraftModelResponse,
  'inputTokens' | 'outputTokens' | 'cacheReadInputTokens' | 'cacheCreationInputTokens'
>

/** A turn that never reached the provider, so nothing was billed for it. */
export const NO_AI_TOKEN_USAGE: AiTokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
}

/** An organization's AI assist configuration (contract `GET .../ai-assist/settings`). */
export type AiAssistSettings = {
  readonly aiAssistAvailable: boolean
  readonly scopeStatement: string | null
}

// Cost controls ---------------------------------------------------------------------------------

/**
 * Cost controls for AI idea assist (SPEC/20-feature-ai-idea-assist.md rules 28a-28b). Bound from
 * configuration by apps/api - rule 26 requires limits be configuration, never hard-coded.
 */
export type AiUsageLimits = {
  /**
   * Ceiling on total tokens consumed across ALL organizations in one UTC day. One shared pool,
   * not a per-org allowance. A runaway stop, not a budget forecast (rule 28b): saturated every
   * day at a typical input/output mix, the default of 500,000 allows roughly $99/month on
   * Sonnet 5 - well above the $50 the feature is aiming at, but bounded rather than open-ended.
   */
  readonly dailyTokenLimit: number
  /** The model id passed to the provider. Configuration so the tier can be re-tested without a
   * code change. */
  readonly model: string
  /** Reasoning effort. Starts at `low`: effort defaults to `high`, and thinking bills as output
   * at five times the input rate, so this is the largest single cost lever available. */
  readonly effort: string
  /** USD per million input tokens, as published for `model`. */
  readonly inputRatePerMillion: number
  /** USD per million output tokens. Thinking tokens bill here too. */
  readonly outputRatePerMillion: number
  /** The sliding window rate limits are measured over (rule 26). Sixty seconds by default. */
  readonly rateLimitWindowSeconds: number
  /** Calls one user may make per window, counted against the REAL actor during a View As
   * session, not the impersonated user. */
  readonly perUserCallsPerWindow: number
  /** Calls one organization may make per window, across all its users. */
  readonly perOrganizationCallsPerWindow: number
}

export const DEFAULT_AI_USAGE_LIMITS: AiUsageLimits = {
  dailyTokenLimit: 500_000,
  model: 'claude-sonnet-5',
  effort: 'low',
  inputRatePerMillion: 3.0,
  outputRatePerMillion: 15.0,
  rateLimitWindowSeconds: 60,
  perUserCallsPerWindow: 10,
  perOrganizationCallsPerWindow: 60,
}

/** Whether a ceiling is in force at all. A non-positive limit disables the gate - useful for a
 * local environment, never intended for a deployment. */
export function isUsageEnforced(limits: AiUsageLimits): boolean {
  return limits.dailyTokenLimit > 0
}

/** Whether rate limiting is in force. Non-positive disables it, matching `isUsageEnforced`. */
export function isRateLimited(limits: AiUsageLimits): boolean {
  return (
    limits.rateLimitWindowSeconds > 0 &&
    (limits.perUserCallsPerWindow > 0 || limits.perOrganizationCallsPerWindow > 0)
  )
}

// Usage reporting ---------------------------------------------------------------------------

/**
 * One organization's AI consumption over a window (SPEC/30-Contracts.md "AI Idea Assist
 * Contracts"). `estimatedCost` is summed from the rates stored on each usage record rather than
 * from current configuration - this data supports cost pass-through, so changing configured
 * pricing must never restate what an organization already owes (rule 28c).
 */
export type AiUsageSummary = {
  readonly organizationId: string
  readonly organizationName: string
  readonly calls: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadInputTokens: number
  readonly cacheCreationInputTokens: number
  readonly estimatedCost: number
}

export function summaryTotalTokens(summary: AiUsageSummary): number {
  return (
    summary.inputTokens +
    summary.outputTokens +
    summary.cacheReadInputTokens +
    summary.cacheCreationInputTokens
  )
}

/**
 * Calls seen in the rate-limit window: the organization's total, and the requesting actor's
 * share of it (rule 26). `actorCalls` is always <= `organizationCalls`.
 */
export type AiCallCounts = {
  readonly organizationCalls: number
  readonly actorCalls: number
}

export const NO_AI_CALLS: AiCallCounts = { organizationCalls: 0, actorCalls: 0 }

/**
 * What one turn asks the gate to hold before it spends anything (`AiUsageGate.reserveUsage`).
 *
 * The meter is also the counter: both cost controls read committed `ai_usage_records` rows - the
 * daily ceiling sums their tokens, the rate limit counts them - so a turn that writes its row
 * only after the provider answers is invisible to every turn racing it. On a serverless runtime
 * that fans out by design, "check, then act" is not a gate at all: a burst of concurrent requests
 * all read the same total and all pass it. The row goes down FIRST; the real counts replace the
 * estimate once they are known.
 */
export type ReserveAiUsageInput = {
  readonly organizationId: string
  readonly boardId?: string | null
  /**
   * Tokens held against the daily ceiling for as long as the turn is in flight. An estimate, and
   * deliberately a generous one: it is replaced by the provider's own counts the moment the call
   * returns, so it never distorts the day's total for longer than one call takes, and it only
   * ever bounds how many turns may run AT ONCE. Under-reserving lets a burst past the ceiling the
   * reservation exists to defend; over-reserving briefly refuses a burst that could have been
   * afforded.
   */
  readonly estimatedTokens: number
}

/**
 * A written, committed usage row awaiting its real token counts. Carries everything
 * `settleUsage` needs to replace THAT EXACT ROW rather than write a second one - a settlement
 * that moved the turn to a new row would double-count it in the rate-limit window and reorder
 * it in `getRecentOutcomes`, which is what rule 10's three-strikes close reads.
 */
export type AiUsageReservation = {
  readonly id: string
  readonly organizationId: string
  readonly boardId: string | null
  readonly occurredAtUtc: Date
  readonly reservedTokens: number
}

/**
 * The platform-wide usage report. `dailyTokenLimit` and `tokensUsedToday` are null on the
 * single-organization report - the ceiling is platform-wide and is not an organization's
 * business.
 */
export type AiUsageReport = {
  readonly fromUtc: Date
  readonly toUtc: Date
  readonly organizations: readonly AiUsageSummary[]
  readonly dailyTokenLimit: number | null
  readonly tokensUsedToday: number | null
}

export function reportTotalCalls(report: AiUsageReport): number {
  return report.organizations.reduce((sum, o) => sum + o.calls, 0)
}

export function reportTotalTokens(report: AiUsageReport): number {
  return report.organizations.reduce((sum, o) => sum + summaryTotalTokens(o), 0)
}

export function reportTotalEstimatedCost(report: AiUsageReport): number {
  return report.organizations.reduce((sum, o) => sum + o.estimatedCost, 0)
}
