/**
 * The v2 idea-assistant turn, as `SPEC/contracts/ai-assist.md` "v2 turn contract" states it.
 *
 * Plain types and constants, importable from either side of the server boundary.
 */

/** The transcript cap, in entries (user and assistant together): v1 rule 5. */
export const ASSIST_TRANSCRIPT_CAP = 20

/** User turns that fit under the cap before the first one is sent: 19 entries, 10 user turns. */
export const ASSIST_USER_TURNS = 10

/** A user message's limit, from the contract. */
export const ASSIST_TEXT_MAX_LENGTH = 4000

export type AssistEntry = { role: 'user' | 'assistant'; text: string }

/** The form's values, every key optional; `fieldValues` entries are `{ fieldDefinitionId, value }`. */
export type AssistDraft = {
  title?: string
  problem?: string
  proposedSolutions?: string[]
  impactRationale?: string
  businessImpactId?: string
  ideaTypeId?: string
  priority?: string
  tagNames?: string[]
  fieldValues?: { fieldDefinitionId: string; value: string }[]
  description?: string
}

export type AssistTurnRequest = {
  /** Oldest first, at most `ASSIST_TRANSCRIPT_CAP`, ending with a user entry. */
  transcript: AssistEntry[]
  draft?: AssistDraft
  lockedFields?: string[]
  /** The previous turn's `nextStep`; absent on the first. */
  step?: string
}

export type AssistTurnResponse = {
  inScope: boolean
  conversationClosed: boolean
  nextQuestion: string
  /** Only the fields this turn set. */
  changes: AssistDraft
  suggestions?: { solutions?: string[]; problemRewrite?: string; rationales?: string[] }
  nextStep: string
  /** Further user turns that fit under the cap. */
  turnsRemaining: number
}

/**
 * What the turn action answers with. A thrown `ApiError` loses its status crossing a Server Function
 * in production, so the action returns the outcome instead: `429` (with its wait) is told apart
 * from every other failure, which ends the conversation.
 */
export type AssistTurnResult =
  | { ok: true; turn: AssistTurnResponse }
  | { ok: false; rateLimited: false }
  | { ok: false; rateLimited: true; retryAfter: number | undefined }
