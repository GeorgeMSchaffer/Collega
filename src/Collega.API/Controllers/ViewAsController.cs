using Collega.API.Authentication;
using Collega.API.Contracts.Auth;
using Collega.Application.Impersonation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// View As endpoints per SPEC/30-Contracts.md "View As Contracts". Controllers stay thin — the
/// authorization matrix, non-nestability, expiry and audit all live in
/// <see cref="IViewAsService"/> (Collega.Application).
/// </summary>
/// <remarks>
/// These are the only endpoints that act on the caller's <b>real</b> identity while a session is
/// live. Everywhere else the request acts as the impersonated user
/// (SPEC/20-feature-view-as.md rule 4).
///
/// Deliberately NOT on the mandatory-password-rotation allowlist: an administrator who still owes a
/// rotation is refused by <see cref="PasswordChangeRequiredFilter"/> before reaching these, so they
/// cannot use impersonation to work around their own gate.
/// </remarks>
[ApiController]
[Route("auth/view-as")]
[Authorize]
public sealed class ViewAsController : ControllerBase
{
    private readonly IViewAsService _viewAsService;

    public ViewAsController(IViewAsService viewAsService)
    {
        _viewAsService = viewAsService;
    }

    /// <summary>Start acting as another user.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(StartViewAsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<StartViewAsResponse>> Start(StartViewAsRequest request, CancellationToken cancellationToken)
    {
        var result = await _viewAsService.StartAsync(request.TargetUserId, cancellationToken);
        return Ok(new StartViewAsResponse(result.TargetUserId, result.StartedAtUtc, result.ExpiresAtUtc));
    }

    /// <summary>
    /// Stop acting as another user. Idempotent by contract — calling it with no active session also
    /// returns 204, so a client that has lost track of state can always get back to a known-good
    /// position without having to handle an error.
    /// </summary>
    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> End(CancellationToken cancellationToken)
    {
        await _viewAsService.EndAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>Users the caller may act as, already filtered to what they are permitted to target.</summary>
    [HttpGet("candidates")]
    [ProducesResponseType(typeof(IReadOnlyList<ViewAsCandidateResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<ViewAsCandidateResponse>>> Candidates(
        [FromQuery] string? search, CancellationToken cancellationToken)
    {
        var candidates = await _viewAsService.ListCandidatesAsync(search, cancellationToken);
        return Ok(candidates.Select(c => new ViewAsCandidateResponse(
            c.UserId, c.FirstName, c.LastName, c.Email, c.Role.ToString(), c.Status.ToString(),
            c.OrganizationId, c.OrganizationName, c.Selectable)).ToList());
    }
}
