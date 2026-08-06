using System.ComponentModel.DataAnnotations;

namespace Collega.API.Validation;

/// <summary>
/// Drop-in replacement for <see cref="RequiredAttribute"/> that produces the contract-mandated
/// "&lt;FieldName&gt; is required." message instead of the framework default.
/// </summary>
public sealed class RequiredFieldAttribute : RequiredAttribute
{
    public override string FormatErrorMessage(string name) => ValidationMessages.Required(name);
}
