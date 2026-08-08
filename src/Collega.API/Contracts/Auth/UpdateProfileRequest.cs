using Collega.API.Validation;

namespace Collega.API.Contracts.Auth;

/// <summary>Request shape for `PUT /api/v1/auth/me` (SPEC/30-Contracts.md).</summary>
public sealed class UpdateProfileRequest
{
    [RequiredField]
    [MaxLengthField(100)]
    public string FirstName { get; set; } = string.Empty;

    [RequiredField]
    [MaxLengthField(100)]
    public string LastName { get; set; } = string.Empty;
}
