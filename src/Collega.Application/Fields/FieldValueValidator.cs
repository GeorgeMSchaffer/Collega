using System.Globalization;
using Collega.Application.Exceptions;
using Collega.Domain.Fields;

namespace Collega.Application.Fields;

/// <summary>
/// Validates and normalizes User-Defined Field values submitted for an idea against the organization's
/// active field definitions (SPEC/20-feature-user-defined-fields.md "UDF Validation Rules"). Returns the
/// serialized values (as <see cref="IdeaFieldValueInput"/>) to persist, or throws
/// <see cref="ValidationAppException"/> with per-field messages. The returned set is authoritative:
/// fields with an empty value produce no row (the value is cleared).
/// </summary>
internal static class FieldValueValidator
{
    private const int TextMaxLength = 2000;
    private const int UrlMaxLength = 2048;
    private const string DateFormat = "yyyy-MM-dd";

    public static IReadOnlyList<IdeaFieldValueInput> Validate(
        IReadOnlyList<FieldDefinition> activeDefinitions,
        IReadOnlyList<IdeaFieldValueWrite>? submitted)
    {
        var definitionsById = activeDefinitions.ToDictionary(d => d.Id);
        var errors = new Dictionary<string, string[]>();

        // Last submission wins if a field id is repeated.
        var submittedById = new Dictionary<Guid, string?>();
        foreach (var value in submitted ?? Array.Empty<IdeaFieldValueWrite>())
        {
            if (value.FieldDefinitionId == Guid.Empty)
            {
                continue;
            }

            submittedById[value.FieldDefinitionId] = value.Value;
        }

        // A submitted value that targets an unknown or archived definition is rejected.
        foreach (var id in submittedById.Keys)
        {
            if (!definitionsById.ContainsKey(id))
            {
                AddError(errors, "fieldValues", $"'{id}' is not an active custom field for this organization.");
            }
        }

        var result = new List<IdeaFieldValueInput>();
        foreach (var definition in activeDefinitions)
        {
            submittedById.TryGetValue(definition.Id, out var raw);
            var trimmed = raw?.Trim();

            if (string.IsNullOrWhiteSpace(trimmed))
            {
                if (definition.IsRequired)
                {
                    AddError(errors, definition.Name, $"{definition.Name} is required.");
                }

                continue;
            }

            if (!TryNormalize(definition, trimmed!, out var normalized, out var error))
            {
                AddError(errors, definition.Name, error!);
                continue;
            }

            // A value that normalizes to empty (e.g. a MultiSelect made up only of separators) counts
            // as no value: it must still satisfy a required field, and is otherwise cleared (no row).
            if (string.IsNullOrEmpty(normalized))
            {
                if (definition.IsRequired)
                {
                    AddError(errors, definition.Name, $"{definition.Name} is required.");
                }

                continue;
            }

            // Guard the persisted length so an oversized value (e.g. a large MultiSelect) surfaces as a
            // 400 rather than an ArgumentException (HTTP 500) from IdeaFieldValue's constructor.
            if (normalized.Length > IdeaFieldValue.ValueMaxLength)
            {
                AddError(errors, definition.Name, $"{definition.Name} must be {IdeaFieldValue.ValueMaxLength} characters or fewer.");
                continue;
            }

            result.Add(new IdeaFieldValueInput(definition.Id, normalized));
        }

        if (errors.Count > 0)
        {
            throw new ValidationAppException(errors);
        }

        return result;
    }

    private static bool TryNormalize(FieldDefinition definition, string value, out string? normalized, out string? error)
    {
        normalized = null;
        error = null;

        switch (definition.FieldType)
        {
            case FieldType.Text:
                if (value.Length > TextMaxLength)
                {
                    error = $"{definition.Name} must be {TextMaxLength} characters or fewer.";
                    return false;
                }

                normalized = value;
                return true;

            case FieldType.Url:
                if (value.Length > UrlMaxLength
                    || !Uri.TryCreate(value, UriKind.Absolute, out var uri)
                    || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
                {
                    error = $"{definition.Name} must be a valid http or https URL.";
                    return false;
                }

                normalized = value;
                return true;

            case FieldType.Number:
                // Deliberately strict: a sign and a single decimal point only. Group separators are
                // rejected so "1,5" is not silently coerced to 15 under invariant culture.
                const NumberStyles numberStyles = NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint;
                if (!decimal.TryParse(value, numberStyles, CultureInfo.InvariantCulture, out var number))
                {
                    error = $"{definition.Name} must be a valid number.";
                    return false;
                }

                normalized = number.ToString(CultureInfo.InvariantCulture);
                return true;

            case FieldType.Date:
                if (!DateOnly.TryParseExact(value, DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                {
                    error = $"{definition.Name} must be a valid date (YYYY-MM-DD).";
                    return false;
                }

                normalized = date.ToString(DateFormat, CultureInfo.InvariantCulture);
                return true;

            case FieldType.Boolean:
                if (value.Equals("true", StringComparison.OrdinalIgnoreCase))
                {
                    normalized = "true";
                    return true;
                }

                if (value.Equals("false", StringComparison.OrdinalIgnoreCase))
                {
                    normalized = "false";
                    return true;
                }

                error = $"{definition.Name} must be true or false.";
                return false;

            case FieldType.Dropdown:
                if (!Guid.TryParse(value, out var optionId) || definition.Options.All(o => o.Id != optionId))
                {
                    error = $"{definition.Name} must be one of the field's options.";
                    return false;
                }

                normalized = optionId.ToString();
                return true;

            case FieldType.MultiSelect:
                return TryNormalizeMultiSelect(definition, value, out normalized, out error);

            default:
                error = $"{definition.Name} has an unsupported field type.";
                return false;
        }
    }

    private static bool TryNormalizeMultiSelect(FieldDefinition definition, string value, out string? normalized, out string? error)
    {
        normalized = null;
        error = null;

        var segments = value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var seen = new HashSet<Guid>();
        var ids = new List<string>(segments.Length);

        foreach (var segment in segments)
        {
            if (!Guid.TryParse(segment, out var optionId) || definition.Options.All(o => o.Id != optionId))
            {
                error = $"{definition.Name} must contain only the field's options.";
                return false;
            }

            if (!seen.Add(optionId))
            {
                error = $"{definition.Name} must not repeat an option.";
                return false;
            }

            ids.Add(optionId.ToString());
        }

        normalized = string.Join(",", ids);
        return true;
    }

    private static void AddError(Dictionary<string, string[]> errors, string key, string message)
    {
        errors[key] = errors.TryGetValue(key, out var existing)
            ? existing.Append(message).ToArray()
            : new[] { message };
    }
}
