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
using Collega.Domain.IdeaFields;
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

    /// <summary>
    /// Upper bound on rows a single board CSV export will materialise. Well above any plausible
    /// board — it exists to bound the memory an anonymous-to-the-board member can make the host
    /// allocate, not to constrain normal use.
    /// </summary>
    public const int MaxExportRows = 10_000;

    private readonly IIdeaRepository _ideaRepository;
    private readonly IBoardReader _boardReader;
    private readonly ITagRepository _tagRepository;
    private readonly IIdeaUpvoteRepository _upvoteRepository;
    private readonly ICommentRepository _commentRepository;
    private readonly IUserRepository _userRepository;
    private readonly IFieldDefinitionRepository _fieldDefinitionRepository;
    private readonly IIdeaTypeRepository _ideaTypeRepository;
    private readonly IBusinessImpactRepository _businessImpactRepository;
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
        IIdeaTypeRepository ideaTypeRepository,
        IBusinessImpactRepository businessImpactRepository,
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
        _ideaTypeRepository = ideaTypeRepository;
        _businessImpactRepository = businessImpactRepository;
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

        // User-Defined Field filtering + search scan (T059). Resolve the org's active field schema so
        // raw fieldFilters can be typed per definition and the global search can also scan Text/Url
        // values. Unknown/invalid filter keys are silently dropped (spec: "silently ignored").
        var fieldDefinitions = await _fieldDefinitionRepository.ListByOrganizationAsync(organizationId, includeDeleted: false, cancellationToken);
        var fieldFilters = TranslateFieldFilters(query.FieldFilters, fieldDefinitions);
        var searchTextFieldIds = fieldDefinitions
            .Where(d => d.FieldType is FieldType.Text or FieldType.Url)
            .Select(d => d.Id)
            .ToList();

        var search = query.Search?.Trim();
        // The all-column search covers the Created Date column too: when the term is a full ISO date the
        // repository additionally matches ideas created on that calendar day. Parsed here (hermetically,
        // invariant culture) so the repository stays free of ambient/culture concerns.
        DateOnly? searchCreatedOnDate = null;
        if (!string.IsNullOrEmpty(search)
            && DateOnly.TryParseExact(search, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedSearchDate))
        {
            searchCreatedOnDate = parsedSearchDate;
        }

        var associatedUserId = query.User == Guid.Empty ? null : query.User;

        var filter = new OrganizationIdeaListFilter(
            organizationId,
            createdBy,
            assignedTo,
            new PageRequest(query.Page, query.PageSize),
            search,
            query.SortBy,
            query.SortDirection,
            fieldFilters,
            searchTextFieldIds,
            string.IsNullOrWhiteSpace(query.Tag) ? null : query.Tag.Trim(),
            associatedUserId,
            searchCreatedOnDate);

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

        var ideaType = await GetActiveIdeaTypeAsync(board.OrganizationId, command.IdeaTypeId, cancellationToken);
        await EnsureActiveBusinessImpactAsync(board.OrganizationId, command.BusinessImpactId, cancellationToken);

        var assigneeIds = await ResolveAssigneesAsync(board.OrganizationId, command.AssigneeUserIds, Array.Empty<Guid>(), cancellationToken);
        var tagIds = await ResolveTagsAsync(board.OrganizationId, command.TagNames, now, authorId, cancellationToken);
        var mentionIds = await _mentionResolver.ResolveAsync(board.OrganizationId, command.MentionEmails, "mentionEmails", cancellationToken);

        var fieldDefinitions = await _fieldDefinitionRepository.ListByOrganizationAsync(board.OrganizationId, includeDeleted: false, cancellationToken);
        var effectiveFields = IdeaTypeFieldResolver.ResolveEffectiveFields(ideaType, fieldDefinitions);
        var fieldValues = FieldValueValidator.Validate(effectiveFields, command.FieldValues, FieldNamesById(fieldDefinitions));

        var idea = Idea.Create(
            board.OrganizationId,
            boardId,
            statusId,
            command.Title ?? string.Empty,
            command.Description ?? string.Empty,
            priority,
            command.IdeaTypeId,
            command.BusinessImpactId,
            dueDate,
            authorId,
            assigneeIds,
            tagIds,
            mentionIds,
            now);

        idea.ReplaceFieldValues(fieldValues, effectiveFields.Select(f => f.Field.Id).ToList(), now, authorId);

        await _ideaRepository.AddAsync(idea, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("IdeaCreated", idea, authorId, $"Idea '{idea.Title}' created.", now,
            new { idea.Title, Priority = priority.ToString(), idea.StatusId }, cancellationToken);

        await EmitFieldValueAuditAsync(idea, new Dictionary<Guid, string?>(), fieldDefinitions, authorId, now, cancellationToken);

        // Notify everyone mentioned in the new idea body (SPEC/20-feature-notifications.md trigger #1).
        await NotifyMentionsAsync(idea, mentionIds, authorId, cancellationToken);

        return new CreateIdeaResult(idea.Id, idea.BoardId, idea.StatusId, idea.Title, priority.ToString(), idea.IdeaTypeId, idea.BusinessImpactId, FormatDate(idea.DueDate));
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

        // Idea Type is immutable on the edit path (SPEC/20-feature-idea-type-fields.md): a normal update
        // may not change it. A request that supplies a differing type is rejected; changes go only through
        // the admin reassign route. Business Impact stays mutable.
        if (command.IdeaTypeId != idea.IdeaTypeId)
        {
            throw new ValidationAppException("ideaTypeId", new[] { "Idea Type cannot be changed after creation." });
        }

        if (command.BusinessImpactId != idea.BusinessImpactId)
        {
            await EnsureActiveBusinessImpactAsync(idea.OrganizationId, command.BusinessImpactId, cancellationToken);
        }

        var assigneeIds = await ResolveAssigneesAsync(idea.OrganizationId, command.AssigneeUserIds, existingAssignees, cancellationToken);
        var tagIds = await ResolveTagsAsync(idea.OrganizationId, command.TagNames, now, actorId, cancellationToken);
        var mentionIds = await _mentionResolver.ResolveAsync(idea.OrganizationId, command.MentionEmails, "mentionEmails", cancellationToken);

        // A null FieldValues means "not provided" — leave existing UDF values untouched. Only an
        // explicit (possibly empty) list reconciles them, so an unrelated edit (e.g. a title change)
        // neither wipes stored values nor is blocked by required-field validation.
        var reconcileFieldValues = command.FieldValues is not null;
        IReadOnlyList<FieldDefinition> fieldDefinitions = Array.Empty<FieldDefinition>();
        IReadOnlyList<Guid> reconcileScope = Array.Empty<Guid>();
        IReadOnlyDictionary<Guid, string?> previousFieldValues = new Dictionary<Guid, string?>();
        IReadOnlyList<IdeaFieldValueInput> fieldValues = Array.Empty<IdeaFieldValueInput>();
        if (reconcileFieldValues)
        {
            fieldDefinitions = await _fieldDefinitionRepository.ListByOrganizationAsync(idea.OrganizationId, includeDeleted: false, cancellationToken);
            // Resolve against the idea's (immutable) type; the type resolves even if since-archived.
            var ideaType = await _ideaTypeRepository.GetByIdAsync(idea.IdeaTypeId, cancellationToken);
            var effectiveFields = ideaType is not null
                ? IdeaTypeFieldResolver.ResolveEffectiveFields(ideaType, fieldDefinitions)
                : Array.Empty<EffectiveField>();
            reconcileScope = effectiveFields.Select(f => f.Field.Id).ToList();
            previousFieldValues = idea.FieldValues.ToDictionary(v => v.FieldDefinitionId, v => v.Value);
            fieldValues = FieldValueValidator.Validate(effectiveFields, command.FieldValues, FieldNamesById(fieldDefinitions));
        }

        idea.UpdateContent(command.Title ?? string.Empty, command.Description ?? string.Empty, priority, command.BusinessImpactId, dueDate, now, actorId);
        idea.ReplaceAssignees(assigneeIds, now, actorId);
        idea.ReplaceTags(tagIds, now, actorId);
        idea.ReplaceMentions(mentionIds, now, actorId);
        if (reconcileFieldValues)
        {
            idea.ReplaceFieldValues(fieldValues, reconcileScope, now, actorId);
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

    public async Task ReassignIdeaTypeAsync(Guid organizationId, Guid ideaId, Guid ideaTypeId, CancellationToken cancellationToken = default)
    {
        RequireAuthenticatedRole();

        var idea = await _ideaRepository.GetByIdAsync(ideaId, includeDeleted: false, cancellationToken)
            ?? throw new NotFoundAppException("Idea not found.");
        EnsureOrganizationScope(idea.OrganizationId);
        if (idea.OrganizationId != organizationId)
        {
            throw new NotFoundAppException("Idea not found.");
        }

        // Reassignment is the admin-only break-glass hatch (SPEC/20-feature-idea-type-fields.md).
        if (!CanAdministerIdeaContent(idea, actorUserId: Guid.Empty, adminOnly: true))
        {
            throw new ForbiddenAppException("You are not allowed to reassign an idea's type.");
        }

        // 400 when the target type is unknown or archived in the organization.
        _ = await GetActiveIdeaTypeAsync(idea.OrganizationId, ideaTypeId, cancellationToken);

        if (idea.IdeaTypeId == ideaTypeId)
        {
            return;
        }

        var now = _clock.UtcNow;
        var actorId = RequireAuthenticatedUserId();
        var previousTypeId = idea.IdeaTypeId;

        // Only the type reference changes. Field values are preserved untouched; values outside the new
        // type's resolved set become archived (hidden on detail) rather than dropped — no ReplaceFieldValues
        // call is needed because the reconcile scope would only ever clear resubmitted in-scope values.
        idea.ReassignIdeaType(ideaTypeId, now, actorId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("IdeaTypeReassigned", idea, actorId, $"Idea '{idea.Title}' reassigned to a new Idea Type.", now,
            new { FromIdeaTypeId = previousTypeId, ToIdeaTypeId = ideaTypeId }, cancellationToken);
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

    // CSV export / import (T059/T060) ------------------------------------------------------------

    public async Task<IdeaCsvExport> ExportBoardIdeasAsync(Guid boardId, CancellationToken cancellationToken = default)
    {
        RequireAuthenticatedRole();

        var board = await _boardReader.GetBoardContextAsync(boardId, cancellationToken)
            ?? throw new NotFoundAppException("Board not found.");
        EnsureOrganizationScope(board.OrganizationId);

        // Page through the store, but bounded. Every idea, its tags, its field-value snapshots, the
        // rendered CSV string, and the response byte[] are all held in memory at once, and the
        // endpoint is reachable by any member including Read Only — so an unbounded export is a
        // cheap way to pressure the host. The cap refuses rather than truncating: a silently short
        // export is worse than a clear failure for something people use as a reporting extract.
        var ideas = new List<Idea>();
        var page = 1;
        while (true)
        {
            var pageResult = await _ideaRepository.ListByBoardAsync(
                new IdeaListFilter(boardId, new PageRequest(page, PageRequest.MaxPageSize), null, null, null, null, null, "createdat", "asc"),
                cancellationToken);

            if (pageResult.TotalCount > MaxExportRows)
            {
                throw new ValidationAppException("boardId", new[]
                {
                    $"This board has {pageResult.TotalCount} ideas, which is more than the {MaxExportRows} this export supports. Contact an administrator if you need a larger extract."
                });
            }

            ideas.AddRange(pageResult.Items);
            if (pageResult.Items.Count == 0 || ideas.Count >= pageResult.TotalCount)
            {
                break;
            }

            page++;
        }

        var statusInfo = await _boardReader.GetStatusInfoAsync(board.OrganizationId, cancellationToken);
        var ideaTypes = await LoadIdeaTypeLookupAsync(board.OrganizationId, cancellationToken);
        var impacts = await LoadBusinessImpactLookupAsync(board.OrganizationId, cancellationToken);
        var tagLookup = await LoadTagLookupAsync(ideas.SelectMany(i => i.Tags.Select(t => t.TagId)), cancellationToken);

        // One extra column per active User-Defined Field, in display order (T060). Fields whose name
        // collides with a core column are excluded so the header isn't duplicated (see IsReservedColumn).
        var fieldDefinitions = (await _fieldDefinitionRepository.ListByOrganizationAsync(board.OrganizationId, includeDeleted: false, cancellationToken))
            .Where(d => !IdeaCsvColumns.IsReservedColumn(d.Name))
            .OrderBy(d => d.DisplayOrder)
            .ToList();
        var fieldValueSnapshots = await _ideaRepository.GetFieldValuesByIdeaIdsAsync(ideas.Select(i => i.Id).ToList(), cancellationToken);
        var valuesByIdea = fieldValueSnapshots
            .GroupBy(v => v.IdeaId)
            .ToDictionary(g => g.Key, g => g.ToDictionary(v => v.FieldDefinitionId, v => v.Value));

        var headers = IdeaCsvColumns.Core.Select(c => c.Header)
            .Concat(fieldDefinitions.Select(d => d.Name))
            .ToList();

        var rows = ideas
            .Select(i =>
            {
                var cells = new List<string>
                {
                    i.Title,
                    i.Description,
                    i.Priority.ToString(),
                    IdeaTypeName(ideaTypes, i.IdeaTypeId),
                    BusinessImpactName(impacts, i.BusinessImpactId),
                    StatusName(statusInfo, i.StatusId),
                    FormatDate(i.DueDate) ?? string.Empty,
                    string.Join(", ", ProjectTagNames(i, tagLookup)),
                };

                valuesByIdea.TryGetValue(i.Id, out var ideaValues);
                foreach (var definition in fieldDefinitions)
                {
                    var stored = ideaValues is not null && ideaValues.TryGetValue(definition.Id, out var v) ? v : null;
                    cells.Add(FormatUdfForExport(definition, stored));
                }

                return (IReadOnlyList<string>)cells;
            })
            .ToList();

        return new IdeaCsvExport(headers, rows);
    }

    public async Task<IdeaImportResult> ImportBoardIdeasAsync(Guid boardId, IReadOnlyList<IdeaImportRow> rows, CancellationToken cancellationToken = default)
    {
        RequireIdeaEditRole();

        var board = await _boardReader.GetBoardContextAsync(boardId, cancellationToken)
            ?? throw new NotFoundAppException("Board not found.");
        EnsureOrganizationScope(board.OrganizationId);

        var now = _clock.UtcNow;
        var authorId = RequireAuthenticatedUserId();
        var org = board.OrganizationId;

        var ideaTypes = (await _ideaTypeRepository.ListByOrganizationAsync(org, includeDeleted: false, cancellationToken))
            .ToDictionary(o => o.Name.Trim(), o => o, StringComparer.OrdinalIgnoreCase);
        var impacts = (await _businessImpactRepository.ListByOrganizationAsync(org, includeDeleted: false, cancellationToken))
            .ToDictionary(o => o.Name.Trim(), o => o.Id, StringComparer.OrdinalIgnoreCase);
        var statusInfo = await _boardReader.GetStatusInfoAsync(org, cancellationToken);
        // Only statuses that are swimlanes on this board are valid import targets.
        var boardStatusByName = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var (statusId, info) in statusInfo)
        {
            if (board.HasSwimlaneForStatus(statusId))
            {
                boardStatusByName[info.Name.Trim()] = statusId;
            }
        }

        // Active UDF schema (with options) so per-field columns can be read by name (T060). Fields whose
        // name collides with a core column are excluded from CSV handling (see IsReservedColumn) so the
        // core column isn't misread as the field value (or vice versa) and isn't spuriously required.
        var fieldDefinitions = (await _fieldDefinitionRepository.ListByOrganizationAsync(org, includeDeleted: false, cancellationToken))
            .Where(d => !IdeaCsvColumns.IsReservedColumn(d.Name))
            .ToList();
        var fieldNamesById = FieldNamesById(fieldDefinitions);

        var leftMost = board.LeftMostStatusId;
        var results = new List<IdeaImportRowResult>(rows.Count);
        var created = 0;
        var rejected = 0;

        foreach (var row in rows)
        {
            string? Cell(string key) => row.Cells.TryGetValue(key, out var v) ? v?.Trim() : null;

            var title = Cell(IdeaCsvColumns.Title);
            var description = Cell(IdeaCsvColumns.Description);
            var priorityRaw = Cell(IdeaCsvColumns.Priority);
            var typeName = Cell(IdeaCsvColumns.IdeaType);
            var impactName = Cell(IdeaCsvColumns.BusinessImpact);
            var statusName = Cell(IdeaCsvColumns.Status);
            var dueRaw = Cell(IdeaCsvColumns.DueDate);
            var tagsRaw = Cell(IdeaCsvColumns.Tags);

            void Reject(string message)
            {
                rejected++;
                results.Add(new IdeaImportRowResult(row.RowNumber, title, "Rejected", message));
            }

            if (string.IsNullOrWhiteSpace(title))
            {
                Reject("Title is required.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(description))
            {
                Reject("Description is required.");
                continue;
            }

            var priority = ParseOptionalPriority(priorityRaw);
            if (priority is null)
            {
                Reject("Priority must be Low, Medium, High, or Critical.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(typeName) || !ideaTypes.TryGetValue(typeName, out var ideaType))
            {
                Reject($"Idea Type '{typeName}' is not an active option.");
                continue;
            }

            var ideaTypeId = ideaType.Id;

            if (string.IsNullOrWhiteSpace(impactName) || !impacts.TryGetValue(impactName, out var businessImpactId))
            {
                Reject($"Business Impact '{impactName}' is not an active option.");
                continue;
            }

            Guid statusId;
            if (string.IsNullOrWhiteSpace(statusName))
            {
                if (leftMost is null)
                {
                    Reject("The board has no swimlanes to place the idea in.");
                    continue;
                }

                statusId = leftMost.Value;
            }
            else if (!boardStatusByName.TryGetValue(statusName, out statusId))
            {
                Reject($"Status '{statusName}' is not a swimlane on this board.");
                continue;
            }

            DateOnly? dueDate = null;
            if (!string.IsNullOrWhiteSpace(dueRaw))
            {
                if (!DateOnly.TryParseExact(dueRaw, DueDateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDue))
                {
                    Reject("Due Date must be a valid date (YYYY-MM-DD).");
                    continue;
                }

                dueDate = parsedDue;
            }

            IReadOnlyList<Guid> tagIds;
            try
            {
                tagIds = await ResolveTagsAsync(org, SplitTags(tagsRaw), now, authorId, cancellationToken);
            }
            catch (ValidationAppException ex)
            {
                Reject(string.Join("; ", ex.Errors.SelectMany(e => e.Value)));
                continue;
            }

            // User-Defined Field columns (matched by field name), translated to their stored form then
            // validated (which also enforces required fields and per-type rules). (T060)
            var udfWrites = new List<IdeaFieldValueWrite>();
            string? udfError = null;
            foreach (var definition in fieldDefinitions)
            {
                if (!row.Cells.TryGetValue(definition.Name.Trim().ToLowerInvariant(), out var rawCell) || string.IsNullOrWhiteSpace(rawCell))
                {
                    continue;
                }

                var (stored, error) = TranslateUdfForImport(definition, rawCell.Trim());
                if (error is not null)
                {
                    udfError = $"{definition.Name}: {error}";
                    break;
                }

                udfWrites.Add(new IdeaFieldValueWrite(definition.Id, stored));
            }

            if (udfError is not null)
            {
                Reject(udfError);
                continue;
            }

            var effectiveFields = IdeaTypeFieldResolver.ResolveEffectiveFields(ideaType, fieldDefinitions);
            IReadOnlyList<IdeaFieldValueInput> udfValues;
            try
            {
                udfValues = FieldValueValidator.Validate(effectiveFields, udfWrites, fieldNamesById);
            }
            catch (ValidationAppException ex)
            {
                Reject(string.Join("; ", ex.Errors.SelectMany(e => e.Value)));
                continue;
            }

            Idea idea;
            try
            {
                idea = Idea.Create(org, boardId, statusId, title, description, priority.Value,
                    ideaTypeId, businessImpactId, dueDate, authorId,
                    Array.Empty<Guid>(), tagIds, Array.Empty<Guid>(), now);
            }
            catch (ArgumentException ex)
            {
                Reject(ex.Message);
                continue;
            }

            var reconcileScope = effectiveFields.Select(f => f.Field.Id).ToList();
            if (reconcileScope.Count > 0)
            {
                idea.ReplaceFieldValues(udfValues, reconcileScope, now, authorId);
            }

            await _ideaRepository.AddAsync(idea, cancellationToken);
            created++;
            results.Add(new IdeaImportRowResult(row.RowNumber, title, "Created", null));
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var auditEvent = AuditEvent.Create("IdeasImported", "Board",
            $"Imported {created} idea(s) ({rejected} rejected) from CSV.", now, org, authorId, boardId,
            JsonSerializer.Serialize(new { created, rejected }));
        await _auditEventWriter.WriteAsync(auditEvent, cancellationToken);

        return new IdeaImportResult(created, rejected, results);
    }

    private static IReadOnlyList<string> SplitTags(string? tagsCell) =>
        string.IsNullOrWhiteSpace(tagsCell)
            ? Array.Empty<string>()
            : tagsCell.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    // Renders a stored UDF value for CSV export: Dropdown/MultiSelect ids become human-readable option
    // labels; everything else is the stored string (T060).
    private static string FormatUdfForExport(FieldDefinition definition, string? stored)
    {
        if (string.IsNullOrEmpty(stored))
        {
            return string.Empty;
        }

        switch (definition.FieldType)
        {
            case FieldType.Dropdown:
                return Guid.TryParse(stored, out var optionId)
                    ? definition.Options.FirstOrDefault(o => o.Id == optionId)?.Label ?? stored
                    : stored;

            case FieldType.MultiSelect:
                var labels = stored
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(part => Guid.TryParse(part, out var id)
                        ? definition.Options.FirstOrDefault(o => o.Id == id)?.Label ?? part
                        : part);
                return string.Join(", ", labels);

            default:
                return stored;
        }
    }

    // Translates a CSV cell into the stored UDF form for import: Dropdown/MultiSelect match option
    // labels back to ids; Boolean accepts Yes/No or true/false; other types pass through for the
    // FieldValueValidator to format-check. Returns an error message when a value can't be resolved.
    private static (string? Stored, string? Error) TranslateUdfForImport(FieldDefinition definition, string cell)
    {
        switch (definition.FieldType)
        {
            case FieldType.Boolean:
                if (cell.Equals("true", StringComparison.OrdinalIgnoreCase) || cell.Equals("yes", StringComparison.OrdinalIgnoreCase))
                {
                    return ("true", null);
                }

                if (cell.Equals("false", StringComparison.OrdinalIgnoreCase) || cell.Equals("no", StringComparison.OrdinalIgnoreCase))
                {
                    return ("false", null);
                }

                return (null, "must be Yes or No.");

            case FieldType.Dropdown:
                var option = definition.Options.FirstOrDefault(o => string.Equals(o.Label.Trim(), cell, StringComparison.OrdinalIgnoreCase));
                return option is null ? (null, $"'{cell}' is not a valid option.") : (option.Id.ToString(), null);

            case FieldType.MultiSelect:
                var ids = new List<string>();
                foreach (var part in cell.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                {
                    var match = definition.Options.FirstOrDefault(o => string.Equals(o.Label.Trim(), part, StringComparison.OrdinalIgnoreCase));
                    if (match is null)
                    {
                        return (null, $"'{part}' is not a valid option.");
                    }

                    ids.Add(match.Id.ToString());
                }

                return (string.Join(",", ids), null);

            default:
                return (cell, null);
        }
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
        var ideaTypeLookup = await LoadIdeaTypeLookupAsync(organizationId, cancellationToken);
        var businessImpactLookup = await LoadBusinessImpactLookupAsync(organizationId, cancellationToken);
        var upvoteCounts = await _upvoteRepository.CountByIdeaIdsAsync(ideaIds, cancellationToken);
        var commentCounts = await _commentRepository.CountByIdeaIdsAsync(ideaIds, cancellationToken);
        var upvoted = await _upvoteRepository.GetUpvotedIdeaIdsAsync(RequireAuthenticatedUserId(), ideaIds, cancellationToken);

        return ideas.Select(idea => new IdeaListItem(
            idea.Id,
            idea.BoardId,
            idea.Title,
            idea.Priority.ToString(),
            idea.IdeaTypeId,
            IdeaTypeName(ideaTypeLookup, idea.IdeaTypeId),
            IdeaTypeColorHex(ideaTypeLookup, idea.IdeaTypeId),
            IdeaTypeIcon(ideaTypeLookup, idea.IdeaTypeId),
            idea.BusinessImpactId,
            BusinessImpactName(businessImpactLookup, idea.BusinessImpactId),
            BusinessImpactColor(businessImpactLookup, idea.BusinessImpactId),
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
        var ideaTypeLookup = await LoadIdeaTypeLookupAsync(idea.OrganizationId, cancellationToken);
        var businessImpactLookup = await LoadBusinessImpactLookupAsync(idea.OrganizationId, cancellationToken);
        var upvoteCount = await _upvoteRepository.CountByIdeaAsync(idea.Id, cancellationToken);
        var upvoted = await _upvoteRepository.GetUpvotedIdeaIdsAsync(RequireAuthenticatedUserId(), new[] { idea.Id }, cancellationToken);
        var commentCount = await _commentRepository.CountByIdeaAsync(idea.Id, cancellationToken);

        var comments = await _commentRepository.ListByIdeaAsync(
            new CommentListFilter(idea.Id, new PageRequest(1, PageRequest.MaxPageSize), SortDirection.Ascending), cancellationToken);

        // Field values are ordered/labelled by the fields resolved for the idea's type. Stored values for
        // active fields outside that set (removed from a curated type, or archived on reassignment) are
        // appended as historical/out-of-type values so the client can render them muted — preserved, never
        // dropped (SPEC/20-feature-idea-type-fields.md). Values for soft-deleted definitions stay hidden.
        var fieldDefinitions = await _fieldDefinitionRepository.ListByOrganizationAsync(idea.OrganizationId, includeDeleted: false, cancellationToken);
        var activeDefinitionsById = fieldDefinitions.ToDictionary(d => d.Id);
        var ideaTypeForFields = ideaTypeLookup.TryGetValue(idea.IdeaTypeId, out var resolvedType) ? resolvedType : null;
        var effectiveFields = ideaTypeForFields is not null
            ? IdeaTypeFieldResolver.ResolveEffectiveFields(ideaTypeForFields, fieldDefinitions)
            : Array.Empty<EffectiveField>();
        var resolvedIds = effectiveFields.Select(f => f.Field.Id).ToHashSet();
        var storedByFieldId = idea.FieldValues.ToDictionary(v => v.FieldDefinitionId, v => v.Value);

        var fieldValues = effectiveFields
            .Where(f => storedByFieldId.ContainsKey(f.Field.Id))
            .Select(f => new IdeaFieldValueDto(f.Field.Id, f.Field.Name, f.Field.FieldType.ToString(), storedByFieldId[f.Field.Id]))
            .Concat(idea.FieldValues
                .Where(v => !resolvedIds.Contains(v.FieldDefinitionId) && activeDefinitionsById.ContainsKey(v.FieldDefinitionId))
                .OrderBy(v => activeDefinitionsById[v.FieldDefinitionId].DisplayOrder)
                .ThenBy(v => activeDefinitionsById[v.FieldDefinitionId].Name, StringComparer.OrdinalIgnoreCase)
                .Select(v =>
                {
                    var definition = activeDefinitionsById[v.FieldDefinitionId];
                    return new IdeaFieldValueDto(definition.Id, definition.Name, definition.FieldType.ToString(), v.Value);
                }))
            .ToList();

        var mentions = mentionUserIds
            .Where(userLookup.ContainsKey)
            .Select(id => userLookup[id])
            .Select(u => new MentionDto(u.Id, u.FirstName, u.LastName, DisplayName(u), u.Email, PortraitDataUrl(u)))
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
            idea.IdeaTypeId,
            IdeaTypeName(ideaTypeLookup, idea.IdeaTypeId),
            ideaTypeForFields?.ColorHex,
            ideaTypeForFields?.Icon,
            idea.BusinessImpactId,
            BusinessImpactName(businessImpactLookup, idea.BusinessImpactId),
            BusinessImpactColor(businessImpactLookup, idea.BusinessImpactId),
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

    // Include archived options so an idea referencing a since-soft-deleted option still renders a
    // label (SPEC/30-Contracts.md: archived references stay readable with an archived indicator).
    private async Task<IReadOnlyDictionary<Guid, IdeaType>> LoadIdeaTypeLookupAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var options = await _ideaTypeRepository.ListByOrganizationAsync(organizationId, includeDeleted: true, cancellationToken);
        return options.ToDictionary(o => o.Id);
    }

    private async Task<IReadOnlyDictionary<Guid, BusinessImpact>> LoadBusinessImpactLookupAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var options = await _businessImpactRepository.ListByOrganizationAsync(organizationId, includeDeleted: true, cancellationToken);
        return options.ToDictionary(o => o.Id);
    }

    private static string IdeaTypeName(IReadOnlyDictionary<Guid, IdeaType> lookup, Guid id) =>
        lookup.TryGetValue(id, out var option) ? option.Name : string.Empty;

    private static string? IdeaTypeColorHex(IReadOnlyDictionary<Guid, IdeaType> lookup, Guid id) =>
        lookup.TryGetValue(id, out var option) ? option.ColorHex : null;

    private static string? IdeaTypeIcon(IReadOnlyDictionary<Guid, IdeaType> lookup, Guid id) =>
        lookup.TryGetValue(id, out var option) ? option.Icon : null;

    private static string BusinessImpactName(IReadOnlyDictionary<Guid, BusinessImpact> lookup, Guid id) =>
        lookup.TryGetValue(id, out var option) ? option.Name : string.Empty;

    private static string BusinessImpactColor(IReadOnlyDictionary<Guid, BusinessImpact> lookup, Guid id) =>
        lookup.TryGetValue(id, out var option) ? option.Color : string.Empty;

    private static IReadOnlyList<IdeaAssigneeDto> ProjectAssignees(Idea idea, IReadOnlyDictionary<Guid, User> userLookup) =>
        idea.Assignees
            .Where(a => userLookup.ContainsKey(a.UserId))
            .Select(a => userLookup[a.UserId])
            .OrderBy(u => u.FirstName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(u => u.LastName, StringComparer.OrdinalIgnoreCase)
            .Select(u => new IdeaAssigneeDto(u.Id, u.FirstName, u.LastName, DisplayName(u), u.Status == UserStatus.Active, PortraitDataUrl(u)))
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

    // Portraits ride along as inline data URLs so any avatar surface (board cards, drawer assignees,
    // comment authors) can render the picture wherever it renders initials, without a second
    // per-user request the bearer-token SPA couldn't authenticate anyway. Null → initials fallback.
    private static string? PortraitDataUrl(User u) =>
        u.PortraitPng is { Length: > 0 } bytes ? "data:image/png;base64," + Convert.ToBase64String(bytes) : null;

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

    private async Task<IdeaType> GetActiveIdeaTypeAsync(Guid organizationId, Guid ideaTypeId, CancellationToken cancellationToken)
    {
        var option = ideaTypeId == Guid.Empty ? null : await _ideaTypeRepository.GetByIdAsync(ideaTypeId, cancellationToken);
        if (option is null || option.OrganizationId != organizationId || option.IsDeleted)
        {
            throw new ValidationAppException("ideaTypeId", new[] { "Idea Type must reference an active option in the organization." });
        }

        return option;
    }

    private static IReadOnlyDictionary<Guid, string> FieldNamesById(IReadOnlyList<FieldDefinition> definitions) =>
        definitions.ToDictionary(d => d.Id, d => d.Name);

    private async Task EnsureActiveBusinessImpactAsync(Guid organizationId, Guid businessImpactId, CancellationToken cancellationToken)
    {
        var option = businessImpactId == Guid.Empty ? null : await _businessImpactRepository.GetByIdAsync(businessImpactId, cancellationToken);
        if (option is null || option.OrganizationId != organizationId || option.IsDeleted)
        {
            throw new ValidationAppException("businessImpactId", new[] { "Business Impact must reference an active option in the organization." });
        }
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

    /// <summary>
    /// Translates the raw <c>fieldFilters[&lt;id&gt;]=&lt;value&gt;</c> map into typed predicates per the field's
    /// type (T059). Keys that don't match an active field definition, blank values, and values that
    /// don't parse for their type are silently dropped (SPEC/20-feature-user-defined-fields.md).
    /// </summary>
    private static IReadOnlyList<IdeaFieldValueFilter> TranslateFieldFilters(
        IReadOnlyDictionary<Guid, string>? raw,
        IReadOnlyList<FieldDefinition> definitions)
    {
        if (raw is null || raw.Count == 0)
        {
            return Array.Empty<IdeaFieldValueFilter>();
        }

        var byId = definitions.ToDictionary(d => d.Id, d => d.FieldType);
        var result = new List<IdeaFieldValueFilter>();

        foreach (var (fieldId, rawValue) in raw)
        {
            if (!byId.TryGetValue(fieldId, out var type) || string.IsNullOrWhiteSpace(rawValue))
            {
                continue;
            }

            var value = rawValue.Trim();
            switch (type)
            {
                case FieldType.Text:
                case FieldType.Url:
                    result.Add(new IdeaFieldValueFilter(fieldId, IdeaFieldFilterKind.Contains, Value: value));
                    break;

                case FieldType.Dropdown:
                    result.Add(new IdeaFieldValueFilter(fieldId, IdeaFieldFilterKind.Equals, Value: value));
                    break;

                case FieldType.MultiSelect:
                    result.Add(new IdeaFieldValueFilter(fieldId, IdeaFieldFilterKind.MultiSelectContains, Value: value));
                    break;

                case FieldType.Boolean:
                    if (value.Equals("true", StringComparison.OrdinalIgnoreCase))
                    {
                        result.Add(new IdeaFieldValueFilter(fieldId, IdeaFieldFilterKind.Equals, Value: "true"));
                    }
                    else if (value.Equals("false", StringComparison.OrdinalIgnoreCase))
                    {
                        result.Add(new IdeaFieldValueFilter(fieldId, IdeaFieldFilterKind.Equals, Value: "false"));
                    }
                    break;

                case FieldType.Number:
                {
                    var (min, max) = ParseRange(value);
                    decimal? minD = decimal.TryParse(min, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var lo) ? lo : null;
                    decimal? maxD = decimal.TryParse(max, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var hi) ? hi : null;
                    if (minD is not null || maxD is not null)
                    {
                        result.Add(new IdeaFieldValueFilter(fieldId, IdeaFieldFilterKind.NumberRange, Min: minD, Max: maxD));
                    }
                    break;
                }

                case FieldType.Date:
                {
                    var (from, to) = ParseRange(value);
                    var fromOk = IsIsoDate(from);
                    var toOk = IsIsoDate(to);
                    if (fromOk || toOk)
                    {
                        result.Add(new IdeaFieldValueFilter(fieldId, IdeaFieldFilterKind.DateRange,
                            MinText: fromOk ? from : null, MaxText: toOk ? to : null));
                    }
                    break;
                }
            }
        }

        return result;
    }

    // Range filters arrive as "min:max" (either side optional). A value with no ':' is treated as an
    // exact match (both bounds set to it).
    private static (string? Min, string? Max) ParseRange(string value)
    {
        var colon = value.IndexOf(':');
        if (colon < 0)
        {
            return (value, value);
        }

        var min = value[..colon].Trim();
        var max = value[(colon + 1)..].Trim();
        return (string.IsNullOrEmpty(min) ? null : min, string.IsNullOrEmpty(max) ? null : max);
    }

    private static bool IsIsoDate(string? value) =>
        value is not null && DateOnly.TryParseExact(value, DueDateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

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
