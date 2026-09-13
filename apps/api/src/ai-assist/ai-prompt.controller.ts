import type { AiPromptProbeReport, AiPromptSettings } from '@collega/application/ai'
import { AiPromptService } from '@collega/application/ai'
import { AI_PROMPT_BODY_MAX_LENGTH, AI_PROMPT_REDIRECT_MAX_LENGTH } from '@collega/domain/ai'
import { Role } from '@collega/domain/enums'
import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { Roles } from '../auth/roles.decorator.js'
import { RolesGuard } from '../auth/roles.guard.js'
import { validateFields } from '../common/errors/request-validation.error.js'
import { IntParamPipe } from '../common/int-param.pipe.js'

/** `PUT /ai-assist/prompt` request body. */
type PublishAiPromptBody = {
  body?: string
  outOfScopeRedirect?: string
  conversationClosedRedirect?: string
}

/** `POST /ai-assist/prompt/probe` request body - the draft, which need not have been saved. */
type ProbeAiPromptBody = { body?: string }

/**
 * Site-Admin management of the idea-assist system prompt (`SPEC/20-feature-ai-idea-assist.md`
 * rules 34-38).
 *
 * **Deployment configuration, not organization content** - the same scope as the API key (rule 29),
 * which is why the route is not organization-scoped and why this does not go through View As.
 *
 * `@Roles(Role.SiteAdmin)` is a COARSE FIRST GATE. `AiPromptService` checks the role again on
 * every method, and that second check is the load-bearing one: it reads the EFFECTIVE role, so it
 * also refuses a Site Admin who is currently acting as someone else - which the guard alone would
 * let through, since during a session the acting role is the target's. The guard exists because the
 * golden corpus records the framework 403 envelope here (`aiassist.prompt.get.orgadmin`), not the
 * Application one.
 *
 * `@UseGuards(AuthGuard, RolesGuard)` in that order: `RolesGuard` reads the identity `AuthGuard`
 * resolves.
 */
@Controller('ai-assist/prompt')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.SiteAdmin)
export class AiPromptController {
  constructor(private readonly prompts: AiPromptService) {}

  /**
   * The active template plus its version history. With nothing published this returns the built-in
   * default with a null `version` and `isBuiltInDefault` true - an empty history is the normal
   * initial state, not an error.
   */
  @Get()
  async get(): Promise<AiPromptSettings> {
    return this.prompts.get()
  }

  /**
   * Publishes a new version and makes it active. Earlier versions are never modified.
   *
   * The placeholder requirement - both `{{ORGANIZATION_CATALOG}}` and `{{SCOPE_STATEMENT}}` must be
   * present - is enforced on the entity so every write path shares one rule; the checks here only
   * catch the cheap cases before a round trip, exactly as the .NET DTO's attributes did.
   */
  @Put()
  async publish(@Body() body: PublishAiPromptBody): Promise<AiPromptSettings> {
    validateFields({
      body: { value: body.body, required: true, maxLength: AI_PROMPT_BODY_MAX_LENGTH },
      outOfScopeRedirect: {
        value: body.outOfScopeRedirect,
        required: true,
        maxLength: AI_PROMPT_REDIRECT_MAX_LENGTH,
      },
      conversationClosedRedirect: {
        value: body.conversationClosedRedirect,
        required: true,
        maxLength: AI_PROMPT_REDIRECT_MAX_LENGTH,
      },
    })

    return this.prompts.publish({
      body: body.body ?? '',
      outOfScopeRedirect: body.outOfScopeRedirect ?? '',
      conversationClosedRedirect: body.conversationClosedRedirect ?? '',
    })
  }

  /**
   * Republishes an earlier version as a NEW version rather than reactivating the old row, so
   * history stays append-only and the restore is itself visible in it.
   *
   * `@HttpCode(200)` because Nest answers `POST` with `201` by default and the contract says `200`;
   * `IntParamPipe` because `{version:int}` was a route-MATCHING constraint on the .NET side, so a
   * non-integer segment was a 404 there and must stay one here.
   */
  @Post('versions/:version/restore')
  @HttpCode(200)
  async restore(@Param('version', IntParamPipe) version: number): Promise<AiPromptSettings> {
    return this.prompts.restore(version)
  }

  /**
   * Returns the deployment to the built-in default by standing every version down.
   *
   * **Not in `SPEC/30-Contracts.md`.** The route exists on the frozen .NET app and the golden
   * corpus records it across all five roles (`aiassist.prompt.reset.*`), so it is ported; the
   * contract's "AI Idea Assist Contracts" section simply never documented it. Reported with the
   * D6/D7 slice rather than resolved here.
   */
  @Post('reset')
  @HttpCode(200)
  async reset(): Promise<AiPromptSettings> {
    return this.prompts.resetToDefault()
  }

  /**
   * Runs the advisory safety probes against a draft template before publishing (rule 37).
   *
   * **Advisory only**: it never publishes anything and a failing probe never blocks a later `PUT`.
   * The probes run against a synthetic catalog, never a real organization's.
   *
   * `503` here means the probes could not RUN - unconfigured, provider down, or out of daily
   * budget. It deliberately does not report an outage as a refusal, which is the one wrong answer
   * this surface could give.
   */
  @Post('probe')
  @HttpCode(200)
  async probe(@Body() body: ProbeAiPromptBody): Promise<AiPromptProbeReport> {
    validateFields({
      body: { value: body.body, required: true, maxLength: AI_PROMPT_BODY_MAX_LENGTH },
    })

    return this.prompts.probe(body.body ?? '')
  }
}
