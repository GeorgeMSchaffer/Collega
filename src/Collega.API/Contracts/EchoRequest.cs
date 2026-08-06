using Collega.API.Validation;

namespace Collega.API.Contracts;

/// <summary>
/// Pipeline-verification DTO only — proves the custom validation attributes and the
/// problem-details error envelope work end to end. Not a product feature.
/// </summary>
public sealed class EchoRequest
{
    [RequiredField]
    [MaxLengthField(200)]
    public string Message { get; set; } = string.Empty;
}
