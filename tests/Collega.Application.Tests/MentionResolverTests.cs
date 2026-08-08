using Collega.Application.Collaboration;
using Collega.Application.Exceptions;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Enums;
using Collega.Domain.Users;

namespace Collega.Application.Tests;

public sealed class MentionResolverTests
{
    private readonly FakeUserRepository _users = new();
    private readonly Guid _orgId = Guid.NewGuid();

    private MentionResolver CreateSut() => new(_users);

    private User Seed(string email, Role role = Role.User, UserStatus status = UserStatus.Active, Guid? orgId = null) =>
        _users.Add(Build.User(orgId ?? _orgId, role: role, status: status, email: email));

    [Fact]
    public async Task Resolve_NullOrEmpty_ReturnsEmpty()
    {
        var sut = CreateSut();

        Assert.Empty(await sut.ResolveAsync(_orgId, null, "field"));
        Assert.Empty(await sut.ResolveAsync(_orgId, Array.Empty<string>(), "field"));
    }

    [Fact]
    public async Task Resolve_ValidEmails_ReturnsUserIds()
    {
        var a = Seed("a@example.com");
        var b = Seed("b@example.com");
        var sut = CreateSut();

        var result = await sut.ResolveAsync(_orgId, new[] { "A@Example.com", "b@example.com" }, "field");

        Assert.Equal(new[] { a.Id, b.Id }, result);
    }

    [Fact]
    public async Task Resolve_DeduplicatesByNormalizedEmail()
    {
        var a = Seed("a@example.com");
        var sut = CreateSut();

        var result = await sut.ResolveAsync(_orgId, new[] { "a@example.com", " A@EXAMPLE.COM " }, "field");

        Assert.Equal(new[] { a.Id }, result);
    }

    [Fact]
    public async Task Resolve_UnknownEmail_ThrowsValidation()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<ValidationAppException>(() => sut.ResolveAsync(_orgId, new[] { "ghost@example.com" }, "field"));
    }

    [Fact]
    public async Task Resolve_UserInDifferentOrganization_ThrowsValidation()
    {
        Seed("outsider@example.com", orgId: Guid.NewGuid());
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() => sut.ResolveAsync(_orgId, new[] { "outsider@example.com" }, "field"));
    }

    [Fact]
    public async Task Resolve_InactiveUser_ThrowsValidation()
    {
        Seed("inactive@example.com", status: UserStatus.Inactive);
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() => sut.ResolveAsync(_orgId, new[] { "inactive@example.com" }, "field"));
    }

    [Fact]
    public async Task Resolve_UsesProvidedFieldNameInValidationError()
    {
        var sut = CreateSut();

        var ex = await Assert.ThrowsAsync<ValidationAppException>(() => sut.ResolveAsync(_orgId, new[] { "ghost@example.com" }, "mentionEmails"));
        Assert.True(ex.Errors.ContainsKey("mentionEmails"));
    }

    [Fact]
    public async Task Resolve_SkipsBlankEntries()
    {
        var a = Seed("a@example.com");
        var sut = CreateSut();

        var result = await sut.ResolveAsync(_orgId, new[] { "  ", "a@example.com" }, "field");

        Assert.Equal(new[] { a.Id }, result);
    }
}
