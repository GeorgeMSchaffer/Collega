import type {
  AiAssistSettings,
  IdeaAssistTurn,
  IdeaAssistTurnResult,
  IdeaDraft,
} from '@collega/application/ai'
import {
  IDEA_ASSIST_ASSISTANT_ROLE,
  IDEA_ASSIST_USER_ROLE,
  IdeaAssistService,
  TRANSCRIPT_ENTRY_MAX_LENGTH,
} from '@collega/application/ai'
import { Priority, Role } from '@collega/domain/enums'
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '@collega/domain/ideas'
import { ORGANIZATION_AI_SCOPE_STATEMENT_MAX_LENGTH } from '@collega/domain/organizations'
import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { Roles } from '../auth/roles.decorator.js'
import { RolesGuard } from '../auth/roles.guard.js'
import {
  displayName,
  type FieldRules,
  RequestValidationError,
  validateFields,
} from '../common/errors/request-validation.error.js'
import { optional, optionalGuid } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/** The draft fields, on both the request and the response (D-PREFILL). */
type IdeaDraftBody = {
  title?: string | null
  description?: string | null
  ideaTypeId?: string | null
  businessImpactId?: string | null
  priority?: string | null
}

/** `POST /boards/{boardId}/idea-assist/turns` request body. */
type IdeaAssistTurnBody = {
  transcript?: unknown
  draft?: IdeaDraftBody | null
}

/** `PUT /organizations/{organizationId}/ai-assist/settings` request body. */
type UpdateAiAssistSettingsBody = { scopeStatement?: string | null }

/** `GET /ai-assist/availability` - one boolean, and deliberately nothing else. */
type AiAssistAvailabilityResponse = { available: boolean }

const TRANSCRIPT_ROLES = [IDEA_ASSIST_USER_ROLE, IDEA_ASSIST_ASSISTANT_ROLE] as const

/**
 * Reads the transcript array and transcribes the per-entry attributes
 * `IdeaAssistTurnContract` carries - `[RequiredField]` and `[AllowedValues]` on `role`,
 * `[RequiredField]` and `[MaxLengthField(4000)]` on `text`.
 *
 * The entry COUNT, the last-entry-is-user rule and the trimming are `IdeaAssistService`'s, not
 * this function's: they are contract rules the service already owns and re-checks for every
 * caller, and duplicating them here would put the same constraint in two places with two
 * different envelopes.
 *
 * An omitted `transcript` reads as empty rather than missing, which is not an oversight: the .NET
 * property was initialised to `new()` and System.Text.Json leaves an initialiser alone for a key
 * that is not in the JSON, so `[RequiredField]` never fired and the empty list reached the service
 * - which answers "At least one message is required." in the Application envelope. An explicit
 * `null` DID overwrite the initialiser and fail the attribute, which is the branch below.
 */
function readTranscript(value: unknown): readonly IdeaAssistTurn[] {
  if (value === undefined) {
    return []
  }
  if (value === null) {
    throw new RequestValidationError({ transcript: [`${displayName('transcript')} is required.`] })
  }
  if (!Array.isArray(value)) {
    // The one place this reader refuses rather than defaults, following `stringList`'s reasoning
    // in `common/request-values.ts`: reading a mistyped transcript as absent would ACCEPT the
    // request and silently discard what the caller asked about.
    throw new RequestValidationError({ transcript: [`${displayName('transcript')} is invalid.`] })
  }

  const rules: Record<string, FieldRules> = {}
  const entries: IdeaAssistTurn[] = []

  for (const [index, item] of value.entries()) {
    // A non-object entry is read as one with no properties, so it fails `role`/`text` presence
    // rather than throwing on a property read - the same forgiveness `validateFields` gives a
    // mistyped scalar, and for the same reason: a 500 on a malformed body is the worse answer.
    const entry = (typeof item === 'object' && item !== null ? item : {}) as Partial<IdeaAssistTurn>
    // Keyed by the whole path and named by the property alone - ASP.NET keyed `Transcript[0].Role`
    // (camelCased) but built the message from the property's own display name, so the entry reads
    // "Role is required.", never "transcript[0].role is required.".
    rules[`transcript[${index}].role`] = {
      value: entry.role,
      required: true,
      allowedValues: TRANSCRIPT_ROLES,
      displayName: 'Role',
    }
    rules[`transcript[${index}].text`] = {
      value: entry.text,
      required: true,
      maxLength: TRANSCRIPT_ENTRY_MAX_LENGTH,
      displayName: 'Text',
    }
    entries.push({
      role: typeof entry.role === 'string' ? entry.role : '',
      text: typeof entry.text === 'string' ? entry.text : '',
    })
  }

  validateFields(rules)
  return entries
}

/**
 * `Enum.TryParse<Priority>(ignoreCase: true)`: a priority the client cannot spell is DROPPED
 * rather than rejected, the same forgiveness the contract gives an unknown option id, and for the
 * same reason - a stale value is a client that fell behind, not an attack.
 */
function readPriority(value: unknown): Priority | null {
  const text = optional(value)
  if (text === null) {
    return null
  }
  const lower = text.trim().toLowerCase()
  return Object.values(Priority).find((p) => p.toLowerCase() === lower) ?? null
}

/**
 * The `draft` the client echoes back so the model revises rather than restates. Unknown or
 * inactive ids are discarded by `IdeaAssistService` rather than rejected here, so the GUID
 * coercion's empty-GUID fallback resolves against nothing and falls out on its own.
 */
function readDraft(body: IdeaDraftBody | null | undefined): IdeaDraft | null {
  if (body === null || body === undefined) {
    return null
  }

  validateFields({
    title: { value: body.title, maxLength: TITLE_MAX_LENGTH },
    description: { value: body.description, maxLength: DESCRIPTION_MAX_LENGTH },
  })

  return {
    title: optional(body.title),
    description: optional(body.description),
    ideaTypeId: optionalGuid(body.ideaTypeId),
    businessImpactId: optionalGuid(body.businessImpactId),
    priority: readPriority(body.priority),
  }
}

/**
 * AI-assisted idea drafting, availability, and the per-organization scope statement
 * (`SPEC/30-Contracts.md` "AI Idea Assist Contracts"; behaviour in
 * `SPEC/20-feature-ai-idea-assist.md`).
 *
 * **None of these routes ever creates, updates or deletes an idea** (rule 23). The turn endpoint
 * returns draft suggestions that seed the create form, which is submitted separately through
 * `POST /boards/{boardId}/ideas` and validated there as normal. That separation is why no model
 * output is ever authorization-bearing, and it must not be "optimized" away.
 *
 * **Nothing the client sends steers the assistant.** There is no prompt, no system instructions, no
 * model name, no retrieved context, no scope statement and no organization id on the way in - the
 * server assembles all of it from the caller's own identity, which is what keeps a client from
 * reaching another tenant's data.
 *
 * `@Controller()` carries no prefix on purpose - the three routes sit under three different roots,
 * so any prefix would move at least two of them. See `boards.controller.ts` for the convention.
 */
@Controller()
export class IdeaAssistController {
  constructor(private readonly ideaAssist: IdeaAssistService) {}

  /**
   * Advances the drafting conversation by one turn.
   *
   * `503` means the assistant is unavailable - unconfigured, provider down, or the deployment's
   * daily token budget exhausted. The three are indistinguishable on purpose: all of them mean
   * "keep working without the assistant", and a client that could tell them apart would start
   * treating them differently. `AiAssistUnavailableError` carries no cause for the same reason.
   *
   * `AuthGuard` only - the role gate is `IdeaAssistService.requireDraftingMember`, which refuses
   * Read Only and refuses a Site Admin acting as themselves, each with its own recorded message.
   */
  @Post('boards/:boardId/idea-assist/turns')
  @UseGuards(AuthGuard)
  async continueTurn(
    @Param('boardId', UuidParamPipe) boardId: string,
    @Body() body: IdeaAssistTurnBody,
  ): Promise<IdeaAssistTurnResult> {
    return this.ideaAssist.continueTurn({
      boardId,
      transcript: readTranscript(body.transcript),
      draft: readDraft(body.draft),
    })
  }

  /**
   * Whether the client should open the drafting chat or go straight to the create form (rule 32a).
   *
   * **Any authenticated user**, deliberately: creating ideas is a `User`-role activity, so the
   * admin-only settings route below could not answer this question for the people who need it.
   * Safe to widen because the answer is one boolean - no key material, no organization
   * configuration, no usage figures - and it makes no provider call, so it is neither metered nor
   * rate limited.
   *
   * A snapshot, not a subscription: the budget can be exhausted between this call and the next
   * turn, so a client must still handle the turn endpoint's `503`.
   */
  @Get('ai-assist/availability')
  @UseGuards(AuthGuard)
  async availability(): Promise<AiAssistAvailabilityResponse> {
    return { available: await this.ideaAssist.isAvailable() }
  }

  /** Reads the organization's configuration. Never returns a key, nor any part of one (rule 28). */
  @Get('organizations/:organizationId/ai-assist/settings')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OrgAdmin, Role.SiteAdmin)
  async settings(
    @Param('organizationId', UuidParamPipe) organizationId: string,
  ): Promise<AiAssistSettings> {
    return this.ideaAssist.getSettings(organizationId)
  }

  /**
   * Sets or clears the scope statement - the free-text narrowing of what the assistant will
   * discuss. Null or empty clears it, leaving the organization's active Idea Types as the only
   * boundary. Takes effect on the next turn; in-flight conversations are not retroactively
   * re-scoped.
   */
  @Put('organizations/:organizationId/ai-assist/settings')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OrgAdmin, Role.SiteAdmin)
  async updateSettings(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: UpdateAiAssistSettingsBody,
  ): Promise<AiAssistSettings> {
    validateFields({
      scopeStatement: {
        value: body.scopeStatement,
        maxLength: ORGANIZATION_AI_SCOPE_STATEMENT_MAX_LENGTH,
      },
    })

    return this.ideaAssist.setScopeStatement(organizationId, optional(body.scopeStatement))
  }
}
