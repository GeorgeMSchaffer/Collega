import { ApplicationError } from '../common/index.js'

/**
 * The assistant cannot serve this turn - unconfigured, unavailable, or out of daily token
 * budget. The three are deliberately indistinguishable to the caller
 * (SPEC/20-feature-ai-idea-assist.md rules 31-32): all three mean "keep working without the
 * assistant". Maps to `503`, which the client treats as a signal to degrade rather than as an
 * error.
 *
 * Defined LOCALLY rather than in the kernel, mirroring the .NET original
 * (`Collega.Application.Ai.AiAssistUnavailableException`, itself declared inside
 * `IdeaAssistService.cs` rather than the shared `Exceptions` folder). This is the first place in
 * the port that needs a 503 "service unavailable, work without it" semantic, and the kernel's
 * `ApplicationError` taxonomy - forbidden / unauthorized / notFound / conflict / lockedOut /
 * rateLimited / validation - has no `kind` for it.
 *
 * REPORTED, not silently worked around: whoever wires the API-layer error-to-status mapping
 * needs a seventh case, `'aiAssistUnavailable' -> 503`, alongside the six the kernel already
 * defines. This class cannot live in `packages/application/src/common` (out of this slice's
 * globs, and the kernel note "do not add a local one" is about kernel PRIMITIVES like Clock and
 * AuditEventWriter that every partition needs - a 503 status is needed by exactly this feature).
 */
export class AiAssistUnavailableError extends ApplicationError {
  readonly kind = 'aiAssistUnavailable' as const

  constructor() {
    super('AI assist is unavailable.')
  }
}
