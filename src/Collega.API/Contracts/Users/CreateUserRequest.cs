using Collega.API.Validation;

namespace Collega.API.Contracts.Users;

/// <summary>Request shape for `POST /api/v1/organizations/{organizationId}/users`.</summary>
public sealed class CreateUserRequest
{
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
    public string Role { get; set; } = string.Empty;

    [RequiredField]
    public string InitialPassword { get; set; } = string.Empty;

    /// <summary>Optional; defaults to <c>Active</c>.</summary>
    public string? Status { get; set; }
}
