using Collega.API.Contracts.Ai;
using Collega.Application.Ai;
using Collega.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// AI-assisted idea drafting (SPEC/30-Contracts.md → "AI Idea Assist Contracts"). Thin, like every
/// controller here: the scope gate, id re-validation, turn caps, metering and audit all live in
/// <see cref="IIdeaAssistService"/>.
/// </summary>
/// <remarks>
/// This endpoint <b>never creates, updates, or deletes an idea</b> (rule 23). It returns draft
/// suggestions that seed the create form, which is submitted separately through
/// <c>POST /boards/{boardId}/ideas</c> and validated there as normal. That separation is the reason
/// no model output is ever authorization-bearing, and it must not be "optimized" away.
/// </remarks>
[ApiController]
[Route("boards/{boardId:guid}/idea-assist")]
public sealed class IdeaAssistController : ControllerBase
{
    private readonly IIdeaAssistService _ideaAssist;

    public IdeaAssistController(IIdeaAssistService ideaAssist)
    {
        _ideaAssist = ideaAssist;
    }

    /// <summary>Advances the drafting conversation by one turn.</summary>
    /// <remarks>
    /// <c>503</c> means the assistant is unavailable — unconfigured, provider down, or the daily token
    /// budget is exhausted. The three are indistinguishable on purpose; clients degrade to the
    /// scripted brainstorm rather than surfacing an error.
    /// </remarks>
    [Authorize]
    [HttpPost("turns")]
    [ProducesResponseType(typeof(IdeaAssistTurnResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Continue(
        Guid boardId,
        [FromBody] IdeaAssistTurnRequestContract request,
        CancellationToken cancellationToken)
    {
        var result = await _ideaAssist.ContinueAsync(
            new IdeaAssistTurnRequest(
                boardId,
                request.Transcript.Select(t => new IdeaAssistTurn(t.Role, t.Text)).ToList(),
                ToDraft(request.Draft)),
            cancellationToken);

        return Ok(new IdeaAssistTurnResponse(
            result.InScope,
            result.ConversationClosed,
            result.NextQuestion,
            IdeaDraftContract.From(result.Draft),
            result.TurnsRemaining));
    }

    private static IdeaDraft? ToDraft(IdeaDraftContract? contract)
    {
        if (contract is null)
        {
            return null;
        }

        // A priority the client cannot parse is dropped rather than rejected — same forgiveness the
        // contract gives unknown option ids, and for the same reason.
        var priority = Enum.TryParse<Priority>(contract.Priority, ignoreCase: true, out var parsed)
            ? parsed
            : (Priority?)null;

        return new IdeaDraft(
            contract.Title,
            contract.Description,
            contract.IdeaTypeId,
            contract.BusinessImpactId,
            priority);
    }
}

/// <summary>
/// The organization's AI assist configuration — the scope statement an Org Admin tunes (D-SCOPE).
/// Its own controller so the route sits under <c>organizations/{organizationId}</c>.
/// </summary>
[ApiController]
[Route("organizations/{organizationId:guid}/ai-assist")]
public sealed class OrganizationAiAssistSettingsController : ControllerBase
{
    private readonly IIdeaAssistService _ideaAssist;

    public OrganizationAiAssistSettingsController(IIdeaAssistService ideaAssist)
    {
        _ideaAssist = ideaAssist;
    }

    /// <summary>Reads the configuration. Never returns a key or any part of one.</summary>
    [Authorize(Roles = "OrgAdmin,SiteAdmin")]
    [HttpGet("settings")]
    [ProducesResponseType(typeof(AiAssistSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSettings(Guid organizationId, CancellationToken cancellationToken)
    {
        var settings = await _ideaAssist.GetSettingsAsync(organizationId, cancellationToken);
        return Ok(new AiAssistSettingsResponse(settings.AiAssistAvailable, settings.ScopeStatement));
    }

    /// <summary>
    /// Sets or clears the scope statement. Takes effect on the next turn — in-flight conversations
    /// are not retroactively re-scoped.
    /// </summary>
    [Authorize(Roles = "OrgAdmin,SiteAdmin")]
    [HttpPut("settings")]
    [ProducesResponseType(typeof(AiAssistSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSettings(
        Guid organizationId,
        [FromBody] UpdateAiAssistSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var settings = await _ideaAssist.SetScopeStatementAsync(organizationId, request.ScopeStatement, cancellationToken);
        return Ok(new AiAssistSettingsResponse(settings.AiAssistAvailable, settings.ScopeStatement));
    }
}
