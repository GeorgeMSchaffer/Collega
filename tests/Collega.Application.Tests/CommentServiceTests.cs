using Collega.Application.Collaboration;
using Collega.Application.Comments;
using Collega.Application.Exceptions;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Comments;
using Collega.Domain.Enums;
using Collega.Domain.Ideas;
using Collega.Domain.Organizations;
using Collega.Domain.Users;

namespace Collega.Application.Tests;

public sealed class CommentServiceTests
{
    private readonly TestClock _clock = new();
    private readonly FakeCommentRepository _comments = new();
    private readonly FakeIdeaRepository _ideas = new();
    private readonly FakeUserRepository _users = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly FakeCurrentUserContext _currentUser = new();

    private readonly Organization _org;
    private readonly Idea _idea;
    private readonly User _author;

    public CommentServiceTests()
    {
        _org = Build.Organization();
        _author = _users.Add(Build.User(_org.Id, email: "author@example.com"));
        _idea = _ideas.Add(Build.Idea(_org.Id, Guid.NewGuid(), Guid.NewGuid(), _author.Id));
        ActAs(Role.User, _author.Id);
    }

    private void ActAs(Role role, Guid userId)
    {
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = userId;
        _currentUser.OrganizationId = role == Role.SiteAdmin ? null : _org.Id;
        _currentUser.Role = role;
    }

    private CommentService CreateSut() =>
        new(_comments, _ideas, new MentionResolver(_users), _uow, _audit, _currentUser, _clock);

    private Comment SeedComment(Guid authorId, string body = "Hello there.") =>
        _comments.Add(Comment.Create(_idea.Id, authorId, body, Array.Empty<Guid>(), _clock.UtcNow));

    // Create ------------------------------------------------------------------------------------

    [Fact]
    public async Task Create_UnknownIdea_ThrowsNotFound()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<NotFoundAppException>(() =>
            sut.CreateAsync(Guid.NewGuid(), new CreateCommentCommand("Body", null)));
    }

    [Fact]
    public async Task Create_WrongOrganizationScope_ThrowsNotFound()
    {
        ActAs(Role.User, Guid.NewGuid());
        _currentUser.OrganizationId = Guid.NewGuid();
        var sut = CreateSut();

        await Assert.ThrowsAsync<NotFoundAppException>(() =>
            sut.CreateAsync(_idea.Id, new CreateCommentCommand("Body", null)));
    }

    [Fact]
    public async Task Create_AsReadOnly_IsAllowed_AndAudits()
    {
        ActAs(Role.ReadOnly, Guid.NewGuid());
        var sut = CreateSut();

        var result = await sut.CreateAsync(_idea.Id, new CreateCommentCommand("A read-only comment.", null));

        Assert.Equal(_idea.Id, result.IdeaId);
        Assert.Single(_comments.Comments);
        Assert.Contains(_audit.Events, e => e.EventType == "CommentCreated");
    }

    [Fact]
    public async Task Create_WithResolvableMention_Succeeds()
    {
        var mentioned = _users.Add(Build.User(_org.Id, email: "teammate@example.com"));
        var sut = CreateSut();

        await sut.CreateAsync(_idea.Id, new CreateCommentCommand("Hey @teammate", new[] { "teammate@example.com" }));

        var comment = _comments.Comments.Single();
        Assert.Contains(comment.Mentions, m => m.MentionedUserId == mentioned.Id);
    }

    [Fact]
    public async Task Create_WithUnresolvableMention_ThrowsValidation()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.CreateAsync(_idea.Id, new CreateCommentCommand("Body", new[] { "ghost@example.com" })));
    }

    // Update ------------------------------------------------------------------------------------

    [Fact]
    public async Task Update_ByNonAuthor_ThrowsForbidden()
    {
        var comment = SeedComment(_author.Id);
        ActAs(Role.OrgAdmin, Guid.NewGuid()); // admins may delete but not edit
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() =>
            sut.UpdateAsync(comment.Id, new UpdateCommentCommand("Edited", null)));
    }

    [Fact]
    public async Task Update_ByAuthor_UpdatesBody_AndAudits()
    {
        var comment = SeedComment(_author.Id);
        var sut = CreateSut();

        var item = await sut.UpdateAsync(comment.Id, new UpdateCommentCommand("Edited body.", null));

        Assert.Equal("Edited body.", item.Body);
        Assert.Contains(_audit.Events, e => e.EventType == "CommentUpdated");
    }

    [Fact]
    public async Task Update_UnknownComment_ThrowsNotFound()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<NotFoundAppException>(() =>
            sut.UpdateAsync(Guid.NewGuid(), new UpdateCommentCommand("Edited", null)));
    }

    // Delete ------------------------------------------------------------------------------------

    [Fact]
    public async Task Delete_ByAuthor_Succeeds()
    {
        var comment = SeedComment(_author.Id);
        var sut = CreateSut();

        await sut.DeleteAsync(comment.Id);

        Assert.Empty(_comments.Comments);
        Assert.Contains(_audit.Events, e => e.EventType == "CommentDeleted");
    }

    [Fact]
    public async Task Delete_ByOrgAdmin_Succeeds()
    {
        var comment = SeedComment(Guid.NewGuid()); // someone else's comment
        ActAs(Role.OrgAdmin, Guid.NewGuid());
        var sut = CreateSut();

        await sut.DeleteAsync(comment.Id);

        Assert.Empty(_comments.Comments);
    }

    [Fact]
    public async Task Delete_ByOtherUser_ThrowsForbidden()
    {
        var comment = SeedComment(_author.Id);
        ActAs(Role.User, Guid.NewGuid());
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() => sut.DeleteAsync(comment.Id));
    }

    // List --------------------------------------------------------------------------------------

    [Fact]
    public async Task List_ReturnsCommentsForIdeaInChronologicalOrder()
    {
        var first = _comments.Add(Comment.Create(_idea.Id, _author.Id, "first", Array.Empty<Guid>(), _clock.UtcNow));
        var second = _comments.Add(Comment.Create(_idea.Id, _author.Id, "second", Array.Empty<Guid>(), _clock.UtcNow.AddMinutes(1)));
        var sut = CreateSut();

        var page = await sut.ListByIdeaAsync(_idea.Id, new CommentListQuery(null, null, "asc"));

        Assert.Equal(new[] { first.Id, second.Id }, page.Items.Select(i => i.CommentId));
    }
}
