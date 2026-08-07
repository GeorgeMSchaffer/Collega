using Collega.API.Validation;

namespace Collega.API.Contracts.Auth;

/// <summary>Request shape for `POST /api/v1/auth/change-password` (SPEC/30-Contracts.md).</summary>
public sealed class ChangePasswordRequest
{
    [RequiredField]
    public string CurrentPassword { get; set; } = string.Empty;

    [RequiredField]
    public string NewPassword { get; set; } = string.Empty;
}
