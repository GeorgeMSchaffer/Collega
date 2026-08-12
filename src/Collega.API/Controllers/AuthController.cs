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

    /// <summary>Authenticate with globally unique email credentials and return an access token.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.LoginAsync(new LoginCommand(request.Email, request.Password), cancellationToken);
        return Ok(result);
    }

    /// <summary>Return the currently authenticated user summary.</summary>
    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType(typeof(CurrentUserSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var summary = await _authService.GetCurrentUserAsync(User.GetUserId(), cancellationToken);
        return Ok(summary);
    }

    /// <summary>Update the currently authenticated user's editable profile fields.</summary>
    [Authorize]
    [HttpPut("me")]
    [ProducesResponseType(typeof(CurrentUserSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateProfileCommand(request.FirstName, request.LastName);
        var summary = await _authService.UpdateProfileAsync(User.GetUserId(), command, cancellationToken);
        return Ok(summary);
    }

    /// <summary>Upload/replace the current user's profile portrait (Base64 of the raw image file).</summary>
    [Authorize]
    [HttpPut("me/portrait")]
    [ProducesResponseType(typeof(CurrentUserSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdatePortrait([FromBody] UpdatePortraitRequest request, CancellationToken cancellationToken)
    {
        if (!TryDecodeBase64(request.ImageBase64, out var imageBytes))
        {
            ModelState.AddModelError(nameof(request.ImageBase64), "The uploaded image could not be read.");
            return ValidationProblem(ModelState);
        }

        var summary = await _authService.UpdatePortraitAsync(User.GetUserId(), imageBytes, cancellationToken);
        return Ok(summary);
    }

    /// <summary>Remove the current user's profile portrait, reverting to the initials avatar.</summary>
    [Authorize]
    [HttpDelete("me/portrait")]
    [ProducesResponseType(typeof(CurrentUserSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RemovePortrait(CancellationToken cancellationToken)
    {
        var summary = await _authService.RemovePortraitAsync(User.GetUserId(), cancellationToken);
        return Ok(summary);
    }

    private static bool TryDecodeBase64(string? value, out byte[] bytes)
    {
        bytes = Array.Empty<byte>();
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        // Accept a bare Base64 string or a full data URL (data:image/png;base64,....).
        var payload = value;
        var commaIndex = payload.IndexOf(',');
        if (payload.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && commaIndex >= 0)
        {
            payload = payload[(commaIndex + 1)..];
        }

        try
        {
            bytes = Convert.FromBase64String(payload);
            return bytes.Length > 0;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    /// <summary>Change the current user's password, including the first-login forced change.</summary>
    [Authorize]
    [HttpPost("change-password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var command = new ChangePasswordCommand(request.CurrentPassword, request.NewPassword);
        await _authService.ChangePasswordAsync(User.GetUserId(), command, cancellationToken);
        return NoContent();
    }

    /// <summary>Self-register a new user account using an organization invite code. Anonymous endpoint.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(RegisterResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        var command = new RegisterCommand(request.InviteCode, request.FirstName, request.LastName, request.Email, request.Password);
        var result = await _authService.RegisterAsync(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }
}
