namespace Collega.API.Validation;

/// <summary>
/// Canonical validation message templates from SPEC/30-Contracts.md "Validation Message
/// Conventions". Custom validation attributes in this namespace build their messages through
/// this class so request DTOs across every future feature area produce identical wording.
/// </summary>
public static class ValidationMessages
{
    public static string Required(string fieldName) =>
        $"{fieldName} is required.";

    public static string MaxLength(string fieldName, int maxLength) =>
        $"{fieldName} must be {maxLength} characters or fewer.";

    public static string MinLength(string fieldName, int minLength) =>
        $"{fieldName} must be at least {minLength} characters.";

    public static string InvalidFormat(string fieldName, string formatName) =>
        $"{fieldName} must be a valid {formatName}.";

    public static string InvalidEnumValue(string fieldName, IEnumerable<string> allowedValues) =>
        $"{fieldName} must be one of: {string.Join(", ", allowedValues)}.";

    public static string Range(string fieldName, object minValue, object maxValue) =>
        $"{fieldName} must be between {minValue} and {maxValue}.";
}
