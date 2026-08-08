namespace Collega.Application.Statuses;

/// <summary>
/// Create a status. <c>Color</c> and <c>SortOrder</c> are optional: color defaults to the
/// organization's neutral status color and sort order appends to the end of the catalog. Both are
/// admin-editable per SPEC/20-feature-boards-and-statuses.md rules #9-10.
/// </summary>
public sealed record CreateStatusCommand(string Name, string? Color, int? SortOrder);

public sealed record UpdateStatusCommand(string Name, string? Color, int? SortOrder);

/// <summary>
/// Status item shape. The canonical contract lists <c>statusId</c>/<c>organizationId</c>/<c>name</c>/
/// <c>isDeleted</c>; <c>color</c> and <c>sortOrder</c> are included as a superset because rules #9-10
/// make them first-class status attributes (the contract's Status section predates that resolution).
/// </summary>
public sealed record StatusItem(
    Guid StatusId,
    Guid OrganizationId,
    string Name,
    string Color,
    int SortOrder,
    bool IsDeleted);

public sealed record CreateStatusResult(Guid StatusId, string Name, string Color, int SortOrder);
