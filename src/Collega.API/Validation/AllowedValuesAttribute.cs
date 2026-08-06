using System.ComponentModel.DataAnnotations;

namespace Collega.API.Validation;

/// <summary>
/// Validates that a string value is one of a fixed allow-list (typically an enum's serialized
/// names), producing the contract-mandated
/// "&lt;FieldName&gt; must be one of: &lt;Value1&gt;, &lt;Value2&gt;, &lt;Value3&gt;." message.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class AllowedValuesAttribute : ValidationAttribute
{
    private readonly string[] _allowedValues;

    public AllowedValuesAttribute(params string[] allowedValues)
    {
        _allowedValues = allowedValues;
    }

    public override bool IsValid(object? value)
    {
        // Absence is a separate concern owned by RequiredFieldAttribute.
        if (value is null)
        {
            return true;
        }

        return value is string stringValue &&
               _allowedValues.Any(allowed => string.Equals(allowed, stringValue, StringComparison.Ordinal));
    }

    public override string FormatErrorMessage(string name) => ValidationMessages.InvalidEnumValue(name, _allowedValues);
}
