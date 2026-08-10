using System.Globalization;
using Collega.Application.Exceptions;
using Collega.Domain.Fields;
using Collega.Domain.IdeaFields;

namespace Collega.Application.Fields;

/// <summary>
/// Validates and normalizes User-Defined Field values submitted for an idea against the fields resolved
/// for its idea type (SPEC/20-feature-idea-type-fields.md "Value scoping"). Each resolved field carries
/// its effective required-ness (per-type for a curated type, global otherwise). Returns the serialized
/// values (as <see cref="IdeaFieldValueInput"/>) to persist, or throws <see cref="ValidationAppException"/>
/// with per-field messages. The returned set is authoritative: fields with an empty value produce no row.
/// </summary>
internal static class FieldValueValidator
{
    private const int TextMaxLength = 2000;
    private const int UrlMaxLength = 2048;
    private const string DateFormat = "yyyy-MM-dd";

    /// <param name="effectiveFields">The fields resolved for the idea's type, each with its effective required flag.</param>
    /// <param name="submitted">Raw values submitted with the idea payload.</param>
    /// <param name="knownFieldNames">
    /// Optional id→name lookup for all active org fields, used to name a value submitted for a field that
    /// exists but is not in this type's resolved set. When a submitted id is unknown here, the id is shown.
    /// </param>
    public static IReadOnlyList<IdeaFieldValueInput> Validate(
        IReadOnlyList<EffectiveField> effectiveFields,
        IReadOnlyList<IdeaFieldValueWrite>? submitted,
        IReadOnlyDictionary<Guid, string>? knownFieldNames = null)
    {
        var resolvedById = effectiveFields.ToDictionary(f => f.Field.Id);
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

        // A submitted value for a field outside this type's resolved set is rejected (value scoping).
        foreach (var id in submittedById.Keys)
        {
            if (!resolvedById.ContainsKey(id))
            {
                var name = knownFieldNames is not null && knownFieldNames.TryGetValue(id, out var known) ? known : null;
                AddError(errors, "fieldValues", name is not null
                    ? $"\"{name}\" is not a field for this idea type."
                    : $"'{id}' is not an active custom field for this organization.");
            }
        }

        var result = new List<IdeaFieldValueInput>();
        foreach (var effective in effectiveFields)
        {
            var definition = effective.Field;
            submittedById.TryGetValue(definition.Id, out var raw);
            var trimmed = raw?.Trim();

            if (string.IsNullOrWhiteSpace(trimmed))
            {
                if (effective.Required)
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
                if (effective.Required)
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
