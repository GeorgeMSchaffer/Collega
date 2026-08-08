namespace Collega.Application.Fields;

/// <summary>A selectable option on a Dropdown/MultiSelect field definition.</summary>
public sealed record FieldOptionModel(Guid OptionId, string Label, int DisplayOrder);

/// <summary>
/// Read model for an organization User-Defined Field definition
/// (SPEC/20-feature-user-defined-fields.md). <see cref="FieldType"/> is the serialized enum name.
/// </summary>
public sealed record FieldDefinitionModel(
    Guid FieldDefinitionId,
    Guid OrganizationId,
    string Name,
    string? Description,
    string FieldType,
    bool IsRequired,
    int DisplayOrder,
    bool IsDeleted,
    IReadOnlyList<FieldOptionModel> Options);

/// <summary>
/// One option in a create/update command. A non-null <see cref="OptionId"/> targets an existing
/// option so its identity (and any idea values referencing it) survives the edit.
/// </summary>
public sealed record FieldOptionCommand(Guid? OptionId, string Label, int DisplayOrder);

public sealed record CreateFieldDefinitionCommand(
    string Name,
    string? Description,
    string FieldType,
    bool IsRequired,
    int? DisplayOrder,
    IReadOnlyList<FieldOptionCommand> Options);

/// <summary><see cref="FieldType"/> is immutable after creation; a differing value is rejected.</summary>
public sealed record UpdateFieldDefinitionCommand(
    string Name,
    string? Description,
    string FieldType,
    bool IsRequired,
    int? DisplayOrder,
    IReadOnlyList<FieldOptionCommand> Options);

public sealed record ReorderFieldDefinitionsCommand(IReadOnlyList<Guid> OrderedIds);
