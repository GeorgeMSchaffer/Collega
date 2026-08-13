using System.Text.Json;
using Collega.Application.Abstractions;
using Collega.Application.Collaboration;
using Collega.Application.Common;
using Collega.Application.Exceptions;
using Collega.Domain.Auditing;
using Collega.Domain.Comments;
using Collega.Domain.Enums;
using Collega.Domain.Ideas;
using Collega.Domain.Notifications;

namespace Collega.Application.Comments;

/// <inheritdoc />
public sealed class CommentService : ICommentService
{
    private readonly ICommentRepository _commentRepository;
    private readonly IIdeaRepository _ideaRepository;
    private readonly IMentionResolver _mentionResolver;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditEventWriter _auditEventWriter;
    private readonly INotificationEventWriter _notificationWriter;
    private readonly ICurrentUserContext _currentUser;
    private readonly IClock _clock;

    public CommentService(
        ICommentRepository commentRepository,
        IIdeaRepository ideaRepository,
        IMentionResolver mentionResolver,
        IUnitOfWork unitOfWork,
        IAuditEventWriter auditEventWriter,
        INotificationEventWriter notificationWriter,
        ICurrentUserContext currentUser,
        IClock clock)
    {
        _commentRepository = commentRepository;
        _ideaRepository = ideaRepository;
        _mentionResolver = mentionResolver;
        _unitOfWork = unitOfWork;
        _auditEventWriter = auditEventWriter;
        _notificationWriter = notificationWriter;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<PagedResult<CommentListItem>> ListByIdeaAsync(Guid ideaId, CommentListQuery query, CancellationToken cancellationToken = default)
    {
        var idea = await LoadIdeaInScopeAsync(ideaId, cancellationToken);

        var filter = new CommentListFilter(idea.Id, new PageRequest(query.Page, query.PageSize), query.SortDirection);
        var page = await _commentRepository.ListByIdeaAsync(filter, cancellationToken);

        var items = page.Items.Select(ToListItem).ToList();
        return new PagedResult<CommentListItem>(items, page.Page, page.PageSize, page.TotalCount, page.SortBy, page.SortDirection);
    }

    public async Task<CreateCommentResult> CreateAsync(Guid ideaId, CreateCommentCommand command, CancellationToken cancellationToken = default)
    {
        // All authenticated users, including Read Only, can comment ("Comments" #1).
        var idea = await LoadIdeaInScopeAsync(ideaId, cancellationToken);

        var now = _clock.UtcNow;
        var authorId = RequireAuthenticatedUserId();
        var mentionIds = await _mentionResolver.ResolveAsync(idea.OrganizationId, command.MentionEmails, "mentionEmails", cancellationToken);

        var comment = Comment.Create(idea.Id, authorId, command.Body ?? string.Empty, mentionIds, now);
        await _commentRepository.AddAsync(comment, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("CommentCreated", idea, comment.Id, authorId, "Comment added to idea.", now, cancellationToken);

        // Notify mentioned users (trigger #2) and the idea author + assignees (trigger #3).
        // Persisted only, never delivered (SPEC/20-feature-notifications.md, T039).
        await NotifyCommentAsync(idea, mentionIds, authorId, cancellationToken);

        return new CreateCommentResult(comment.Id, idea.Id);
    }

    public async Task<CommentListItem> UpdateAsync(Guid commentId, UpdateCommentCommand command, CancellationToken cancellationToken = default)
    {
        var comment = await _commentRepository.GetByIdAsync(commentId, cancellationToken)
            ?? throw new NotFoundAppException("Comment not found.");
        var idea = await LoadIdeaInScopeAsync(comment.IdeaId, cancellationToken);

        var actorId = RequireAuthenticatedUserId();

        // Only the author can edit their own comment ("Comments" #3). Admins may delete, not edit.
        if (comment.AuthorUserId != actorId)
        {
            throw new ForbiddenAppException("You can only edit your own comments.");
        }

        var now = _clock.UtcNow;
        var mentionIds = await _mentionResolver.ResolveAsync(idea.OrganizationId, command.MentionEmails, "mentionEmails", cancellationToken);

        comment.Edit(command.Body ?? string.Empty, mentionIds, now, actorId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("CommentUpdated", idea, comment.Id, actorId, "Comment edited.", now, cancellationToken);

        return ToListItem(comment);
    }

    public async Task DeleteAsync(Guid commentId, CancellationToken cancellationToken = default)
    {
        var comment = await _commentRepository.GetByIdAsync(commentId, cancellationToken)
            ?? throw new NotFoundAppException("Comment not found.");
        var idea = await LoadIdeaInScopeAsync(comment.IdeaId, cancellationToken);

        var actorId = RequireAuthenticatedUserId();

        // The author, an in-scope Org Admin, or Site Admin can delete ("Comments" #3-4).
        if (comment.AuthorUserId != actorId && !CanAdministerOrganization(idea.OrganizationId))
        {
            throw new ForbiddenAppException("You are not allowed to delete this comment.");
        }

        var now = _clock.UtcNow;
        _commentRepository.Remove(comment);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("CommentDeleted", idea, comment.Id, actorId, "Comment deleted.", now, cancellationToken);
    }

    private async Task<Idea> LoadIdeaInScopeAsync(Guid ideaId, CancellationToken cancellationToken)
    {
        var idea = await _ideaRepository.GetByIdAsync(ideaId, includeDeleted: false, cancellationToken)
            ?? throw new NotFoundAppException("Idea not found.");

        var role = RequireAuthenticatedRole();
        if (role != Role.SiteAdmin && _currentUser.OrganizationId != idea.OrganizationId)
        {
            throw new NotFoundAppException("Idea not found.");
        }

        return idea;
    }

    private bool CanAdministerOrganization(Guid organizationId)
    {
        var role = RequireAuthenticatedRole();
        return role == Role.SiteAdmin
            || (role == Role.OrgAdmin && _currentUser.OrganizationId == organizationId);
    }

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

    private static CommentListItem ToListItem(Comment c) =>
        new(c.Id, c.IdeaId, c.AuthorUserId, c.Body, c.CreatedAtUtc, c.UpdatedAtUtc);

    private async Task AuditAsync(string eventType, Idea idea, Guid commentId, Guid actorUserId, string message, DateTime nowUtc, CancellationToken cancellationToken)
    {
        var metadataJson = JsonSerializer.Serialize(new { idea.Id, CommentId = commentId });
        // Rule 14: while acting as someone, the real administrator is the actor and the target
        // moves to OnBehalfOfUserId — an audit row must never read as though the target did it.
        var attribution = _currentUser.AttributeAudit(actorUserId);
        var auditEvent = AuditEvent.Create(eventType, "Comment", message, nowUtc, idea.OrganizationId, attribution.ActorUserId, commentId, metadataJson, attribution.OnBehalfOfUserId);
        await _auditEventWriter.WriteAsync(auditEvent, cancellationToken);
    }

    /// <summary>
    /// Emits notification events for a new comment: one <see cref="NotificationEventType.CommentMention"/>
    /// per mentioned user, and one <see cref="NotificationEventType.CommentAdded"/> per idea author or
    /// assignee. The two triggers are independent, so a user who is both mentioned and a follower may
    /// receive both (SPEC/20-feature-notifications.md "Recipients"). Self- and duplicate-recipient
    /// suppression is applied here and defensively again in the writer.
    /// </summary>
    private async Task NotifyCommentAsync(Idea idea, IReadOnlyList<Guid> mentionedUserIds, Guid actorId, CancellationToken cancellationToken)
    {
        foreach (var recipientId in mentionedUserIds.Where(id => id != Guid.Empty && id != actorId).Distinct())
        {
            await _notificationWriter.WriteAsync(
                NotificationEventType.CommentMention, idea.OrganizationId, idea.BoardId, idea.Id, idea.Title,
                actorId, recipientId, cancellationToken);
        }

        var followers = new HashSet<Guid> { idea.AuthorUserId };
        foreach (var assignee in idea.Assignees)
        {
            followers.Add(assignee.UserId);
        }

        foreach (var recipientId in followers.Where(id => id != Guid.Empty && id != actorId))
        {
            await _notificationWriter.WriteAsync(
                NotificationEventType.CommentAdded, idea.OrganizationId, idea.BoardId, idea.Id, idea.Title,
                actorId, recipientId, cancellationToken);
        }
    }
}
