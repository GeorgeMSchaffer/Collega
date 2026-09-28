import type {
  AiTokenUsage,
  IdeaAssistContext,
  IdeaAssistTurn,
  IdeaDraft,
  IdeaDraftModel,
} from '@collega/application/ai'
import {
  EMPTY_IDEA_DRAFT,
  IDEA_ASSIST_ASSISTANT_ROLE,
  IDEA_ASSIST_USER_ROLE,
  IdeaDraftModelError,
  sanitizeDraft,
} from '@collega/application/ai'
import type { EvalCase } from './corpus.ts'
import type { AbortReason, TrialRecord, TrialStatus, TurnRecord } from './run-file.ts'

export interface Ceilings {
  readonly maxCalls: number
  readonly maxTokens: number
}

/** Injected so a hermetic check controls time. */
export interface Stopwatch {
  /** Milliseconds from an arbitrary origin, for latency only. */
  elapsedMs(): number
}

export interface TrialSpec {
  readonly evalCase: EvalCase
  readonly repeat: number
  readonly context: IdeaAssistContext
}

export interface LoopOptions {
  readonly model: IdeaDraftModel
  readonly ceilings: Ceilings
  readonly concurrency: number
  readonly stopwatch: Stopwatch
  /** Applied to every error message before it is stored (rule 22). */
  readonly redact: (text: string) => string
  readonly onTrial?: (trial: TrialRecord) => void
}

export interface LoopResult {
  /** In `specs` order. Trials a ceiling stopped before their first call are absent. */
  readonly trials: readonly TrialRecord[]
  readonly calls: number
  readonly tokens: AiTokenUsage
  readonly abortReason: AbortReason | null
  readonly abortMessage: string | null
}

/**
 * Runs every trial through the `IdeaDraftModel` port (rules 8-11, 25, 28). The ceilings are
 * checked before every call; reaching one stops new calls, and overshoot is bounded by the calls
 * already in flight. With concurrency above 1 the first call per fixture runs alone, so the cache
 * prefix is written before the rest read it.
 *
 * An `IdeaDraftModelError` ends that trial as errored. Anything else is a defect rather than a
 * provider failure, so it stops the run as `unexpected-error`.
 */
export async function runTrials(
  specs: readonly TrialSpec[],
  options: LoopOptions,
): Promise<LoopResult> {
  const state = {
    calls: 0,
    tokens: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    },
    abortReason: null as AbortReason | null,
    abortMessage: null as string | null,
  }
  const results = new Map<number, TrialRecord>()
  const warmed = new Map<string, Promise<void>>()

  const reserveCall = (): boolean => {
    if (state.abortReason !== null) return false
    if (state.calls >= options.ceilings.maxCalls) {
      state.abortReason = 'max-calls'
      return false
    }
    if (totalTokens(state.tokens) >= options.ceilings.maxTokens) {
      state.abortReason = 'max-tokens'
      return false
    }
    state.calls++
    return true
  }

  const addUsage = (usage: AiTokenUsage | null) => {
    if (usage === null) return
    state.tokens.inputTokens += usage.inputTokens
    state.tokens.outputTokens += usage.outputTokens
    state.tokens.cacheReadInputTokens += usage.cacheReadInputTokens
    state.tokens.cacheCreationInputTokens += usage.cacheCreationInputTokens
  }

  // Claimed synchronously, so exactly one trial per fixture becomes the one that warms it.
  const awaitWarmCache = async (fixture: string): Promise<(() => void) | null> => {
    const gate = warmed.get(fixture)
    if (gate !== undefined) {
      await gate
      return null
    }
    let release: () => void = () => {}
    warmed.set(
      fixture,
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    return release
  }

  const runOne = async (spec: TrialSpec): Promise<TrialRecord | null> => {
    const { evalCase, context } = spec
    const turns: TurnRecord[] = []
    let transcript: IdeaAssistTurn[] = []
    let draft: IdeaDraft = EMPTY_IDEA_DRAFT
    let status: TrialStatus = 'completed'
    let release = await awaitWarmCache(evalCase.fixture)

    try {
      for (const [index, userText] of evalCase.turns.entries()) {
        if (!reserveCall()) {
          status = 'aborted'
          break
        }
        const request: IdeaAssistTurn[] = [
          ...transcript,
          { role: IDEA_ASSIST_USER_ROLE, text: userText },
        ]
        const started = options.stopwatch.elapsedMs()
        try {
          const response = await options.model.continueTurn(context, request, draft)
          const latencyMs = options.stopwatch.elapsedMs() - started
          const usage: AiTokenUsage = {
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            cacheReadInputTokens: response.cacheReadInputTokens,
            cacheCreationInputTokens: response.cacheCreationInputTokens,
          }
          addUsage(usage)

          // As the service does: sanitize an in-scope draft; on a refusal return the draft
          // unchanged and drop the user turn, as the client does (v1 rule 8).
          const sanitized = response.inScope ? sanitizeDraft(response.draft, context, draft) : draft
          turns.push({
            index,
            transcript: request,
            draftSent: draft,
            inScope: response.inScope,
            nextQuestion: response.nextQuestion,
            rawDraft: response.draft,
            sanitizedDraft: sanitized,
            usage,
            latencyMs,
            error: null,
          })
          if (response.inScope) {
            transcript = [
              ...request,
              { role: IDEA_ASSIST_ASSISTANT_ROLE, text: response.nextQuestion },
            ]
            draft = sanitized
          }
        } catch (error) {
          if (!(error instanceof IdeaDraftModelError)) throw error
          addUsage(error.usage)
          turns.push({
            index,
            transcript: request,
            draftSent: draft,
            inScope: null,
            nextQuestion: null,
            rawDraft: null,
            sanitizedDraft: null,
            usage: error.usage,
            latencyMs: options.stopwatch.elapsedMs() - started,
            error: options.redact(describeError(error)),
          })
          status = 'errored'
          break
        } finally {
          release?.()
          release = null
        }
      }
    } catch (error) {
      state.abortReason = 'unexpected-error'
      state.abortMessage = options.redact(describeError(error))
      status = 'aborted'
    } finally {
      release?.()
    }

    return turns.length === 0 ? null : { caseId: evalCase.id, repeat: spec.repeat, status, turns }
  }

  let next = 0
  const worker = async () => {
    while (state.abortReason === null && next < specs.length) {
      const index = next++
      const trial = await runOne(specs[index])
      if (trial !== null) {
        results.set(index, trial)
        options.onTrial?.(trial)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker))

  return {
    trials: [...results.entries()].sort(([a], [b]) => a - b).map(([, trial]) => trial),
    calls: state.calls,
    tokens: { ...state.tokens },
    abortReason: state.abortReason,
    abortMessage: state.abortMessage,
  }
}

export function totalTokens(usage: AiTokenUsage): number {
  return (
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadInputTokens +
    usage.cacheCreationInputTokens
  )
}

/** The error and its cause's message - the SDK's detail sits in the cause. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = error.cause instanceof Error ? ` Cause: ${error.cause.message}` : ''
  return `${error.message}${cause}`
}
