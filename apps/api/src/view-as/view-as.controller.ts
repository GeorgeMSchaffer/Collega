import type { ViewAsCandidate, ViewAsSessionResult } from '@collega/application/impersonation'
import { ViewAsService } from '@collega/application/impersonation'
import { Body, Controller, Delete, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { requirePresent } from '../common/errors/request-validation.error.js'
import { guidOrEmpty, optional } from '../common/request-values.js'

/** `POST /auth/view-as` request body (`SPEC/30-Contracts.md` "View As Contracts"). */
type StartViewAsBody = { targetUserId?: string }

/**
 * View As (`SPEC/30-Contracts.md` "View As Contracts"; behaviour in `SPEC/20-feature-view-as.md`).
 *
 * **These three routes are the only ones in the API that act on the caller's REAL identity while a
 * session is live.** Everywhere else the request acts as the impersonated user, because
 * `ImpersonationSessionResolver` has already rewritten the principal `AuthGuard` resolves (rule 4).
 * `ViewAsService` reads `CurrentUserContext.realUserId` rather than `userId` for exactly that
 * reason - nothing here re-derives identity, and nothing here may.
 *
 * Impersonation is a server-side session and the access token is never reissued, so there is no
 * cookie to set or clear on either `POST` or `DELETE`: a captured token carries no impersonation
 * authority at any point.
 *
 * `@UseGuards(AuthGuard)` and NOT `RolesGuard`. The authorization matrix is the service's, and has
 * to be: `RolesGuard` reads the ACTING role, which during a live session is the target's. The
 * golden corpus pins the difference - `auth.viewas.start.readonly` records the Application 403
 * envelope (`https://collega.dev/problems/forbidden`, with a `traceId` and no charset), not the
 * framework one a role guard produces.
 *
 * Deliberately NOT on the mandatory-password-rotation allowlist, mirroring the .NET controller: an
 * administrator who still owes a rotation is refused by `AuthGuard` before reaching these, so they
 * cannot use impersonation to work around their own gate.
 */
@Controller('auth/view-as')
@UseGuards(AuthGuard)
export class ViewAsController {
  constructor(private readonly viewAs: ViewAsService) {}

  /**
   * Start acting as another user.
   *
   * Every refusal the matrix makes - an Org Admin naming a user outside their organization, anyone
   * naming a Site Admin (D-SCOPE), any caller naming an `Inactive` user, and a target whose
   * organization is archived - comes back as the same 403 carrying the same message, so the
   * endpoint does not disclose whether a user exists or what role they hold. That is
   * `ViewAsService`'s single `NOT_ALLOWED` constant; this handler must never add a branch that
   * narrows it.
   *
   * `guidOrEmpty` rather than a 404-on-malformed pipe: the house coercion
   * (`common/request-values.ts`) binds a non-GUID body value to the empty GUID, which resolves
   * against no user and answers `404`. .NET answered `400` there, from a System.Text.Json binding
   * failure whose wording no fixture records - the same known divergence that file documents for
   * every other `Guid?` body property.
   */
  @Post()
  @HttpCode(200)
  async start(@Body() body: StartViewAsBody): Promise<ViewAsSessionResult> {
    // `[RequiredField]` on a NULLABLE `Guid` does bite, unlike the non-nullable case `guidOrEmpty`
    // describes, and `auth.viewas.start.missing-target` records its exact wording - "Target User Id
    // is required." - in the model-binding envelope this produces.
    requirePresent({ targetUserId: body.targetUserId })

    return this.viewAs.start(guidOrEmpty(body.targetUserId))
  }

  /**
   * Stop acting as another user.
   *
   * Idempotent by contract - with no active session this is still `204`, so a client that has lost
   * track of state can always return to a known-good position without handling an error. The
   * service owns that; there is nothing to check here.
   */
  @Delete()
  @HttpCode(204)
  async end(): Promise<void> {
    await this.viewAs.end()
  }

  /**
   * The picker's list, already filtered to what the caller may target so the client never has to
   * reproduce the authorization rules. `Inactive` users may appear - with `selectable` false - so
   * the picker can grey them out; `POST` refuses them regardless of what the list displayed.
   */
  @Get('candidates')
  async candidates(@Query() query: Record<string, unknown>): Promise<readonly ViewAsCandidate[]> {
    return this.viewAs.listCandidates(optional(query.search))
  }
}
