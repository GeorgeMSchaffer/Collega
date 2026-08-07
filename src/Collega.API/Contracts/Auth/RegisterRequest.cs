using Collega.API.Validation;

namespace Collega.API.Contracts.Auth;

/// <summary>Request shape for `POST /api/v1/auth/register` (SPEC/30-Contracts.md).</summary>
public sealed class RegisterRequest
{
    [RequiredField]
    public string InviteCode { get; set; } = string.Empty;

    [RequiredField]
    [MaxLengthField(100)]
    public string FirstName { get; set; } = string.Empty;

    [RequiredField]
    [MaxLengthField(100)]
    public string LastName { get; set; } = string.Empty;

    [RequiredField]
    [EmailFormat]
    public string Email { get; set; } = string.Empty;

    [RequiredField]
    public string Password { get; set; } = string.Empty;
}
