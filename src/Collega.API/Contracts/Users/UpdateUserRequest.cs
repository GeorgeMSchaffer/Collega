using Collega.API.Validation;

namespace Collega.API.Contracts.Users;

/// <summary>Request shape for `PUT /api/v1/users/{userId}`.</summary>
public sealed class UpdateUserRequest
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
    public string Status { get; set; } = string.Empty;
}
