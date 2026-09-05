using Collega.Application.Abstractions;
using Collega.Application.Ai;
using Collega.Application.Common;
using Collega.Domain.Ai;
using Collega.Domain.Boards;
using Collega.Domain.Comments;
using Collega.Domain.Enums;
using Collega.Domain.Fields;
using Collega.Domain.IdeaFields;
using Collega.Domain.Ideas;
using Collega.Domain.Organizations;
using Collega.Domain.Statuses;
using Collega.Domain.Tags;
using Collega.Domain.Upvotes;
using Collega.Domain.Users;
using Collega.Domain.Impersonation;

namespace Collega.Application.Tests.TestDoubles;

/// <summary>In-memory <see cref="IUserRepository"/>. Entities are held by reference so mutations by a
/// use case are observable after the (no-op) unit-of-work commit.</summary>
internal sealed class FakeUserRepository : IUserRepository
{
    public List<User> Users { get; } = new();

    public FakeUserRepository(params User[] users) => Users.AddRange(users);

    public User Add(User user)
    {
        Users.Add(user);
        return user;
    }

    public Task<User?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Users.FirstOrDefault(u => u.Id == userId));

    public Task<User?> GetByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default) =>
        Task.FromResult(Users.FirstOrDefault(u => u.NormalizedEmail == normalizedEmail));

    public Task<bool> ExistsByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default) =>
        Task.FromResult(Users.Any(u => u.NormalizedEmail == normalizedEmail));

    public Task<bool> AnySiteAdminAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(Users.Any(u => u.Role == Role.SiteAdmin));

    public Task<PagedResult<User>> ListByOrganizationAsync(UserListFilter filter, CancellationToken cancellationToken = default)
    {
        IEnumerable<User> query = Users.Where(u => u.OrganizationId == filter.OrganizationId);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim();
            query = query.Where(u =>
                u.FirstName.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                u.LastName.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                u.Email.Contains(s, StringComparison.OrdinalIgnoreCase));
        }

        if (filter.Role is not null)
        {
            query = query.Where(u => u.Role == filter.Role);
        }

        if (filter.Status is not null)
        {
            query = query.Where(u => u.Status == filter.Status);
        }

        var all = query.OrderBy(u => u.LastName).ThenBy(u => u.FirstName).ToList();
        var items = all.Skip(filter.Page.Skip).Take(filter.Page.PageSize).ToList();
        return Task.FromResult(new PagedResult<User>(items, filter.Page.Page, filter.Page.PageSize, all.Count, filter.SortBy, SortDirection.Normalize(filter.SortDirection)));
    }

    public Task<IReadOnlyList<User>> ListByIdsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default)
    {
        var set = userIds.ToHashSet();
        IReadOnlyList<User> result = Users.Where(u => set.Contains(u.Id)).ToList();
        return Task.FromResult(result);
    }

    public Task<IReadOnlyList<User>> SearchForImpersonationAsync(Guid? organizationId, string? search, CancellationToken cancellationToken = default)
    {
        IEnumerable<User> users = Users.Where(u => u.OrganizationId is not null && u.Role != Collega.Domain.Enums.Role.SiteAdmin);

        if (organizationId is not null)
        {
            users = users.Where(u => u.OrganizationId == organizationId);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            users = users.Where(u =>
                u.FirstName.Contains(term, StringComparison.OrdinalIgnoreCase)
                || u.LastName.Contains(term, StringComparison.OrdinalIgnoreCase)
                || u.Email.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        return Task.FromResult<IReadOnlyList<User>>(
            users.OrderBy(u => u.FirstName).ThenBy(u => u.LastName).ToList());
    }

    public Task<int> CountActiveOrgAdminsAsync(Guid organizationId, Guid? excludingUserId = null, CancellationToken cancellationToken = default) =>
        Task.FromResult(Users.Count(u =>
            u.OrganizationId == organizationId &&
            u.Role == Role.OrgAdmin &&
            u.Status == UserStatus.Active &&
            (excludingUserId == null || u.Id != excludingUserId)));

    public Task AddAsync(User user, CancellationToken cancellationToken = default)
    {
        Users.Add(user);
        return Task.CompletedTask;
    }
}

internal sealed class FakeOrganizationRepository : IOrganizationRepository
{
    public List<Organization> Organizations { get; } = new();

    public FakeOrganizationRepository(params Organization[] organizations) => Organizations.AddRange(organizations);

    public Organization Add(Organization organization)
    {
        Organizations.Add(organization);
        return organization;
    }

    public Task<Organization?> GetByIdAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Organizations.FirstOrDefault(o => o.Id == organizationId));

    public Task<Organization?> GetByInviteCodeAsync(string inviteCode, CancellationToken cancellationToken = default) =>
        Task.FromResult(Organizations.FirstOrDefault(o => o.InviteCode == inviteCode));

    public Task<PagedResult<Organization>> ListAsync(OrganizationListFilter filter, CancellationToken cancellationToken = default)
    {
        IEnumerable<Organization> query = Organizations;
        if (!filter.IncludeArchived)
        {
            query = query.Where(o => !o.IsArchived);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim();
            query = query.Where(o =>
                o.Title.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                o.Description.Contains(s, StringComparison.OrdinalIgnoreCase));
        }

        var all = query.OrderBy(o => o.Title).ToList();
        var items = all.Skip(filter.Page.Skip).Take(filter.Page.PageSize).ToList();
        return Task.FromResult(new PagedResult<Organization>(items, filter.Page.Page, filter.Page.PageSize, all.Count, filter.SortBy, SortDirection.Normalize(filter.SortDirection)));
    }

    public Task<bool> InviteCodeExistsAsync(string inviteCode, CancellationToken cancellationToken = default) =>
        Task.FromResult(Organizations.Any(o => o.InviteCode == inviteCode));

    public Task AddAsync(Organization organization, CancellationToken cancellationToken = default)
    {
        Organizations.Add(organization);
        return Task.CompletedTask;
    }
}

internal sealed class FakeStatusRepository : IStatusRepository
{
    public List<Status> Statuses { get; } = new();

    public FakeStatusRepository(params Status[] statuses) => Statuses.AddRange(statuses);

    public Status Add(Status status)
    {
        Statuses.Add(status);
        return status;
    }

    public Task AddAsync(Status status, CancellationToken cancellationToken = default)
    {
        Statuses.Add(status);
        return Task.CompletedTask;
    }

    public Task AddRangeAsync(IEnumerable<Status> statuses, CancellationToken cancellationToken = default)
    {
        Statuses.AddRange(statuses);
        return Task.CompletedTask;
    }

    public Task<Status?> GetByIdAsync(Guid statusId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Statuses.FirstOrDefault(s => s.Id == statusId));

    public Task<IReadOnlyList<Status>> ListActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<Status> result = Statuses
            .Where(s => s.OrganizationId == organizationId && !s.IsDeleted)
            .OrderBy(s => s.SortOrder)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<IReadOnlyList<Status>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<Status> result = Statuses
            .Where(s => s.OrganizationId == organizationId && (includeDeleted || !s.IsDeleted))
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Name)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<int> CountActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Statuses.Count(s => s.OrganizationId == organizationId && !s.IsDeleted));
}

internal sealed class FakeBoardRepository : IBoardRepository
{
    public List<Board> Boards { get; } = new();

    public FakeBoardRepository(params Board[] boards) => Boards.AddRange(boards);

    public Board Add(Board board)
    {
        Boards.Add(board);
        return board;
    }

    public Task AddAsync(Board board, CancellationToken cancellationToken = default)
    {
        Boards.Add(board);
        return Task.CompletedTask;
    }

    public Task<Board?> GetByIdAsync(Guid boardId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Boards.FirstOrDefault(b => b.Id == boardId));

    public Task<IReadOnlyList<Board>> ListByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<Board> result = Boards.Where(b => b.OrganizationId == organizationId).OrderBy(b => b.Name).ToList();
        return Task.FromResult(result);
    }

    public Task<bool> IsStatusReferencedAsync(Guid statusId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Boards.Any(b => b.Swimlanes.Any(sl => sl.StatusId == statusId)));
}

internal sealed class FakeIdeaTypeRepository : IIdeaTypeRepository
{
    public List<IdeaType> Options { get; } = new();

    public FakeIdeaTypeRepository(params IdeaType[] options) => Options.AddRange(options);

    public IdeaType Add(IdeaType option)
    {
        Options.Add(option);
        return option;
    }

    public Task AddAsync(IdeaType option, CancellationToken cancellationToken = default)
    {
        Options.Add(option);
        return Task.CompletedTask;
    }

    public Task AddRangeAsync(IEnumerable<IdeaType> options, CancellationToken cancellationToken = default)
    {
        Options.AddRange(options);
        return Task.CompletedTask;
    }

    public Task<IdeaType?> GetByIdAsync(Guid ideaTypeId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Options.FirstOrDefault(o => o.Id == ideaTypeId));

    public Task<IReadOnlyList<IdeaType>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<IdeaType> result = Options
            .Where(o => o.OrganizationId == organizationId && (includeDeleted || !o.IsDeleted))
            .OrderBy(o => o.SortOrder)
            .ThenBy(o => o.Name)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<int> CountActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Options.Count(o => o.OrganizationId == organizationId && !o.IsDeleted));
}

internal sealed class FakeBusinessImpactRepository : IBusinessImpactRepository
{
    public List<BusinessImpact> Options { get; } = new();

    public FakeBusinessImpactRepository(params BusinessImpact[] options) => Options.AddRange(options);

    public BusinessImpact Add(BusinessImpact option)
    {
        Options.Add(option);
        return option;
    }

    public Task AddAsync(BusinessImpact option, CancellationToken cancellationToken = default)
    {
        Options.Add(option);
        return Task.CompletedTask;
    }

    public Task AddRangeAsync(IEnumerable<BusinessImpact> options, CancellationToken cancellationToken = default)
    {
        Options.AddRange(options);
        return Task.CompletedTask;
    }

    public Task<BusinessImpact?> GetByIdAsync(Guid businessImpactId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Options.FirstOrDefault(o => o.Id == businessImpactId));

    public Task<IReadOnlyList<BusinessImpact>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<BusinessImpact> result = Options
            .Where(o => o.OrganizationId == organizationId && (includeDeleted || !o.IsDeleted))
            .OrderBy(o => o.SortOrder)
            .ThenBy(o => o.Name)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<int> CountActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Options.Count(o => o.OrganizationId == organizationId && !o.IsDeleted));
}

/// <summary>Configurable <see cref="IBoardReader"/> backed by explicit board contexts and status info.</summary>
internal sealed class FakeBoardReader : IBoardReader
{
    public Dictionary<Guid, BoardContext> Boards { get; } = new();
    public Dictionary<Guid, Dictionary<Guid, StatusInfo>> StatusInfoByOrg { get; } = new();

    public void AddBoard(BoardContext board) => Boards[board.BoardId] = board;

    public void AddStatusInfo(Guid organizationId, StatusInfo info)
    {
        if (!StatusInfoByOrg.TryGetValue(organizationId, out var map))
        {
            map = new Dictionary<Guid, StatusInfo>();
            StatusInfoByOrg[organizationId] = map;
        }

        map[info.StatusId] = info;
    }

    public Task<BoardContext?> GetBoardContextAsync(Guid boardId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Boards.TryGetValue(boardId, out var b) ? b : null);

    public Task<IReadOnlyDictionary<Guid, StatusInfo>> GetStatusInfoAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        IReadOnlyDictionary<Guid, StatusInfo> result = StatusInfoByOrg.TryGetValue(organizationId, out var map)
            ? map
            : new Dictionary<Guid, StatusInfo>();
        return Task.FromResult(result);
    }
}

internal sealed class FakeIdeaRepository : IIdeaRepository
{
    public List<Idea> Ideas { get; } = new();

    public FakeIdeaRepository(params Idea[] ideas) => Ideas.AddRange(ideas);

    public Idea Add(Idea idea)
    {
        Ideas.Add(idea);
        return idea;
    }

    public Task<Idea?> GetByIdAsync(Guid ideaId, bool includeDeleted = false, CancellationToken cancellationToken = default) =>
        Task.FromResult(Ideas.FirstOrDefault(i => i.Id == ideaId && (includeDeleted || !i.IsDeleted)));

    public Task AddAsync(Idea idea, CancellationToken cancellationToken = default)
    {
        Ideas.Add(idea);
        return Task.CompletedTask;
    }

    public Task<PagedResult<Idea>> ListByBoardAsync(IdeaListFilter filter, CancellationToken cancellationToken = default)
    {
        IEnumerable<Idea> query = Ideas.Where(i => i.BoardId == filter.BoardId && !i.IsDeleted);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim();
            query = query.Where(i => i.Title.Contains(s, StringComparison.OrdinalIgnoreCase));
        }

        if (filter.StatusId is not null)
        {
            query = query.Where(i => i.StatusId == filter.StatusId);
        }

        if (filter.Priority is not null)
        {
            query = query.Where(i => i.Priority == filter.Priority);
        }

        var all = query.OrderBy(i => i.CreatedAtUtc).ToList();
        var items = all.Skip(filter.Page.Skip).Take(filter.Page.PageSize).ToList();
        return Task.FromResult(new PagedResult<Idea>(items, filter.Page.Page, filter.Page.PageSize, all.Count, filter.SortBy, SortDirection.Normalize(filter.SortDirection)));
    }

    /// <summary>The most recent org-list filter, so tests can assert the Application layer's mapping
    /// (scope/user/tag/date-search) without needing the real store.</summary>
    public OrganizationIdeaListFilter? LastOrganizationFilter { get; private set; }

    public Task<PagedResult<Idea>> ListByOrganizationAsync(OrganizationIdeaListFilter filter, CancellationToken cancellationToken = default)
    {
        LastOrganizationFilter = filter;

        IEnumerable<Idea> query = Ideas.Where(i => i.OrganizationId == filter.OrganizationId && !i.IsDeleted);

        if (filter.CreatedByUserId is Guid createdBy)
        {
            query = query.Where(i => i.AuthorUserId == createdBy);
        }

        if (filter.AssignedToUserId is Guid assignedTo)
        {
            query = query.Where(i => i.Assignees.Any(a => a.UserId == assignedTo));
        }

        if (filter.AssociatedUserId is Guid associatedUser)
        {
            query = query.Where(i => i.AuthorUserId == associatedUser
                || i.Assignees.Any(a => a.UserId == associatedUser));
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim();
            query = query.Where(i => i.Title.Contains(s, StringComparison.OrdinalIgnoreCase));
        }

        var ordered = filter.SortBy?.Trim().ToLowerInvariant() == "title"
            ? (SortDirection.IsDescending(filter.SortDirection) ? query.OrderByDescending(i => i.Title) : query.OrderBy(i => i.Title))
            : (SortDirection.IsDescending(filter.SortDirection) ? query.OrderByDescending(i => i.CreatedAtUtc) : query.OrderBy(i => i.CreatedAtUtc));

        var all = ordered.ToList();
        var items = all.Skip(filter.Page.Skip).Take(filter.Page.PageSize).ToList();
        return Task.FromResult(new PagedResult<Idea>(items, filter.Page.Page, filter.Page.PageSize, all.Count, filter.SortBy, SortDirection.Normalize(filter.SortDirection)));
    }

    public Task<bool> ExistsByTitleOnBoardAsync(Guid boardId, string normalizedTitle, CancellationToken cancellationToken = default) =>
        Task.FromResult(Ideas.Any(i => i.BoardId == boardId && !i.IsDeleted && i.Title.ToLowerInvariant() == normalizedTitle));

    public Task<IReadOnlyList<IdeaFieldValueSnapshot>> GetFieldValuesByIdeaIdsAsync(IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default)
    {
        var ids = ideaIds.ToHashSet();
        IReadOnlyList<IdeaFieldValueSnapshot> result = Ideas
            .Where(i => ids.Contains(i.Id))
            .SelectMany(i => i.FieldValues.Select(v => new IdeaFieldValueSnapshot(i.Id, v.FieldDefinitionId, v.Value)))
            .ToList();
        return Task.FromResult(result);
    }
}

internal sealed class FakeIdeaUpvoteRepository : IIdeaUpvoteRepository
{
    public List<IdeaUpvote> Upvotes { get; } = new();

    public Task<IdeaUpvote?> GetAsync(Guid ideaId, Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Upvotes.FirstOrDefault(u => u.IdeaId == ideaId && u.UserId == userId));

    public Task AddAsync(IdeaUpvote upvote, CancellationToken cancellationToken = default)
    {
        Upvotes.Add(upvote);
        return Task.CompletedTask;
    }

    public void Remove(IdeaUpvote upvote) => Upvotes.Remove(upvote);

    public Task<int> CountByIdeaAsync(Guid ideaId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Upvotes.Count(u => u.IdeaId == ideaId));

    public Task<IReadOnlyDictionary<Guid, int>> CountByIdeaIdsAsync(IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default)
    {
        var set = ideaIds.ToHashSet();
        IReadOnlyDictionary<Guid, int> result = Upvotes
            .Where(u => set.Contains(u.IdeaId))
            .GroupBy(u => u.IdeaId)
            .ToDictionary(g => g.Key, g => g.Count());
        return Task.FromResult(result);
    }

    public Task<IReadOnlySet<Guid>> GetUpvotedIdeaIdsAsync(Guid userId, IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default)
    {
        var set = ideaIds.ToHashSet();
        IReadOnlySet<Guid> result = Upvotes
            .Where(u => u.UserId == userId && set.Contains(u.IdeaId))
            .Select(u => u.IdeaId)
            .ToHashSet();
        return Task.FromResult(result);
    }
}

internal sealed class FakeCommentRepository : ICommentRepository
{
    public List<Comment> Comments { get; } = new();

    public FakeCommentRepository(params Comment[] comments) => Comments.AddRange(comments);

    public Comment Add(Comment comment)
    {
        Comments.Add(comment);
        return comment;
    }

    public Task<Comment?> GetByIdAsync(Guid commentId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Comments.FirstOrDefault(c => c.Id == commentId));

    public Task AddAsync(Comment comment, CancellationToken cancellationToken = default)
    {
        Comments.Add(comment);
        return Task.CompletedTask;
    }

    public void Remove(Comment comment) => Comments.Remove(comment);

    public Task<PagedResult<Comment>> ListByIdeaAsync(CommentListFilter filter, CancellationToken cancellationToken = default)
    {
        var descending = SortDirection.IsDescending(filter.SortDirection);
        var ordered = descending
            ? Comments.Where(c => c.IdeaId == filter.IdeaId).OrderByDescending(c => c.CreatedAtUtc).ThenByDescending(c => c.Id).ToList()
            : Comments.Where(c => c.IdeaId == filter.IdeaId).OrderBy(c => c.CreatedAtUtc).ThenBy(c => c.Id).ToList();

        var items = ordered.Skip(filter.Page.Skip).Take(filter.Page.PageSize).ToList();
        return Task.FromResult(new PagedResult<Comment>(items, filter.Page.Page, filter.Page.PageSize, ordered.Count, "createdAtUtc", SortDirection.Normalize(filter.SortDirection)));
    }

    public Task<int> CountByIdeaAsync(Guid ideaId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Comments.Count(c => c.IdeaId == ideaId));

    public Task<IReadOnlyDictionary<Guid, int>> CountByIdeaIdsAsync(IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default)
    {
        var set = ideaIds.ToHashSet();
        IReadOnlyDictionary<Guid, int> result = Comments
            .Where(c => set.Contains(c.IdeaId))
            .GroupBy(c => c.IdeaId)
            .ToDictionary(g => g.Key, g => g.Count());
        return Task.FromResult(result);
    }
}

/// <summary>In-memory <see cref="ITagRepository"/> reproducing the get-or-create merge and prefix search.</summary>
internal sealed class FakeTagRepository : ITagRepository
{
    public List<Tag> Tags { get; } = new();

    public FakeTagRepository(params Tag[] tags) => Tags.AddRange(tags);

    public Tag Add(Tag tag)
    {
        Tags.Add(tag);
        return tag;
    }

    public Task<IReadOnlyList<Tag>> ListByIdsAsync(IReadOnlyCollection<Guid> tagIds, CancellationToken cancellationToken = default)
    {
        var set = tagIds.ToHashSet();
        IReadOnlyList<Tag> result = Tags.Where(t => set.Contains(t.Id)).ToList();
        return Task.FromResult(result);
    }

    public Task<IReadOnlyList<Tag>> GetOrCreateAsync(Guid organizationId, IReadOnlyCollection<string> requestedNames, DateTime nowUtc, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var byNormalized = requestedNames
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .GroupBy(Tag.Normalize)
            .ToDictionary(g => g.Key, g => g.First().Trim());

        var result = new List<Tag>();
        foreach (var (normalized, display) in byNormalized)
        {
            var existing = Tags.FirstOrDefault(t => t.OrganizationId == organizationId && t.NormalizedName == normalized);
            if (existing is null)
            {
                existing = Tag.Create(organizationId, display, nowUtc, actorUserId);
                Tags.Add(existing);
            }

            result.Add(existing);
        }

        return Task.FromResult<IReadOnlyList<Tag>>(result);
    }

    public Task<IReadOnlyList<string>> SearchByPrefixAsync(Guid organizationId, string normalizedPrefix, int limit, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<string> result = Tags
            .Where(t => t.OrganizationId == organizationId && t.NormalizedName.StartsWith(normalizedPrefix, StringComparison.Ordinal))
            .OrderBy(t => t.NormalizedName, StringComparer.Ordinal)
            .Take(limit)
            .Select(t => t.Name)
            .ToList();
        return Task.FromResult(result);
    }
}

/// <summary>In-memory <see cref="IFieldDefinitionRepository"/> for User-Defined Field use-case tests.</summary>
internal sealed class FakeFieldDefinitionRepository : IFieldDefinitionRepository
{
    public List<FieldDefinition> Definitions { get; } = new();

    public FakeFieldDefinitionRepository(params FieldDefinition[] definitions) => Definitions.AddRange(definitions);

    public FieldDefinition Add(FieldDefinition definition)
    {
        Definitions.Add(definition);
        return definition;
    }

    public Task AddAsync(FieldDefinition definition, CancellationToken cancellationToken = default)
    {
        Definitions.Add(definition);
        return Task.CompletedTask;
    }

    public Task<FieldDefinition?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(Definitions.FirstOrDefault(d => d.Id == id));

    public Task<IReadOnlyList<FieldDefinition>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<FieldDefinition> result = Definitions
            .Where(d => d.OrganizationId == organizationId && (includeDeleted || !d.IsDeleted))
            .OrderBy(d => d.DisplayOrder)
            .ThenBy(d => d.Name)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<IReadOnlyList<FieldDefinition>> ListActiveTrackedByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<FieldDefinition> result = Definitions
            .Where(d => d.OrganizationId == organizationId && !d.IsDeleted)
            .OrderBy(d => d.DisplayOrder)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<bool> ExistsActiveByNameAsync(Guid organizationId, string name, Guid? excludeId, CancellationToken cancellationToken = default)
    {
        var normalized = name.Trim();
        return Task.FromResult(Definitions.Any(d =>
            d.OrganizationId == organizationId
            && !d.IsDeleted
            && string.Equals(d.Name, normalized, StringComparison.OrdinalIgnoreCase)
            && (excludeId == null || d.Id != excludeId)));
    }
}

/// <summary>In-memory <see cref="IImpersonationSessionRepository"/> for the View As tests.</summary>
internal sealed class FakeImpersonationSessionRepository : IImpersonationSessionRepository
{
    public List<ImpersonationSession> Sessions { get; } = new();

    /// <summary>
    /// Mirrors the EF implementation: returns the open row whether or not it has expired, because
    /// liveness is the caller's decision. A fake that filtered expired rows would hide the very
    /// close-and-record-why path the resolver depends on.
    /// </summary>
    public Task<ImpersonationSession?> GetOpenForRealUserAsync(Guid realUserId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Sessions
            .Where(s => s.RealUserId == realUserId && s.EndedAtUtc is null)
            .OrderByDescending(s => s.StartedAtUtc)
            .FirstOrDefault());

    public Task AddAsync(ImpersonationSession session, CancellationToken cancellationToken = default)
    {
        Sessions.Add(session);
        return Task.CompletedTask;
    }
}

/// <summary>
/// In-memory <see cref="IAiUsageRepository"/>. Aggregates from the same rows the service writes, so
/// a test can assert the budget gate and the report against one another rather than against a stub
/// number. Organization names are resolved from <see cref="Names"/>, mirroring the EF repository's
/// second-pass lookup — there is no FK, so an unknown id is a deleted organization, not an error.
/// </summary>
internal sealed class FakeAiUsageRepository : IAiUsageRepository
{
    public List<AiUsageRecord> Records { get; } = new();

    public Dictionary<Guid, string> Names { get; } = new();

    public Task AddAsync(AiUsageRecord record, CancellationToken cancellationToken = default)
    {
        Records.Add(record);
        return Task.CompletedTask;
    }

    public Task<long> GetTotalTokensSinceAsync(DateTime fromUtc, CancellationToken cancellationToken = default) =>
        Task.FromResult(Records.Where(r => r.OccurredAtUtc >= fromUtc).Sum(r => (long)r.TotalTokens));

    public Task<AiCallCounts> CountCallsSinceAsync(
        Guid organizationId,
        Guid? actorUserId,
        DateTime fromUtc,
        CancellationToken cancellationToken = default)
    {
        var inWindow = Records
            .Where(r => r.OrganizationId == organizationId && r.OccurredAtUtc >= fromUtc)
            .ToList();

        return Task.FromResult(new AiCallCounts(
            inWindow.Count,
            inWindow.Count(r => actorUserId is not null && r.ActorUserId == actorUserId)));
    }

    public Task<IReadOnlyList<AiCallOutcome>> GetRecentOutcomesAsync(
        Guid organizationId,
        Guid? actorUserId,
        Guid boardId,
        int limit,
        DateTime fromUtc,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<AiCallOutcome> outcomes = Records
            .Where(r => r.OrganizationId == organizationId
                        && r.BoardId == boardId
                        && r.ActorUserId == actorUserId
                        && r.OccurredAtUtc >= fromUtc)
            .OrderByDescending(r => r.OccurredAtUtc)
            .Take(limit)
            .Select(r => r.Outcome)
            .ToList();

        return Task.FromResult(outcomes);
    }

    public Task<IReadOnlyList<AiUsageSummary>> GetUsageByOrganizationAsync(
        DateTime fromUtc,
        DateTime toUtc,
        Guid? organizationId = null,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<AiUsageSummary> result = Records
            .Where(r => r.OccurredAtUtc >= fromUtc && r.OccurredAtUtc <= toUtc)
            .Where(r => organizationId is null || r.OrganizationId == organizationId)
            .GroupBy(r => r.OrganizationId)
            .Select(g => new AiUsageSummary(
                g.Key,
                Names.TryGetValue(g.Key, out var name) ? name : "(deleted organization)",
                g.Count(),
                g.Sum(r => (long)r.InputTokens),
                g.Sum(r => (long)r.OutputTokens),
                g.Sum(r => (long)r.CacheReadInputTokens),
                g.Sum(r => (long)r.CacheCreationInputTokens),
                g.Sum(r => r.EstimatedCost())))
            .OrderByDescending(s => s.TotalTokens)
            .ToList();

        return Task.FromResult(result);
    }
}
