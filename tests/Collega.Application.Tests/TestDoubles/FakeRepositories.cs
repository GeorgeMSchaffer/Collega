using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Domain.Boards;
using Collega.Domain.Comments;
using Collega.Domain.Enums;
using Collega.Domain.Ideas;
using Collega.Domain.Organizations;
using Collega.Domain.Statuses;
using Collega.Domain.Tags;
using Collega.Domain.Upvotes;
using Collega.Domain.Users;

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

    public Task<PagedResult<Idea>> ListByOrganizationAsync(OrganizationIdeaListFilter filter, CancellationToken cancellationToken = default)
    {
        IEnumerable<Idea> query = Ideas.Where(i => i.OrganizationId == filter.OrganizationId && !i.IsDeleted);

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
