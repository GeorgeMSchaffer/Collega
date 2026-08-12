using Collega.Domain.Common;

namespace Collega.Domain.Fields;

/// <summary>
/// An organization-owned User-Defined Field schema entry (SPEC/20-feature-user-defined-fields.md).
/// The field schema is shared across every board in the organization; admins manage definitions,
/// all members fill values on ideas. <see cref="FieldType"/> is fixed at creation because stored
/// <c>IdeaFieldValue</c>s are interpreted by it. Deletion is a soft delete (rule: values are
/// preserved but hidden from forms/filters), so existing values and audit history stay valid.
/// </summary>
public sealed class FieldDefinition : AuditableEntityBase
{
    public const int NameMaxLength = 100;
    public const int DescriptionMaxLength = 500;

    private readonly List<FieldDefinitionOption> _options = new();

    public Guid OrganizationId { get; private set; }
    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// Lower-cased, trimmed form of <see cref="Name"/>, carrying the unique index that keeps active
    /// field names distinct case-insensitively within an organization.
    /// </summary>
    /// <remarks>
    /// Follows the same pattern as <c>Tag.NormalizedName</c> and <c>User.NormalizedEmail</c>: the
    /// comparison lives in a column rather than in a collation. That mattered when the database moved
    /// from SQL Server to PostgreSQL — the old index sat on the raw name and only rejected
    /// case-variant duplicates because SQL Server's default collation is case-insensitive, which
    /// PostgreSQL's is not. The application layer has always compared case-insensitively; this keeps
    /// the database enforcing the same rule instead of leaving a window where two concurrent creates
    /// of <c>Cost</c> and <c>cost</c> both commit.
    /// </remarks>
    public string NormalizedName { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public FieldType FieldType { get; private set; }
    public bool IsRequired { get; private set; }
    public int DisplayOrder { get; private set; }

    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAtUtc { get; private set; }
    public Guid? DeletedByUserId { get; private set; }

    public IReadOnlyList<FieldDefinitionOption> Options => _options;

    /// <summary>Dropdown and MultiSelect are the only types that own selectable options.</summary>
    public bool IsOptionBacked => FieldType is FieldType.Dropdown or FieldType.MultiSelect;

    private FieldDefinition()
    {
    }

    public static FieldDefinition Create(
        Guid organizationId,
        string name,
        string? description,
        FieldType fieldType,
        bool isRequired,
        int displayOrder,
        IReadOnlyList<FieldOptionInput> options,
        DateTime nowUtc,
        Guid? actorUserId = null)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ArgumentException("Organization id is required.", nameof(organizationId));
        }

        if (!Enum.IsDefined(fieldType))
        {
            throw new ArgumentException("Unknown field type.", nameof(fieldType));
        }

        var definition = new FieldDefinition
        {
            OrganizationId = organizationId,
            Name = NormalizeName(name),
            NormalizedName = Normalize(name),
            Description = NormalizeDescription(description),
            FieldType = fieldType,
            IsRequired = isRequired,
            DisplayOrder = displayOrder
        };

        definition.ApplyOptions(options ?? Array.Empty<FieldOptionInput>());
        definition.MarkCreated(nowUtc, actorUserId);
        return definition;
    }

    /// <summary>Updates the editable scalar attributes. <see cref="FieldType"/> is immutable.</summary>
    public void Update(
        string name,
        string? description,
        bool isRequired,
        int displayOrder,
        DateTime nowUtc,
        Guid? actorUserId = null)
    {
        EnsureNotDeleted();

        Name = NormalizeName(name);
        NormalizedName = Normalize(name);
        Description = NormalizeDescription(description);
        IsRequired = isRequired;
        DisplayOrder = displayOrder;
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>Sets only the display order (used by reorder), leaving all other attributes intact.</summary>
    public void SetDisplayOrder(int displayOrder, DateTime nowUtc, Guid? actorUserId = null)
    {
        EnsureNotDeleted();
        DisplayOrder = displayOrder;
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>
    /// Reconciles this field's options to <paramref name="options"/>: existing options are matched by
    /// <see cref="FieldOptionInput.Id"/> and updated in place (preserving identity for idea values that
    /// reference them), unmatched inputs create new options, and existing options absent from the input
    /// set are removed. Only valid for option-backed types, which must retain at least one option.
    /// </summary>
    public void SetOptions(IReadOnlyList<FieldOptionInput> options, DateTime nowUtc, Guid? actorUserId = null)
    {
        EnsureNotDeleted();
        ApplyOptions(options ?? Array.Empty<FieldOptionInput>());
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>Soft-deletes (archives) the definition. Idempotent; values are preserved.</summary>
    public void SoftDelete(DateTime nowUtc, Guid? actorUserId = null)
    {
        if (IsDeleted)
        {
            return;
        }

        IsDeleted = true;
        DeletedAtUtc = nowUtc;
        DeletedByUserId = actorUserId;
        MarkUpdated(nowUtc, actorUserId);
    }

    private void ApplyOptions(IReadOnlyList<FieldOptionInput> options)
    {
        if (!IsOptionBacked)
        {
            if (options.Count > 0)
            {
                throw new InvalidOperationException($"A {FieldType} field cannot have options.");
            }

            _options.Clear();
            return;
        }

        if (options.Count == 0)
        {
            throw new InvalidOperationException($"A {FieldType} field must have at least one option.");
        }

        var labels = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var reconciled = new List<FieldDefinitionOption>(options.Count);
        foreach (var input in options)
        {
            var trimmedLabel = (input.Label ?? string.Empty).Trim();
            if (!labels.Add(trimmedLabel))
            {
                throw new InvalidOperationException($"Option labels must be unique; '{trimmedLabel}' is duplicated.");
            }

            if (input.Id is Guid id && _options.FirstOrDefault(o => o.Id == id) is { } existing)
            {
                existing.Update(trimmedLabel, input.DisplayOrder);
                reconciled.Add(existing);
            }
            else
            {
                reconciled.Add(new FieldDefinitionOption(Id, trimmedLabel, input.DisplayOrder));
            }
        }

        _options.Clear();
        _options.AddRange(reconciled);
    }

    private void EnsureNotDeleted()
    {
        if (IsDeleted)
        {
            throw new InvalidOperationException("A deleted field definition cannot be modified.");
        }
    }

    /// <summary>Trims surrounding whitespace and lower-cases, for case-insensitive comparison.</summary>
    public static string Normalize(string? name) => name?.Trim().ToLowerInvariant() ?? string.Empty;

    private static string NormalizeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            throw new ArgumentException($"Name must be {NameMaxLength} characters or fewer.", nameof(name));
        }

        return trimmed;
    }

    private static string? NormalizeDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description))
        {
            return null;
        }

        var trimmed = description.Trim();
        if (trimmed.Length > DescriptionMaxLength)
        {
            throw new ArgumentException($"Description must be {DescriptionMaxLength} characters or fewer.", nameof(description));
        }

        return trimmed;
    }
}
