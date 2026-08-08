using Collega.Domain.Comments;
using Collega.Domain.Tags;
using Collega.Domain.Upvotes;

namespace Collega.Domain.Tests;

public sealed class TagTests
{
    private static readonly Guid OrgId = Guid.NewGuid();

    [Theory]
    [InlineData("  Onboarding  ", "onboarding")]
    [InlineData("UX", "ux")]
    public void Create_NormalizesName(string input, string expectedNormalized)
    {
        var tag = Tag.Create(OrgId, input, TestClock.Now);
        Assert.Equal(input.Trim(), tag.Name);
        Assert.Equal(expectedNormalized, tag.NormalizedName);
    }

    [Fact]
    public void Normalize_IsCaseAndWhitespaceInsensitive()
    {
        Assert.Equal(Tag.Normalize("  Onboarding "), Tag.Normalize("onboarding"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_RejectsEmptyName(string name)
    {
        Assert.Throws<ArgumentException>(() => Tag.Create(OrgId, name, TestClock.Now));
    }
}

public sealed class CommentTests
{
    private static readonly Guid IdeaId = Guid.NewGuid();
    private static readonly Guid AuthorId = Guid.NewGuid();

    [Fact]
    public void Create_TrimsBody()
    {
        var comment = Comment.Create(IdeaId, AuthorId, "  Looks good  ", Array.Empty<Guid>(), TestClock.Now);
        Assert.Equal("Looks good", comment.Body);
    }

    [Fact]
    public void Create_RejectsEmptyBody()
    {
        Assert.Throws<ArgumentException>(() =>
            Comment.Create(IdeaId, AuthorId, "   ", Array.Empty<Guid>(), TestClock.Now));
    }

    [Fact]
    public void Create_RejectsBodyOverMax()
    {
        var tooLong = new string('x', Comment.BodyMaxLength + 1);
        Assert.Throws<ArgumentException>(() =>
            Comment.Create(IdeaId, AuthorId, tooLong, Array.Empty<Guid>(), TestClock.Now));
    }

    [Fact]
    public void Create_DeduplicatesMentions()
    {
        var user = Guid.NewGuid();
        var comment = Comment.Create(IdeaId, AuthorId, "hi", new[] { user, user, Guid.Empty }, TestClock.Now);
        Assert.Single(comment.Mentions);
    }
}

public sealed class IdeaUpvoteTests
{
    [Fact]
    public void Create_SetsIdeaAndUser()
    {
        var ideaId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var upvote = IdeaUpvote.Create(ideaId, userId, TestClock.Now);

        Assert.Equal(ideaId, upvote.IdeaId);
        Assert.Equal(userId, upvote.UserId);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public void Create_RejectsEmptyIds(bool emptyIdea, bool emptyUser)
    {
        var ideaId = emptyIdea ? Guid.Empty : Guid.NewGuid();
        var userId = emptyUser ? Guid.Empty : Guid.NewGuid();
        Assert.Throws<ArgumentException>(() => IdeaUpvote.Create(ideaId, userId, TestClock.Now));
    }
}
