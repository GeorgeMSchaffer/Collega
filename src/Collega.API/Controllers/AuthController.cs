using Collega.API.Authentication;
using Collega.API.Contracts.Auth;
using Collega.Application.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Auth endpoints per SPEC/30-Contracts.md "Authentication Contracts". Controllers stay thin —
/// all business rules (lockout, complexity, invite-code resolution, audit emission) live in
/// <see cref="IAuthService"/> (Collega.Application).
/// </summary>
[ApiController]
[Route("auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.LoginAsync(new LoginCommand(request.Email, request.Password), cancellationToken);
        return Ok(result);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var summary = await _authService.GetCurrentUserAsync(User.GetUserId(), cancellationToken);
        return Ok(summary);
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var command = new ChangePasswordCommand(request.CurrentPassword, request.NewPassword);
        await _authService.ChangePasswordAsync(User.GetUserId(), command, cancellationToken);
        return NoContent();
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        var command = new RegisterCommand(request.InviteCode, request.FirstName, request.LastName, request.Email, request.Password);
        var result = await _authService.RegisterAsync(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }
}
