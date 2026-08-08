namespace Collega.Application.IdeaFields;

// ---- Idea Type ----

public sealed record IdeaTypeItem(Guid IdeaTypeId, Guid OrganizationId, string Name, int SortOrder, bool IsDeleted);

public sealed record CreateIdeaTypeCommand(string Name, int? SortOrder);

public sealed record UpdateIdeaTypeCommand(string Name, int? SortOrder);

// ---- Business Impact ----

public sealed record BusinessImpactItem(Guid BusinessImpactId, Guid OrganizationId, string Name, string Color, int SortOrder, bool IsDeleted);

public sealed record CreateBusinessImpactCommand(string Name, string Color, int? SortOrder);

public sealed record UpdateBusinessImpactCommand(string Name, string Color, int? SortOrder);
