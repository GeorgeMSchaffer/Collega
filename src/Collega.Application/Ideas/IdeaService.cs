using System.Globalization;
using System.Text.Json;
using Collega.Application.Abstractions;
using Collega.Application.Collaboration;
using Collega.Application.Common;
using Collega.Application.Exceptions;
using Collega.Application.Fields;
using Collega.Domain.Auditing;
using Collega.Domain.Comments;
using Collega.Domain.Enums;
using Collega.Domain.Fields;
using Collega.Domain.Ideas;
using Collega.Domain.Notifications;
using Collega.Domain.Tags;
using Collega.Domain.Upvotes;
using Collega.Domain.Users;

namespace Collega.Application.Ideas;

/// <summary>
/// Idea and upvote use cases (SPEC/20-feature-ideas-and-engagement.md). Enforces organization
/// scoping, idea-edit vs. description/assignee authorization, board-configured User status moves
/// (rule #34), keeping Complete ideas editable (rule #35), and audit emission (rule #36).
/// </summary>
public sealed class IdeaService : IIdeaService
{
    private const string DueDateFormat = "yyyy-MM-dd";

    private readonly IIdeaRepository _ideaRepository;
    private readonly IBoardReader _boardReader;
    private readonly ITagRepository _tagRepository;
    private readonly IIdeaUpvoteRepository _upvoteRepository;
    private readonly ICommentRepository _commentRepository;
    private readonly IUserRepository _userRepository;
    private readonly IFieldDefinitionRepository _fieldDefinitionRepository;
    private readonly IMentionResolver _mentionResolver;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditEventWriter _auditEventWriter;
    private readonly INotificationEventWriter _notificationWriter;
    private readonly ICurrentUserContext _currentUser;
    private readonly IClock _clock;

    public IdeaService(
        IIdeaRepository ideaRepository,
        IBoardReader boardReader,
        ITagRepository tagRepository,
        IIdeaUpvoteRepository upvoteRepository,
        ICommentRepository commentRepository,
        IUserRepository userRepository,
        IFieldDefinitionRepository fieldDefinitionRepository,
        IMentionResolver mentionResolver,
        IUnitOfWork unitOfWork,
        IAuditEventWriter auditEventWriter,
        INotificationEventWriter notificationWriter,
        ICurrentUserContext currentUser,
        IClock clock)
    {
        _ideaRepository = ideaRepository;
        _boardReader = boardReader;
        _tagRepository = tagRepository;
        _upvoteRepository = upvoteRepository;
        _commentRepository = commentRepository;
        _userRepository = userRepository;
        _fieldDefinitionRepository = fieldDefinitionRepository;
        _mentionResolver = mentionResolver;
        _unitOfWork = unitOfWork;
        _auditEventWriter = auditEventWriter;
        _notificationWriter = notificationWriter;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<PagedResult<IdeaListItem>> ListByBoardAsync(Guid boardId, IdeaListQuery query, CancellationToken cancellationToken = default)
    {
        RequireAuthenticatedRole();

        var board = await _boardReader.GetBoardContextAsync(boardId, cancellationToken)
            ?? throw new NotFoundAppException("Board not found.");
        EnsureOrganizationScope(board.OrganizationId);

        var filter = new IdeaListFilter(
            boardId,
            new PageRequest(query.Page, query.PageSize),
            query.Search?.Trim(),
            query.StatusId,
            query.Tag?.Trim(),
            ParseOptionalPriority(query.Priority),
            ParseOptionalDate(query.DueBefore),
            query.SortBy,
            query.SortDirection);

        var page = await _ideaRepository.ListByBoardAsync(filter, cancellationToken);
        var items = await ProjectListItemsAsync(board.OrganizationId, page.Items, cancellationToken);

        return new PagedResult<IdeaListItem>(items, page.Page, page.PageSize, page.TotalCount, page.SortBy, page.SortDirection);
    }

    public async Task<PagedResult<IdeaListItem>> ListByOrganizationAsync(Guid organizationId, OrganizationIdeaListQuery query, CancellationToken cancellationToken = default)
    {
        RequireAuthenticatedRole();
        EnsureOrganizationScope(organizationId);

        var currentUserId = RequireAuthenticatedUserId();
        var scope = query.Scope?.Trim().ToLowerInvariant();
        var createdBy = scope == "created" ? currentUserId : (Guid?)null;
        var assignedTo = scope == "assigned" ? currentUserId : (Guid?)null;

        var filter = new OrganizationIdeaListFilter(
            organizationId,
            createdBy,
            assignedTo,
            new PageRequest(query.Page, query.PageSize),
            query.Search?.Trim(),
            query.SortBy,
            query.SortDirection);

        var page = await _ideaRepository.ListByOrganizationAsync(filter, cancellationToken);
        var items = await ProjectListItemsAsync(organizationId, page.Items, cancellationToken);

        return new PagedResult<IdeaListItem>(items, page.Page, page.PageSize, page.TotalCount, page.SortBy, page.SortDirection);
    }

    public async Task<CreateIdeaResult> CreateAsync(Guid boardId, CreateIdeaCommand command, CancellationToken cancellationToken = default)
    {
        RequireIdeaEditRole();

        var board = await _boardReader.GetBoardContextAsync(boardId, cancellationToken)
            ?? throw new NotFoundAppException("Board not found.");
        EnsureOrganizationScope(board.OrganizationId);

        var now = _clock.UtcNow;
        var authorId = RequireAuthenticatedUserId();
        var priority = ParsePriority(command.Priority);
        var dueDate = ParseDueDate(command.DueDate);

        var statusId = command.StatusId ?? board.LeftMostStatusId
            ?? throw new ValidationAppException("statusId", new[] { "The board has no swimlanes to place the idea in." });
        if (!board.HasSwimlaneForStatus(statusId))
        {
            throw new ValidationAppException("statusId", new[] { "Status must be an active swimlane on the board." });
        }

        var assigneeIds = await ResolveAssigneesAsync(board.OrganizationId, command.AssigneeUserIds, Array.Empty<Guid>(), cancellationToken);
        var tagIds = await ResolveTagsAsync(board.OrganizationId, command.TagNames, now, authorId, cancellationToken);
        var mentionIds = await _mentionResolver.ResolveAsync(board.OrganizationId, command.MentionEmails, "mentionEmails", cancellationToken);

        var fieldDefinitions = await _fieldDefinitionRepository.ListByOrganizationAsync(board.OrganizationId, includeDeleted: false, cancellationToken);
        var fieldValues = FieldValueValidator.Validate(fieldDefinitions, command.FieldValues);

        var idea = Idea.Create(
            board.OrganizationId,
            boardId,
            statusId,
            command.Title ?? string.Empty,
            command.Description ?? string.Empty,
            priority,
            dueDate,
            authorId,
            assigneeIds,
            tagIds,
            mentionIds,
            now);

        idea.ReplaceFieldValues(fieldValues, fieldDefinitions.Select(d => d.Id).ToList(), now, authorId);

        await _ideaRepository.AddAsync(idea, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("IdeaCreated", idea, authorId, $"Idea '{idea.Title}' created.", now,
            new { idea.Title, Priority = priority.ToString(), idea.StatusId }, cancellationToken);

        await EmitFieldValueAuditAsync(idea, new Dictionary<Guid, string?>(), fieldDefinitions, authorId, now, cancellationToken);

        // Notify everyone mentioned in the new idea body (SPEC/20-feature-notifications.md trigger #1).
        await NotifyMentionsAsync(idea, mentionIds, authorId, cancellationToken);

        return new CreateIdeaResult(idea.Id, idea.BoardId, idea.StatusId, idea.Title, priority.ToString(), FormatDate(idea.DueDate));
    }

    public async Task<IdeaDetail> GetByIdAsync(Guid ideaId, CancellationToken cancellationToken = default)
    {
        RequireAuthenticatedRole();

        var idea = await _ideaRepository.GetByIdAsync(ideaId, includeDeleted: false, cancellationToken)
            ?? throw new NotFoundAppException("Idea not found.");
        EnsureOrganizationScope(idea.OrganizationId);

        return await ProjectDetailAsync(idea, cancellationToken);
    }

    public async Task<IdeaDetail> UpdateAsync(Guid ideaId, UpdateIdeaCommand command, CancellationToken cancellationToken = default)
    {
        RequireIdeaEditRole();

        var idea = await _ideaRepository.GetByIdAsync(ideaId, includeDeleted: false, cancellationToken)
            ?? throw new NotFoundAppException("Idea not found.");
        EnsureOrganizationScope(idea.OrganizationId);

        var now = _clock.UtcNow;
        var actorId = RequireAuthenticatedUserId();
        var priority = ParsePriority(command.Priority);
        var dueDate = ParseDueDate(command.DueDate);

        var existingAssignees = idea.Assignees.Select(a => a.UserId).ToList();
        var existingMentions = idea.Mentions.Select(m => m.MentionedUserId).ToHashSet();
        var requestedAssignees = Distinct(command.AssigneeUserIds);
        var descriptionChanged = !string.Equals((command.Description ?? string.Empty).Trim(), idea.Description, StringComparison.Ordinal);
        var assigneesChanged = !new HashSet<Guid>(existingAssignees).SetEquals(requestedAssignees);

        // Description and assignee changes are restricted to the author or an in-scope admin
        // (SPEC/20-feature-ideas-and-engagement.md "Permissions"); other fields use the general
        // idea-edit permission already checked above.
        if ((descriptionChanged || assigneesChanged) && !CanAdministerIdeaContent(idea, actorId))
        {
            throw new ForbiddenAppException("You are not allowed to change this idea's description or assignees.");
        }

        var assigneeIds = await ResolveAssigneesAsync(idea.OrganizationId, command.AssigneeUserIds, existingAssignees, cancellationToken);
        var tagIds = await ResolveTagsAsync(idea.OrganizationId, command.TagNames, now, actorId, cancellationToken);
        var mentionIds = await _mentionResolver.ResolveAsync(idea.OrganizationId, command.MentionEmails, "mentionEmails", cancellationToken);

        // A null FieldValues means "not provided" — leave existing UDF values untouched. Only an
        // explicit (possibly empty) list reconciles them, so an unrelated edit (e.g. a title change)
        // neither wipes stored values nor is blocked by required-field validation.
        var reconcileFieldValues = command.FieldValues is not null;
        IReadOnlyList<FieldDefinition> fieldDefinitions = Array.Empty<FieldDefinition>();
        IReadOnlyDictionary<Guid, string?> previousFieldValues = new Dictionary<Guid, string?>();
        IReadOnlyList<IdeaFieldValueInput> fieldValues = Array.Empty<IdeaFieldValueInput>();
        if (reconcileFieldValues)
        {
            fieldDefinitions = await _fieldDefinitionRepository.ListByOrganizationAsync(idea.OrganizationId, includeDeleted: false, cancellationToken);
            previousFieldValues = idea.FieldValues.ToDictionary(v => v.FieldDefinitionId, v => v.Value);
            fieldValues = FieldValueValidator.Validate(fieldDefinitions, command.FieldValues);
        }

        idea.UpdateContent(command.Title ?? string.Empty, command.Description ?? string.Empty, priority, dueDate, now, actorId);
        idea.ReplaceAssignees(assigneeIds, now, actorId);
        idea.ReplaceTags(tagIds, now, actorId);
        idea.ReplaceMentions(mentionIds, now, actorId);
        if (reconcileFieldValues)
        {
            idea.ReplaceFieldValues(fieldValues, fieldDefinitions.Select(d => d.Id).ToList(), now, actorId);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("IdeaUpdated", idea, actorId, $"Idea '{idea.Title}' updated.", now, null, cancellationToken);
        if (reconcileFieldValues)
        {
            await EmitFieldValueAuditAsync(idea, previousFieldValues, fieldDefinitions, actorId, now, cancellationToken);
        }

        // Notify only newly added mentions so an edit does not re-notify people already mentioned
        // (SPEC/20-feature-notifications.md trigger #1).
        var newMentions = mentionIds.Where(id => !existingMentions.Contains(id));
        await NotifyMentionsAsync(idea, newMentions, actorId, cancellationToken);

        return await ProjectDetailAsync(idea, cancellationToken);
    }

    public async Task ChangeStatusAsync(Guid ideaId, ChangeIdeaStatusCommand command, CancellationToken cancellationToken = default)
    {
        RequireAuthenticatedRole();

        var idea = await _ideaRepository.GetByIdAsync(ideaId, includeDeleted: false, cancellationToken)
            ?? throw new NotFoundAppException("Idea not found.");
        EnsureOrganizationScope(idea.OrganizationId);

        var board = await _boardReader.GetBoardContextAsync(idea.BoardId, cancellationToken)
            ?? throw new NotFoundAppException("Board not found.");

        if (!board.HasSwimlaneForStatus(command.StatusId))
        {
            throw new ValidationAppException("statusId", new[] { "Status must be an active swimlane on the board." });
        }

        EnsureCanMoveIdea(board);

        if (idea.StatusId == command.StatusId)
        {
            return;
        }

        var now = _clock.UtcNow;
        var actorId = RequireAuthenticatedUserId();
        var previousStatusId = idea.StatusId;

        idea.ChangeStatus(command.StatusId, now, actorId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("IdeaStatusChanged", idea, actorId, $"Idea '{idea.Title}' moved to a new status.", now,
            new { FromStatusId = previousStatusId, ToStatusId = command.StatusId }, cancellationToken);

        // Notify the idea author and assignees of the move (SPEC/20-feature-notifications.md trigger #4).
        await NotifyIdeaFollowersAsync(NotificationEventType.IdeaStatusChanged, idea, actorId, cancellationToken);
    }

    public async Task DeleteAsync(Guid ideaId, CancellationToken cancellationToken = default)
    {
        RequireAuthenticatedRole();

        var idea = await _ideaRepository.GetByIdAsync(ideaId, includeDeleted: false, cancellationToken)
            ?? throw new NotFoundAppException("Idea not found.");

        // Deletion is restricted to Site Admin or an in-scope Org Admin (rule #16 / "Permissions").
        if (!CanAdministerIdeaContent(idea, actorUserId: Guid.Empty, adminOnly: true))
        {
            throw new ForbiddenAppException("You are not allowed to delete ideas.");
        }

        var now = _clock.UtcNow;
        var actorId = RequireAuthenticatedUserId();

        idea.SoftDelete(now, actorId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("IdeaDeleted", idea, actorId, $"Idea '{idea.Title}' deleted.", now, null, cancellationToken);
    }

    public async Task<UpvoteToggleResult> ToggleUpvoteAsync(Guid ideaId, CancellationToken cancellationToken = default)
    {
        // All authenticated users, including Read Only, can upvote (rule #32 "Upvotes" #1).
        var userId = RequireAuthenticatedUserId();

        var idea = await _ideaRepository.GetByIdAsync(ideaId, includeDeleted: false, cancellationToken)
            ?? throw new NotFoundAppException("Idea not found.");
        EnsureOrganizationScope(idea.OrganizationId);

        var now = _clock.UtcNow;
        var existing = await _upvoteRepository.GetAsync(ideaId, userId, cancellationToken);

        bool hasUpvoted;
        if (existing is null)
        {
            await _upvoteRepository.AddAsync(IdeaUpvote.Create(ideaId, userId, now), cancellationToken);
            hasUpvoted = true;
        }
        else
        {
            // Only the user who cast the upvote can remove it — enforced by scoping the lookup to the
            // current user (rule #33, "Upvotes" #5).
            _upvoteRepository.Remove(existing);
            hasUpvoted = false;
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var count = await _upvoteRepository.CountByIdeaAsync(ideaId, cancellationToken);

        await AuditAsync(hasUpvoted ? "IdeaUpvoteAdded" : "IdeaUpvoteRemoved", idea, userId,
            $"Idea '{idea.Title}' upvote {(hasUpvoted ? "added" : "removed")}.", now, null, cancellationToken);

        return new UpvoteToggleResult(ideaId, hasUpvoted, count);
    }

    // Projection ---------------------------------------------------------------------------------

    private async Task<IReadOnlyList<IdeaListItem>> ProjectListItemsAsync(Guid organizationId, IReadOnlyList<Idea> ideas, CancellationToken cancellationToken)
    {
        if (ideas.Count == 0)
        {
            return Array.Empty<IdeaListItem>();
        }

        var ideaIds = ideas.Select(i => i.Id).ToList();
        var tagLookup = await LoadTagLookupAsync(ideas.SelectMany(i => i.Tags.Select(t => t.TagId)), cancellationToken);
        var userLookup = await LoadUserLookupAsync(ideas.SelectMany(i => i.Assignees.Select(a => a.UserId)), cancellationToken);
        var statusInfo = await _boardReader.GetStatusInfoAsync(organizationId, cancellationToken);
        var upvoteCounts = await _upvoteRepository.CountByIdeaIdsAsync(ideaIds, cancellationToken);
        var commentCounts = await _commentRepository.CountByIdeaIdsAsync(ideaIds, cancellationToken);
        var upvoted = await _upvoteRepository.GetUpvotedIdeaIdsAsync(RequireAuthenticatedUserId(), ideaIds, cancellationToken);

        return ideas.Select(idea => new IdeaListItem(
            idea.Id,
            idea.BoardId,
            idea.Title,
            idea.Priority.ToString(),
            FormatDate(idea.DueDate),
            ProjectAssignees(idea, userLookup),
            ProjectTagNames(idea, tagLookup),
            idea.StatusId,
            StatusName(statusInfo, idea.StatusId),
            upvoteCounts.TryGetValue(idea.Id, out var uc) ? uc : 0,
            upvoted.Contains(idea.Id),
            commentCounts.TryGetValue(idea.Id, out var cc) ? cc : 0,
            idea.AuthorUserId,
            idea.CreatedAtUtc)).ToList();
    }

    private async Task<IdeaDetail> ProjectDetailAsync(Idea idea, CancellationToken cancellationToken)
    {
        var tagLookup = await LoadTagLookupAsync(idea.Tags.Select(t => t.TagId), cancellationToken);
        var mentionUserIds = idea.Mentions.Select(m => m.MentionedUserId).ToList();
        var userLookup = await LoadUserLookupAsync(idea.Assignees.Select(a => a.UserId).Concat(mentionUserIds), cancellationToken);
        var statusInfo = await _boardReader.GetStatusInfoAsync(idea.OrganizationId, cancellationToken);
        var upvoteCount = await _upvoteRepository.CountByIdeaAsync(idea.Id, cancellationToken);
        var upvoted = await _upvoteRepository.GetUpvotedIdeaIdsAsync(RequireAuthenticatedUserId(), new[] { idea.Id }, cancellationToken);
        var commentCount = await _commentRepository.CountByIdeaAsync(idea.Id, cancellationToken);

        var comments = await _commentRepository.ListByIdeaAsync(
            new CommentListFilter(idea.Id, new PageRequest(1, PageRequest.MaxPageSize), SortDirection.Ascending), cancellationToken);

        // Only values for active (non-archived) field definitions are surfaced, ordered by display order.
        var fieldDefinitions = await _fieldDefinitionRepository.ListByOrganizationAsync(idea.OrganizationId, includeDeleted: false, cancellationToken);
        var fieldDefinitionsById = fieldDefinitions.ToDictionary(d => d.Id);
        var fieldValues = idea.FieldValues
            .Where(v => fieldDefinitionsById.ContainsKey(v.FieldDefinitionId))
            .OrderBy(v => fieldDefinitionsById[v.FieldDefinitionId].DisplayOrder)
            .Select(v =>
            {
                var definition = fieldDefinitionsById[v.FieldDefinitionId];
                return new IdeaFieldValueDto(definition.Id, definition.Name, definition.FieldType.ToString(), v.Value);
            })
            .ToList();

        var mentions = mentionUserIds
            .Where(userLookup.ContainsKey)
            .Select(id => userLookup[id])
            .Select(u => new MentionDto(u.Id, u.FirstName, u.LastName, DisplayName(u), u.Email))
            .ToList();

        var commentDtos = comments.Items
            .Select(c => new IdeaCommentDto(c.Id, c.IdeaId, c.AuthorUserId, c.Body, c.CreatedAtUtc, c.UpdatedAtUtc))
            .ToList();

        return new IdeaDetail(
            idea.Id,
            idea.BoardId,
            idea.Title,
            idea.Description,
            idea.Priority.ToString(),
            FormatDate(idea.DueDate),
            ProjectAssignees(idea, userLookup),
            idea.StatusId,
            StatusName(statusInfo, idea.StatusId),
            ProjectTagNames(idea, tagLookup),
            mentions,
            commentDtos,
            upvoteCount,
            upvoted.Contains(idea.Id),
            commentCount,
            fieldValues);
    }

    private async Task<IReadOnlyDictionary<Guid, Tag>> LoadTagLookupAsync(IEnumerable<Guid> tagIds, CancellationToken cancellationToken)
    {
        var ids = tagIds.Distinct().ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<Guid, Tag>();
        }

        var tags = await _tagRepository.ListByIdsAsync(ids, cancellationToken);
        return tags.ToDictionary(t => t.Id);
    }

    private async Task<IReadOnlyDictionary<Guid, User>> LoadUserLookupAsync(IEnumerable<Guid> userIds, CancellationToken cancellationToken)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<Guid, User>();
        }

        var users = await _userRepository.ListByIdsAsync(ids, cancellationToken);
        return users.ToDictionary(u => u.Id);
    }

    private static IReadOnlyList<IdeaAssigneeDto> ProjectAssignees(Idea idea, IReadOnlyDictionary<Guid, User> userLookup) =>
        idea.Assignees
            .Where(a => userLookup.ContainsKey(a.UserId))
            .Select(a => userLookup[a.UserId])
            .OrderBy(u => u.FirstName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(u => u.LastName, StringComparer.OrdinalIgnoreCase)
            .Select(u => new IdeaAssigneeDto(u.Id, u.FirstName, u.LastName, DisplayName(u), u.Status == UserStatus.Active))
            .ToList();

    private static IReadOnlyList<string> ProjectTagNames(Idea idea, IReadOnlyDictionary<Guid, Tag> tagLookup) =>
        idea.Tags
            .Where(t => tagLookup.ContainsKey(t.TagId))
            .Select(t => tagLookup[t.TagId].Name)
            .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static string StatusName(IReadOnlyDictionary<Guid, StatusInfo> statusInfo, Guid statusId) =>
        statusInfo.TryGetValue(statusId, out var info) ? info.Name : string.Empty;

    private static string DisplayName(User u) => $"{u.FirstName} {u.LastName}".Trim();

    // Resolution helpers -------------------------------------------------------------------------

    private async Task<IReadOnlyList<Guid>> ResolveAssigneesAsync(
        Guid organizationId,
        IReadOnlyList<Guid>? requested,
        IReadOnlyCollection<Guid> existing,
        CancellationToken cancellationToken)
    {
        var distinct = Distinct(requested);
        if (distinct.Count == 0)
        {
            return distinct;
        }

        if (distinct.Count > Idea.MaxAssignees)
        {
            throw new ValidationAppException("assigneeUserIds", new[] { $"An idea can have at most {Idea.MaxAssignees} assignees." });
        }

        var users = await _userRepository.ListByIdsAsync(distinct, cancellationToken);
        var byId = users.ToDictionary(u => u.Id);
        var existingSet = new HashSet<Guid>(existing);
        var errors = new List<string>();

        foreach (var id in distinct)
        {
            if (!byId.TryGetValue(id, out var user) || user.OrganizationId != organizationId)
            {
                errors.Add($"Assignee '{id}' is not a user in this organization.");
                continue;
            }

            // Newly selected assignees must be active; a previously assigned user may be retained
            // even if they later became inactive (SPEC/20-feature-ideas-and-engagement.md #12).
            if (user.Status != UserStatus.Active && !existingSet.Contains(id))
            {
                errors.Add($"Assignee '{user.Email}' is not an active user and cannot be newly assigned.");
            }
        }

        if (errors.Count > 0)
        {
            throw new ValidationAppException("assigneeUserIds", errors);
        }

        return distinct;
    }

    private async Task<IReadOnlyList<Guid>> ResolveTagsAsync(
        Guid organizationId,
        IReadOnlyList<string>? tagNames,
        DateTime nowUtc,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        var cleaned = (tagNames ?? Array.Empty<string>())
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .ToList();

        if (cleaned.Count == 0)
        {
            return Array.Empty<Guid>();
        }

        foreach (var name in cleaned)
        {
            if (name.Length > Tag.NameMaxLength)
            {
                throw new ValidationAppException("tagNames", new[] { $"Tag must be {Tag.NameMaxLength} characters or fewer." });
            }
        }

        var distinctNormalized = cleaned
            .GroupBy(Tag.Normalize)
            .Select(g => g.First())
            .ToList();

        if (distinctNormalized.Count > Idea.MaxTags)
        {
            throw new ValidationAppException("tagNames", new[] { $"An idea can have at most {Idea.MaxTags} tags." });
        }

        var tags = await _tagRepository.GetOrCreateAsync(organizationId, distinctNormalized, nowUtc, actorUserId, cancellationToken);
        return tags.Select(t => t.Id).ToList();
    }

    // Authorization / scoping --------------------------------------------------------------------

    private Guid RequireAuthenticatedUserId()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.UserId is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        return _currentUser.UserId.Value;
    }

    private Role RequireAuthenticatedRole()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        return _currentUser.Role.Value;
    }

    private void RequireIdeaEditRole()
    {
        var role = RequireAuthenticatedRole();
        if (role == Role.ReadOnly)
        {
            throw new ForbiddenAppException("Read Only users cannot create or edit ideas.");
        }
    }

    private void EnsureOrganizationScope(Guid organizationId)
    {
        var role = RequireAuthenticatedRole();
        if (role == Role.SiteAdmin)
        {
            return;
        }

        if (_currentUser.OrganizationId != organizationId)
        {
            throw new NotFoundAppException("Idea not found.");
        }
    }

    /// <summary>
    /// User-role status moves are allowed only when the board opts in (rule #34); Site Admin and
    /// in-scope Org Admin may always move; Read Only never.
    /// </summary>
    private void EnsureCanMoveIdea(BoardContext board)
    {
        var role = RequireAuthenticatedRole();
        switch (role)
        {
            case Role.SiteAdmin:
            case Role.OrgAdmin:
                return;
            case Role.User when board.AllowUserStatusUpdate:
                return;
            default:
                throw new ForbiddenAppException("You are not allowed to move ideas on this board.");
        }
    }

    private bool CanAdministerIdeaContent(Idea idea, Guid actorUserId, bool adminOnly = false)
    {
        var role = RequireAuthenticatedRole();
        if (role == Role.SiteAdmin)
        {
            return true;
        }

        if (role == Role.OrgAdmin && _currentUser.OrganizationId == idea.OrganizationId)
        {
            return true;
        }

        if (adminOnly)
        {
            return false;
        }

        return _currentUser.UserId == idea.AuthorUserId && actorUserId != Guid.Empty;
    }

    // Parsing ------------------------------------------------------------------------------------

    private static Priority ParsePriority(string? value)
    {
        if (Enum.TryParse<Priority>(value?.Trim(), ignoreCase: true, out var priority))
        {
            return priority;
        }

        throw new ValidationAppException("priority", new[]
        {
            $"Priority must be one of: {Priority.Low}, {Priority.Medium}, {Priority.High}, {Priority.Critical}."
        });
    }

    private static Priority? ParseOptionalPriority(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return Enum.TryParse<Priority>(value.Trim(), ignoreCase: true, out var priority) ? priority : null;
    }

    private static DateOnly? ParseDueDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateOnly.TryParseExact(value.Trim(), DueDateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            return date;
        }

        throw new ValidationAppException("dueDate", new[] { "Due Date must be a valid date (YYYY-MM-DD)." });
    }

    private static DateOnly? ParseOptionalDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateOnly.TryParseExact(value.Trim(), DueDateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? date
            : null;
    }

    private static string? FormatDate(DateOnly? date) => date?.ToString(DueDateFormat, CultureInfo.InvariantCulture);

    private static List<Guid> Distinct(IReadOnlyCollection<Guid>? ids) =>
        ids is null ? new List<Guid>() : ids.Where(id => id != Guid.Empty).Distinct().ToList();

    private async Task AuditAsync(string eventType, Idea idea, Guid? actorUserId, string message, DateTime nowUtc, object? metadata, CancellationToken cancellationToken)
    {
        var metadataJson = metadata is null ? null : JsonSerializer.Serialize(metadata);
        var auditEvent = AuditEvent.Create(eventType, "Idea", message, nowUtc, idea.OrganizationId, actorUserId, idea.Id, metadataJson);
        await _auditEventWriter.WriteAsync(auditEvent, cancellationToken);
    }

    /// <summary>
    /// Emits an <c>IdeaFieldValueChanged</c> audit event for each User-Defined Field value that was
    /// added, changed, or cleared (SPEC/20-feature-user-defined-fields.md "Audit Emission").
    /// </summary>
    private async Task EmitFieldValueAuditAsync(
        Idea idea,
        IReadOnlyDictionary<Guid, string?> previousValues,
        IReadOnlyList<FieldDefinition> definitions,
        Guid actorId,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var fieldNames = definitions.ToDictionary(d => d.Id, d => d.Name);
        var currentValues = idea.FieldValues.ToDictionary(v => v.FieldDefinitionId, v => v.Value);

        foreach (var fieldDefinitionId in previousValues.Keys.Union(currentValues.Keys))
        {
            previousValues.TryGetValue(fieldDefinitionId, out var previousValue);
            currentValues.TryGetValue(fieldDefinitionId, out var newValue);
            if (string.Equals(previousValue, newValue, StringComparison.Ordinal))
            {
                continue;
            }

            var fieldName = fieldNames.TryGetValue(fieldDefinitionId, out var name) ? name : fieldDefinitionId.ToString();
            var metadata = new { fieldDefinitionId, fieldName, previousValue, newValue };
            await AuditAsync("IdeaFieldValueChanged", idea, actorId,
                $"Custom field '{fieldName}' changed on idea '{idea.Title}'.", nowUtc, metadata, cancellationToken);
        }
    }

    // Notification emission ----------------------------------------------------------------------
    // Persisted only (never delivered) — see SPEC/20-feature-notifications.md and T039. Self- and
    // duplicate-recipient suppression is applied here and defensively again in the writer.

    private async Task NotifyMentionsAsync(Idea idea, IEnumerable<Guid> mentionedUserIds, Guid actorId, CancellationToken cancellationToken)
    {
        foreach (var recipientId in mentionedUserIds.Where(id => id != Guid.Empty && id != actorId).Distinct())
        {
            await _notificationWriter.WriteAsync(
                NotificationEventType.IdeaMention, idea.OrganizationId, idea.BoardId, idea.Id, idea.Title,
                actorId, recipientId, cancellationToken);
        }
    }

    private async Task NotifyIdeaFollowersAsync(NotificationEventType eventType, Idea idea, Guid actorId, CancellationToken cancellationToken)
    {
        var recipients = new HashSet<Guid> { idea.AuthorUserId };
        foreach (var assignee in idea.Assignees)
        {
            recipients.Add(assignee.UserId);
        }

        foreach (var recipientId in recipients.Where(id => id != Guid.Empty && id != actorId))
        {
            await _notificationWriter.WriteAsync(
                eventType, idea.OrganizationId, idea.BoardId, idea.Id, idea.Title,
                actorId, recipientId, cancellationToken);
        }
    }
}
