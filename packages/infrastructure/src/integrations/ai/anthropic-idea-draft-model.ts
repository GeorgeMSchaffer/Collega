import Anthropic from '@anthropic-ai/sdk'
import type {
  AiTokenUsage,
  IdeaAssistContext,
  IdeaAssistTurn,
  IdeaDraft,
  IdeaDraftModel,
  IdeaDraftModelResponse,
} from '@collega/application/ai'
import {
  buildDraftNote,
  buildSystemPrompt,
  IdeaDraftModelError,
  isUserTurn,
} from '@collega/application/ai'
import { Priority } from '@collega/domain/enums'
import { buildIdeaDraftResponseSchema } from './idea-draft-schema.js'

/** Generous relative to a one-question answer because it must also cover thinking - the response
 * itself is schema-constrained and small. Matches .NET's `AnthropicIdeaDraftModel.MaxTokens`. */
const MAX_TOKENS = 8_000

/**
 * Configuration for {@link AnthropicIdeaDraftModel}. `apiKey` comes from apps/api's config layer
 * (the single deployment-wide `ANTHROPIC_API_KEY`, SPEC/20-feature-ai-idea-assist.md rule 29) -
 * this class never reads `process.env` itself. An empty/undefined key is a SUPPORTED STATE (rule
 * 31): `isConfigured` is false and the feature runs dark rather than throwing.
 *
 * `model` and `effort` are decided settings (rules 28a-28e: `claude-sonnet-5` at `low`), not
 * user-configurable - but they still arrive as configuration here, matching `AiUsageLimits`
 * upstream and .NET's `AnthropicIdeaDraftModel(AiUsageLimits, AiCredentials, ...)`.
 */
export type AnthropicIdeaDraftModelConfig = {
  readonly apiKey: string | undefined
  readonly model: string
  readonly effort: string
}

type IdeaDraftSchemaResponse = {
  readonly inScope: boolean
  readonly nextQuestion?: string | null
  readonly title?: string | null
  readonly description?: string | null
  readonly ideaTypeId?: string | null
  readonly businessImpactId?: string | null
  readonly priority?: string | null
}

/**
 * The Anthropic-backed {@link IdeaDraftModel} (SPEC/20-feature-ai-idea-assist.md "Model
 * Configuration"). The only file in this package that imports `@anthropic-ai/sdk`, so no vendor
 * type ever leaks into Application or Domain.
 *
 * The client is constructor-injected, never a module-level singleton or a default instance built
 * lazily on first use: SPEC/50-typescript-migration.md ticket 10 replaced the .NET integration
 * suite after it made a live, billed Anthropic call whose only symptom was one test taking five
 * seconds instead of one. A test constructs this class with a fake `Anthropic` client (or none at
 * all, to exercise the unconfigured path) and nothing here can reach a real provider by accident.
 *
 * Structured outputs, not prose parsing: the response is constrained by a per-request JSON Schema
 * built from the organization's real option ids (`buildIdeaDraftResponseSchema`), which is what
 * makes an invalid classification structurally impossible. Adaptive thinking is always requested
 * at the configured effort - `budget_tokens` is rejected with 400 on this model generation, so
 * depth is controlled by `output_config.effort` instead.
 */
export class AnthropicIdeaDraftModel implements IdeaDraftModel {
  private readonly client: Anthropic | null

  constructor(
    private readonly config: AnthropicIdeaDraftModelConfig,
    /** Test seam. Production never passes this - a configured key builds the SDK's own client. */
    client?: Anthropic,
  ) {
    if (client !== undefined) {
      this.client = client
    } else if (config.apiKey !== undefined && config.apiKey.trim().length > 0) {
      this.client = new Anthropic({ apiKey: config.apiKey })
    } else {
      this.client = null
    }
  }

  get isConfigured(): boolean {
    return this.client !== null
  }

  async continueTurn(
    context: IdeaAssistContext,
    transcript: readonly IdeaAssistTurn[],
    currentDraft: IdeaDraft,
  ): Promise<IdeaDraftModelResponse> {
    const client = this.client
    if (client === null) {
      throw new IdeaDraftModelError('AI assist is not configured.')
    }

    const messages = buildMessages(transcript, currentDraft, context)

    let response: Anthropic.Message
    try {
      response = await client.messages.create({
        model: this.config.model,
        max_tokens: MAX_TOKENS,
        // The stable prefix - system prompt plus the organization catalog - is identical for
        // every turn of every conversation in this organization, so it sits behind one cache
        // breakpoint. Only the transcript (sent via `messages`) varies, and it comes after.
        system: [
          {
            type: 'text',
            text: buildSystemPrompt(context),
            cache_control: { type: 'ephemeral' },
          },
        ],
        thinking: { type: 'adaptive' },
        output_config: {
          effort: resolveEffort(this.config.effort),
          format: { type: 'json_schema', schema: buildIdeaDraftResponseSchema(context) },
        },
        messages,
      })
    } catch (error) {
      // Every provider failure degrades identically (rule 32) - the caller keeps the user's typed
      // text and the turn falls back to the scripted nudge.
      throw new IdeaDraftModelError('The idea assist model call failed.', { cause: error })
    }

    // A safety classifier can decline the request outright. That is a normal 200 with no usable
    // content, not a thrown error - treat it as an unusable turn rather than reading `content[0]`.
    //
    // A normal 200 is also a BILLED 200: the request was tokenized, the classifier ran, and the
    // usage block is right there on the response. Metering it at zero would leave the daily
    // ceiling - the control that still holds once everything upstream has been talked past -
    // walkable by anyone who can reliably trip that classifier.
    if (response.stop_reason === 'refusal') {
      throw new IdeaDraftModelError('The model declined the request.', {
        usage: usageOf(response),
      })
    }

    return parseResponse(response)
  }
}

function buildMessages(
  transcript: readonly IdeaAssistTurn[],
  currentDraft: IdeaDraft,
  context: IdeaAssistContext,
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = transcript.map((turn) => ({
    role: isUserTurn(turn) ? 'user' : 'assistant',
    content: turn.text,
  }))

  const lastIndex = messages.length - 1
  const last = messages[lastIndex]
  const lastTurn = transcript[lastIndex]
  if (last === undefined || lastTurn === undefined) {
    throw new IdeaDraftModelError('The conversation transcript is empty.')
  }

  // The draft rides with the final user turn rather than in the system prompt: it changes every
  // turn, and anything volatile in the prefix invalidates the cache for the whole organization.
  messages[lastIndex] = {
    role: last.role,
    content: `${buildDraftNote(currentDraft, context)}\n\n${lastTurn.text}`,
  }

  return messages
}

function parseResponse(response: Anthropic.Message): IdeaDraftModelResponse {
  // Every failure below this line is a 200 the provider has already billed, so each carries its
  // usage on the way out - see the note on `IdeaDraftModelError`.
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text' && block.text.trim().length > 0,
  )
  if (textBlock === undefined) {
    throw new IdeaDraftModelError('The model returned no content.', { usage: usageOf(response) })
  }

  let parsed: IdeaDraftSchemaResponse
  try {
    parsed = JSON.parse(textBlock.text) as IdeaDraftSchemaResponse
  } catch (error) {
    throw new IdeaDraftModelError('The model returned malformed JSON.', {
      cause: error,
      usage: usageOf(response),
    })
  }

  return {
    inScope: parsed.inScope,
    nextQuestion: parsed.nextQuestion ?? '',
    draft: {
      title: parsed.title ?? null,
      description: parsed.description ?? null,
      ideaTypeId: parsed.ideaTypeId ?? null,
      businessImpactId: parsed.businessImpactId ?? null,
      priority: parsePriority(parsed.priority),
    },
    ...usageOf(response),
  }
}

/** The four counts the provider billed for this call, whether or not it produced anything usable. */
function usageOf(response: Anthropic.Message): AiTokenUsage {
  const usage = response.usage
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
  }
}

function parsePriority(value: string | null | undefined): Priority | null {
  if (value === null || value === undefined) {
    return null
  }
  const match = Object.values(Priority).find((name) => name.toLowerCase() === value.toLowerCase())
  return match ?? null
}

/** Maps the configured effort string onto the SDK's literal union, defaulting to `low` for
 * anything unrecognized - silently spending more than configured because a value was misspelled
 * is the wrong failure direction for what is, per rule 28e, the largest single cost lever
 * available. Mirrors .NET's `AnthropicIdeaDraftModel.ResolveEffort`. */
function resolveEffort(configured: string): 'low' | 'medium' | 'high' | 'max' {
  switch (configured.trim().toLowerCase()) {
    case 'medium':
      return 'medium'
    case 'high':
      return 'high'
    case 'max':
      return 'max'
    default:
      return 'low'
  }
}
