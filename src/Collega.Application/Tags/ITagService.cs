namespace Collega.Application.Tags;

/// <summary>
/// Tag autocomplete use case (SPEC/30-Contracts.md "Tag Contracts"). Tag creation itself happens
/// implicitly when an idea is saved, so this service only serves organization-scoped suggestions.
/// </summary>
public interface ITagService
{
    /// <summary>
    /// Returns organization-scoped tag names whose normalized form starts with the search prefix,
    /// ordered alphabetically. Autocomplete begins after 2 characters
    /// (SPEC/20-feature-ideas-and-engagement.md "Tags" #4).
    /// </summary>
    Task<IReadOnlyList<string>> SuggestAsync(Guid organizationId, string search, int? limit, CancellationToken cancellationToken = default);
}
