using Collega.API.Authentication;
using Collega.Application.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Only the P1 admin-issued temporary password reset (SPEC/30-Contracts.md
/// `POST /api/v1/users/{userId}/temporary-password`, auth requirement #12-13, T011). Full user
/// administration (CRUD, CSV import, list/detail) is a separate future slice — see
/// SPEC/implementation-agent-tracker.md "Tenant Administration Agent" — and is deliberately not
/// built here.
/// </summary>
[ApiController]
[Route("users")]
public sealed class UsersController : ControllerBase
{
    private readonly IAuthService _authService;

    public UsersController(IAuthService authService)
    {
        _authService = authService;
    }

    [Authorize]
    [HttpPost("{userId:guid}/temporary-password")]
    public async Task<IActionResult> IssueTemporaryPassword(Guid userId, CancellationToken cancellationToken)
    {
        var result = await _authService.IssueTemporaryPasswordAsync(userId, cancellationToken);
        return Ok(result);
    }
}
