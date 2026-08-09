using Collega.API.Authentication;
using Collega.API.Contracts.Users;
using Collega.Application.Auth;
using Collega.Application.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// User detail/update by id (SPEC/30-Contracts.md "User Contracts") plus the P1 admin-issued
/// temporary password reset. Org-scoped user list/create/CSV-import live on <see cref="OrganizationsController"/>
/// under `/organizations/{organizationId}/users`.
/// </summary>
[ApiController]
[Authorize]
[Route("users")]
public sealed class UsersController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IUserService _userService;

    public UsersController(IAuthService authService, IUserService userService)
    {
        _authService = authService;
        _userService = userService;
    }

    /// <summary>Return user detail within the caller's authorized scope.</summary>
    [HttpGet("{userId:guid}")]
    [ProducesResponseType(typeof(UserDetail), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid userId, CancellationToken cancellationToken)
    {
        var result = await _userService.GetByIdAsync(userId, cancellationToken);
        return Ok(result);
    }

    /// <summary>Update user profile, role, or status within the caller's authorized scope.</summary>
    [HttpPut("{userId:guid}")]
    [ProducesResponseType(typeof(UserDetail), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid userId, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateUserCommand(request.FirstName, request.LastName, request.Email, request.Role, request.Status);
        var result = await _userService.UpdateAsync(userId, command, cancellationToken);
        return Ok(result);
    }

    /// <summary>Issue a one-time admin-generated temporary password for the target user.</summary>
    [HttpPost("{userId:guid}/temporary-password")]
    [ProducesResponseType(typeof(TemporaryPasswordResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> IssueTemporaryPassword(Guid userId, CancellationToken cancellationToken)
    {
        var result = await _authService.IssueTemporaryPasswordAsync(userId, cancellationToken);
        return Ok(result);
    }
}
