namespace Collega.Application.IdeaFields;

// ---- Idea Type ----

/// <summary>
/// An Idea Type as returned by the admin surface. <see cref="FieldMode"/> is <c>AllActiveFields</c> or
/// <c>Curated</c>; <see cref="Fields"/> carries the curated selection (empty for an <c>AllActiveFields</c>
/// type). <see cref="ColorHex"/>/<see cref="Icon"/> drive the type badge.
/// </summary>
public sealed record IdeaTypeItem(
    Guid IdeaTypeId,
    Guid OrganizationId,
    string Name,
    int SortOrder,
    bool IsDeleted,
    string? ColorHex,
    string? Icon,
    string FieldMode,
    IReadOnlyList<IdeaTypeFieldItem> Fields);

/// <summary>One field in an Idea Type's curated selection.</summary>
public sealed record IdeaTypeFieldItem(Guid FieldDefinitionId, int DisplayOrder, bool IsRequired);

/// <summary>One entry in a replace-the-selection request.</summary>
public sealed record IdeaTypeFieldSelectionInput(Guid FieldDefinitionId, int DisplayOrder, bool IsRequired);

public sealed record CreateIdeaTypeCommand(string Name, int? SortOrder);

public sealed record UpdateIdeaTypeCommand(string Name, int? SortOrder);

// ---- Business Impact ----

public sealed record BusinessImpactItem(Guid BusinessImpactId, Guid OrganizationId, string Name, string Color, int SortOrder, bool IsDeleted);

public sealed record CreateBusinessImpactCommand(string Name, string Color, int? SortOrder);

public sealed record UpdateBusinessImpactCommand(string Name, string Color, int? SortOrder);
