namespace Collega.Client.Services;

// Wire DTOs for the organization-managed Idea Type / Business Impact option lists
// (SPEC/30-Contracts.md "Idea Field Option Contracts"). These are the required classification fields
// on every idea; the idea create/edit forms populate their selectors from these. Guids travel as
// JSON strings. Kept in their own file per the client's per-area DTO convention.

/// <summary>An Idea Type option row from <c>GET /organizations/{orgId}/idea-types</c>.</summary>
public sealed record IdeaTypeOptionDto(
    string IdeaTypeId,
    string OrganizationId,
    string Name,
    int SortOrder,
    bool IsDeleted);

/// <summary>Body for creating/updating an Idea Type (<c>POST/PUT .../idea-types</c>). <c>SortOrder</c> is
/// optional on create (appended to the end when omitted).</summary>
public sealed record SaveIdeaTypeRequestDto(string Name, int? SortOrder);

/// <summary>Body for <c>POST .../idea-types/reorder</c> — the new catalog order by id.</summary>
public sealed record ReorderIdeaTypesRequestDto(List<string> OrderedIdeaTypeIds);

/// <summary>A Business Impact option row from <c>GET /organizations/{orgId}/business-impacts</c>.</summary>
public sealed record BusinessImpactOptionDto(
    string BusinessImpactId,
    string Name,
    string Color,
    int SortOrder,
    bool IsDeleted);
