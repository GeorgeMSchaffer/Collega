using Collega.API.Authentication;
using Collega.API.Contracts.Users;
using Collega.Application.Auth;
using Collega.Application.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// User detail/update by id (SPEC/30-Contracts.md "User Contracts") plus the P1 admin-issued
/// temporary password reset. Org-scoped user list/create live on <see cref="OrganizationsController"/>
/// under `/organizations/{organizationId}/users`. CSV import is a separate follow-up.
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

    [HttpGet("{userId:guid}")]
    public async Task<IActionResult> GetById(Guid userId, CancellationToken cancellationToken)
    {
        var result = await _userService.GetByIdAsync(userId, cancellationToken);
        return Ok(result);
    }

    [HttpPut("{userId:guid}")]
    public async Task<IActionResult> Update(Guid userId, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateUserCommand(request.FirstName, request.LastName, request.Email, request.Role, request.Status);
        var result = await _userService.UpdateAsync(userId, command, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{userId:guid}/temporary-password")]
    public async Task<IActionResult> IssueTemporaryPassword(Guid userId, CancellationToken cancellationToken)
    {
        var result = await _authService.IssueTemporaryPasswordAsync(userId, cancellationToken);
        return Ok(result);
    }
}
