using System.ComponentModel.DataAnnotations;

namespace Collega.API.Validation;

/// <summary>
/// Validates email format (delegates to <see cref="EmailAddressAttribute"/>, which is sealed and
/// so can't be subclassed directly) and produces the contract-mandated
/// "&lt;FieldName&gt; must be a valid email address." message.
/// </summary>
public sealed class EmailFormatAttribute : ValidationAttribute
{
    private static readonly EmailAddressAttribute Inner = new();

    public override bool IsValid(object? value) => Inner.IsValid(value);

    public override string FormatErrorMessage(string name) => ValidationMessages.InvalidFormat(name, "email address");
}
