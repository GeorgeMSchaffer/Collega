using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Domain.Ideas;
using Collega.Domain.Tags;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

public sealed class EfIdeaRepository : IIdeaRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfIdeaRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Idea?> GetByIdAsync(Guid ideaId, bool includeDeleted = false, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Ideas
            .Include(i => i.Assignees)
            .Include(i => i.Tags)
            .Include(i => i.Mentions)
            .Include(i => i.FieldValues)
            .AsQueryable();

        if (!includeDeleted)
        {
            query = query.Where(i => !i.IsDeleted);
        }

        return await query.FirstOrDefaultAsync(i => i.Id == ideaId, cancellationToken);
    }

    public async Task AddAsync(Idea idea, CancellationToken cancellationToken = default) =>
        await _dbContext.Ideas.AddAsync(idea, cancellationToken);

    public async Task<PagedResult<Idea>> ListByBoardAsync(IdeaListFilter filter, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Ideas
            .AsNoTracking()
            .Include(i => i.Assignees)
            .Include(i => i.Tags)
            .Where(i => i.BoardId == filter.BoardId && !i.IsDeleted);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim();
            query = query.Where(i => EF.Functions.Like(i.Title, $"%{search}%"));
        }

        if (filter.StatusId is not null)
        {
            query = query.Where(i => i.StatusId == filter.StatusId);
        }

        if (filter.Priority is not null)
        {
            query = query.Where(i => i.Priority == filter.Priority);
        }

        if (filter.DueBefore is not null)
        {
            query = query.Where(i => i.DueDate != null && i.DueDate < filter.DueBefore);
        }

        if (!string.IsNullOrWhiteSpace(filter.Tag))
        {
            var normalizedTag = Tag.Normalize(filter.Tag);
            query = query.Where(i => i.Tags.Any(it =>
                _dbContext.Tags.Any(t => t.Id == it.TagId && t.NormalizedName == normalizedTag)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var descending = SortDirection.IsDescending(filter.SortDirection);
        query = (filter.SortBy?.Trim().ToLowerInvariant()) switch
        {
            "updatedat" => descending ? query.OrderByDescending(i => i.UpdatedAtUtc) : query.OrderBy(i => i.UpdatedAtUtc),
            "priority" => descending ? query.OrderByDescending(i => i.Priority) : query.OrderBy(i => i.Priority),
            "duedate" => descending ? query.OrderByDescending(i => i.DueDate) : query.OrderBy(i => i.DueDate),
            "upvotecount" => descending
                ? query.OrderByDescending(i => _dbContext.IdeaUpvotes.Count(u => u.IdeaId == i.Id))
                : query.OrderBy(i => _dbContext.IdeaUpvotes.Count(u => u.IdeaId == i.Id)),
            _ => descending ? query.OrderByDescending(i => i.CreatedAtUtc) : query.OrderBy(i => i.CreatedAtUtc)
        };

        var items = await query
            .Skip(filter.Page.Skip)
            .Take(filter.Page.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Idea>(
            items,
            filter.Page.Page,
            filter.Page.PageSize,
            totalCount,
            filter.SortBy,
            SortDirection.Normalize(filter.SortDirection));
    }

    public async Task<PagedResult<Idea>> ListByOrganizationAsync(OrganizationIdeaListFilter filter, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Ideas
            .AsNoTracking()
            .Include(i => i.Assignees)
            .Include(i => i.Tags)
            .Where(i => i.OrganizationId == filter.OrganizationId && !i.IsDeleted);

        if (filter.CreatedByUserId is Guid createdBy)
        {
            query = query.Where(i => i.AuthorUserId == createdBy);
        }

        if (filter.AssignedToUserId is Guid assignedTo)
        {
            query = query.Where(i => i.Assignees.Any(a => a.UserId == assignedTo));
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var pattern = $"%{filter.Search.Trim()}%";
            var textFieldIds = filter.SearchTextFieldIds ?? Array.Empty<Guid>();
            // The global search matches the title or any of the idea's Text/Url UDF values (T059).
            query = query.Where(i => EF.Functions.Like(i.Title, pattern)
                || _dbContext.IdeaFieldValues.Any(v => v.IdeaId == i.Id
                    && textFieldIds.Contains(v.FieldDefinitionId)
                    && v.Value != null
                    && EF.Functions.Like(v.Value, pattern)));
        }

        foreach (var fieldFilter in filter.FieldFilters ?? Array.Empty<IdeaFieldValueFilter>())
        {
            query = ApplyFieldFilter(query, fieldFilter);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var descending = SortDirection.IsDescending(filter.SortDirection);
        query = (filter.SortBy?.Trim().ToLowerInvariant()) switch
        {
            "title" => descending ? query.OrderByDescending(i => i.Title) : query.OrderBy(i => i.Title),
            _ => descending ? query.OrderByDescending(i => i.CreatedAtUtc) : query.OrderBy(i => i.CreatedAtUtc)
        };

        var items = await query
            .Skip(filter.Page.Skip)
            .Take(filter.Page.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Idea>(
            items,
            filter.Page.Page,
            filter.Page.PageSize,
            totalCount,
            filter.SortBy,
            SortDirection.Normalize(filter.SortDirection));
    }

    // Applies one typed User-Defined Field predicate as an EXISTS subquery over IdeaFieldValues (T059).
    // Number range converts the stored invariant-decimal string (EF Core translates Convert.ToDecimal to
    // SQL CONVERT); Date range compares the ISO yyyy-MM-dd strings, whose lexical order is chronological.
    private IQueryable<Idea> ApplyFieldFilter(IQueryable<Idea> query, IdeaFieldValueFilter f)
    {
        var id = f.FieldDefinitionId;
        return f.Kind switch
        {
            IdeaFieldFilterKind.Contains => query.Where(i => _dbContext.IdeaFieldValues.Any(v =>
                v.IdeaId == i.Id && v.FieldDefinitionId == id && v.Value != null
                && EF.Functions.Like(v.Value, $"%{f.Value}%"))),

            IdeaFieldFilterKind.Equals => query.Where(i => _dbContext.IdeaFieldValues.Any(v =>
                v.IdeaId == i.Id && v.FieldDefinitionId == id && v.Value == f.Value)),

            IdeaFieldFilterKind.MultiSelectContains => query.Where(i => _dbContext.IdeaFieldValues.Any(v =>
                v.IdeaId == i.Id && v.FieldDefinitionId == id && v.Value != null
                && EF.Functions.Like("," + v.Value + ",", "%," + f.Value + ",%"))),

            IdeaFieldFilterKind.NumberRange => query.Where(i => _dbContext.IdeaFieldValues.Any(v =>
                v.IdeaId == i.Id && v.FieldDefinitionId == id && v.Value != null
                && (f.Min == null || Convert.ToDecimal(v.Value) >= f.Min)
                && (f.Max == null || Convert.ToDecimal(v.Value) <= f.Max))),

            IdeaFieldFilterKind.DateRange => query.Where(i => _dbContext.IdeaFieldValues.Any(v =>
                v.IdeaId == i.Id && v.FieldDefinitionId == id && v.Value != null
                && (f.MinText == null || string.Compare(v.Value, f.MinText) >= 0)
                && (f.MaxText == null || string.Compare(v.Value, f.MaxText) <= 0))),

            _ => query,
        };
    }

    public Task<bool> ExistsByTitleOnBoardAsync(Guid boardId, string normalizedTitle, CancellationToken cancellationToken = default) =>
        _dbContext.Ideas.AnyAsync(
            i => i.BoardId == boardId && !i.IsDeleted && i.Title.ToLower() == normalizedTitle,
            cancellationToken);

    public async Task<IReadOnlyList<IdeaFieldValueSnapshot>> GetFieldValuesByIdeaIdsAsync(IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default)
    {
        if (ideaIds.Count == 0)
        {
            return Array.Empty<IdeaFieldValueSnapshot>();
        }

        var ids = ideaIds.ToList();
        return await _dbContext.IdeaFieldValues
            .AsNoTracking()
            .Where(v => ids.Contains(v.IdeaId))
            .Select(v => new IdeaFieldValueSnapshot(v.IdeaId, v.FieldDefinitionId, v.Value))
            .ToListAsync(cancellationToken);
    }
}
