namespace Collega.Application.Common;

/// <summary>
/// Canonical paged-collection shape (SPEC/30-Contracts.md "Shared Data Rules"): serialized as
/// <c>items</c>, <c>page</c>, <c>pageSize</c>, <c>totalCount</c>, <c>sortBy</c>, <c>sortDirection</c>.
/// </summary>
public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    string? SortBy,
    string SortDirection);

/// <summary>
/// Normalized paging inputs shared by list use cases. Page is 1-based; page size is clamped to a
/// sane range so a caller can neither request page 0 nor an unbounded result set.
/// </summary>
public sealed record PageRequest
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public int Page { get; }
    public int PageSize { get; }

    public PageRequest(int? page, int? pageSize)
    {
        Page = page is > 0 ? page.Value : 1;
        var size = pageSize ?? DefaultPageSize;
        PageSize = Math.Clamp(size, 1, MaxPageSize);
    }

    public int Skip => (Page - 1) * PageSize;
}

/// <summary>Ascending/descending sort direction parsed from the contract's <c>asc</c>/<c>desc</c>.</summary>
public static class SortDirection
{
    public const string Ascending = "asc";
    public const string Descending = "desc";

    public static bool IsDescending(string? value) =>
        string.Equals(value?.Trim(), Descending, StringComparison.OrdinalIgnoreCase);

    public static string Normalize(string? value) => IsDescending(value) ? Descending : Ascending;
}
