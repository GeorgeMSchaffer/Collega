using Collega.API.Validation;

namespace Collega.API.Contracts.Auth;

/// <summary>Request shape for `POST /api/v1/auth/login` (SPEC/30-Contracts.md).</summary>
public sealed class LoginRequest
{
    [RequiredField]
    public string Email { get; set; } = string.Empty;

    [RequiredField]
    public string Password { get; set; } = string.Empty;
}
