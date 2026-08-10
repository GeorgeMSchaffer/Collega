using System;
using System.Collections.Generic;
using System.Linq;

namespace Collega.Client.Components;

/// <summary>Which slice of <c>ListToolbar</c> to render: the command-bar search box, or the pager below the table.</summary>
public enum ToolbarRegion
{
    Search,
    Pager,
}

/// <summary>
/// Client-side list state shared by the admin list pages (T-UI-2): all-column search, a page-size
/// selector, and prev/next paging over an already-loaded, fully-materialized collection. Pair it with
/// <c>ListToolbar</c>, which renders the controls and mutates this state. Business rules stay on the
/// server; this is presentation-only helper state.
/// </summary>
public sealed class ListState<T>
{
    private IReadOnlyList<T> _items = Array.Empty<T>();

    /// <summary>
    /// Projects a row to the text searched by <see cref="Search"/>. Concatenate every column the list
    /// shows so search covers all columns, not just the title. When null, search is a no-op.
    /// </summary>
    public Func<T, string?>? SearchText { get; init; }

    /// <summary>Page-size options offered by the toolbar. Defaults to the T-UI-2 set.</summary>
    public int[] PageSizeOptions { get; init; } = { 10, 25, 50, 100 };

    private int _pageSize = 25;
    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value > 0 ? value : 25;
    }

    /// <summary>1-based current page. Read <see cref="ClampedPage"/> for a value guaranteed in range.</summary>
    public int Page { get; set; } = 1;

    public string Search { get; set; } = "";

    /// <summary>Replaces the backing collection (e.g. after a load or reorder) and re-clamps the page.</summary>
    public void SetItems(IEnumerable<T> items)
    {
        _items = items as IReadOnlyList<T> ?? items.ToList();
        Page = Math.Clamp(Page, 1, PageCount);
    }

    public int TotalCount => _items.Count;

    /// <summary>All rows matching every whitespace-separated search term (case-insensitive, AND).</summary>
    public IReadOnlyList<T> Filtered
    {
        get
        {
            if (SearchText is null || string.IsNullOrWhiteSpace(Search))
            {
                return _items;
            }

            var terms = Search.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            return _items
                .Where(item =>
                {
                    var haystack = SearchText(item) ?? string.Empty;
                    return terms.All(term => haystack.Contains(term, StringComparison.OrdinalIgnoreCase));
                })
                .ToList();
        }
    }

    public int FilteredCount => Filtered.Count;

    public int PageCount => Math.Max(1, (int)Math.Ceiling(FilteredCount / (double)PageSize));

    public int ClampedPage => Math.Clamp(Page, 1, PageCount);

    /// <summary>The rows to render for the current page.</summary>
    public IReadOnlyList<T> PageItems
    {
        get
        {
            var filtered = Filtered;
            var pageCount = Math.Max(1, (int)Math.Ceiling(filtered.Count / (double)PageSize));
            var page = Math.Clamp(Page, 1, pageCount);
            return filtered.Skip((page - 1) * PageSize).Take(PageSize).ToList();
        }
    }

    public int RangeStart => FilteredCount == 0 ? 0 : ((ClampedPage - 1) * PageSize) + 1;

    public int RangeEnd => Math.Min(ClampedPage * PageSize, FilteredCount);

    /// <summary>True when no search is active and the whole list fits one page in its natural order.</summary>
    public bool ShowsAllInOrder =>
        string.IsNullOrWhiteSpace(Search) && FilteredCount == TotalCount && PageCount == 1;
}
