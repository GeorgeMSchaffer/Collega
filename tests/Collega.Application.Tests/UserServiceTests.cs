using Collega.Application.Exceptions;
using Collega.Application.Tests.TestDoubles;
using Collega.Application.Users;
using Collega.Domain.Enums;
using Collega.Domain.Organizations;
using Collega.Domain.Users;

namespace Collega.Application.Tests;

public sealed class UserServiceTests
{
    private readonly TestClock _clock = new();
    private readonly FakeUserRepository _users = new();
    private readonly FakeOrganizationRepository _orgs = new();
    private readonly FakePasswordHasher _hasher = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly FakeCurrentUserContext _currentUser = new();
    private readonly Organization _org;

    public UserServiceTests()
    {
        _org = _orgs.Add(Build.Organization());
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = Guid.NewGuid();
        _currentUser.Role = Role.SiteAdmin;
    }

    private UserService CreateSut() =>
        new(_users, _orgs, _hasher, _uow, _audit, _currentUser, _clock);

    private static CreateUserCommand CreateCommand(string email = "new@example.com", string role = "User", string password = "Secret1!", string? status = null) =>
        new("New", "User", email, role, password, status);

    private void ActAsOrgAdmin(Guid organizationId, Guid? userId = null)
    {
        _currentUser.Role = Role.OrgAdmin;
        _currentUser.OrganizationId = organizationId;
        _currentUser.UserId = userId ?? Guid.NewGuid();
    }

    // Scope -------------------------------------------------------------------------------------

    [Fact]
    public async Task List_AsSiteAdmin_UnknownOrganization_ThrowsNotFound()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<NotFoundAppException>(() =>
            sut.ListByOrganizationAsync(Guid.NewGuid(), new UserListQuery(null, null, null, null, null, null, null)));
    }

    [Fact]
    public async Task List_AsOrgAdminForDifferentOrg_ThrowsNotFound()
    {
        ActAsOrgAdmin(Guid.NewGuid());
        var sut = CreateSut();

        await Assert.ThrowsAsync<NotFoundAppException>(() =>
            sut.ListByOrganizationAsync(_org.Id, new UserListQuery(null, null, null, null, null, null, null)));
    }

    [Fact]
    public async Task List_AsPlainUser_ThrowsForbidden()
    {
        _currentUser.Role = Role.User;
        _currentUser.OrganizationId = _org.Id;
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() =>
            sut.ListByOrganizationAsync(_org.Id, new UserListQuery(null, null, null, null, null, null, null)));
    }

    [Fact]
    public async Task List_AsOrgAdminForOwnOrg_ReturnsScopedUsers()
    {
        _users.Add(Build.User(_org.Id, email: "a@example.com"));
        _users.Add(Build.User(Guid.NewGuid(), email: "other@example.com")); // different org
        ActAsOrgAdmin(_org.Id);
        var sut = CreateSut();

        var page = await sut.ListByOrganizationAsync(_org.Id, new UserListQuery(null, null, null, null, null, null, null));

        Assert.Single(page.Items);
    }

    // Create ------------------------------------------------------------------------------------

    [Fact]
    public async Task Create_Success_ForcesPasswordChange_AndAudits()
    {
        var sut = CreateSut();

        var result = await sut.CreateAsync(_org.Id, CreateCommand());

        Assert.Equal(_org.Id, result.OrganizationId);
        var created = _users.Users.Single(u => u.NormalizedEmail == "new@example.com");
        Assert.True(created.MustChangePassword);
        Assert.Contains(_audit.Events, e => e.EventType == "UserCreated");
    }

    [Fact]
    public async Task Create_DuplicateEmailInSameOrg_ThrowsConflict()
    {
        _users.Add(Build.User(_org.Id, email: "taken@example.com"));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ConflictAppException>(() => sut.CreateAsync(_org.Id, CreateCommand(email: "TAKEN@example.com")));
    }

    [Fact]
    public async Task Create_EmailUsedInDifferentOrg_ThrowsConflict_BecauseEmailIsGloballyUnique()
    {
        var otherOrg = _orgs.Add(Build.Organization(title: "Other", inviteCode: "OTHER-1"));
        _users.Add(Build.User(otherOrg.Id, email: "global@example.com"));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ConflictAppException>(() => sut.CreateAsync(_org.Id, CreateCommand(email: "global@example.com")));
    }

    [Fact]
    public async Task Create_WithSiteAdminRole_ThrowsValidation()
    {
        var sut = CreateSut();
        var ex = await Assert.ThrowsAsync<ValidationAppException>(() => sut.CreateAsync(_org.Id, CreateCommand(role: "SiteAdmin")));
        Assert.True(ex.Errors.ContainsKey("role"));
    }

    [Fact]
    public async Task Create_WithWeakPassword_ThrowsValidation()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<ValidationAppException>(() => sut.CreateAsync(_org.Id, CreateCommand(password: "weak")));
    }

    [Theory]
    [InlineData("OrgAdmin")]
    [InlineData("User")]
    [InlineData("ReadOnly")]
    public async Task Create_AssignsAnyOrganizationRole(string role)
    {
        var sut = CreateSut();
        var result = await sut.CreateAsync(_org.Id, CreateCommand(email: $"{role}@example.com", role: role));
        Assert.Equal(role, result.Role);
    }

    // Update ------------------------------------------------------------------------------------

    [Fact]
    public async Task Update_ChangingEmailToOneInUse_ThrowsConflict()
    {
        var a = _users.Add(Build.User(_org.Id, email: "a@example.com"));
        _users.Add(Build.User(_org.Id, email: "b@example.com"));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ConflictAppException>(() =>
            sut.UpdateAsync(a.Id, new UpdateUserCommand("A", "A", "b@example.com", "User", "Active")));
    }

    [Fact]
    public async Task Update_KeepingSameEmail_DoesNotTripUniquenessCheck()
    {
        var a = _users.Add(Build.User(_org.Id, email: "a@example.com", role: Role.User));
        var sut = CreateSut();

        var detail = await sut.UpdateAsync(a.Id, new UpdateUserCommand("Ann", "Adams", "A@Example.com", "User", "Active"));

        Assert.Equal("Ann", detail.FirstName);
    }

    [Fact]
    public async Task Update_InvalidStatus_ThrowsValidation()
    {
        var a = _users.Add(Build.User(_org.Id, email: "a@example.com"));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.UpdateAsync(a.Id, new UpdateUserCommand("A", "A", "a@example.com", "User", "Pending")));
    }

    [Fact]
    public async Task Update_LastOrgAdmin_RemovingOwnAdminRole_ThrowsValidation()
    {
        var admin = _users.Add(Build.User(_org.Id, role: Role.OrgAdmin, email: "admin@example.com"));
        ActAsOrgAdmin(_org.Id, admin.Id);
        var sut = CreateSut();

        var ex = await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.UpdateAsync(admin.Id, new UpdateUserCommand("A", "A", "admin@example.com", "User", "Active")));
        Assert.True(ex.Errors.ContainsKey("role"));
    }

    [Fact]
    public async Task Update_LastOrgAdmin_DeactivatingSelf_ThrowsValidation()
    {
        var admin = _users.Add(Build.User(_org.Id, role: Role.OrgAdmin, email: "admin@example.com"));
        ActAsOrgAdmin(_org.Id, admin.Id);
        var sut = CreateSut();

        var ex = await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.UpdateAsync(admin.Id, new UpdateUserCommand("A", "A", "admin@example.com", "OrgAdmin", "Inactive")));
        Assert.True(ex.Errors.ContainsKey("status"));
    }

    [Fact]
    public async Task Update_OrgAdminRemovingOwnRole_WhenAnotherActiveAdminExists_IsAllowed()
    {
        var admin = _users.Add(Build.User(_org.Id, role: Role.OrgAdmin, email: "admin@example.com"));
        _users.Add(Build.User(_org.Id, role: Role.OrgAdmin, email: "admin2@example.com"));
        ActAsOrgAdmin(_org.Id, admin.Id);
        var sut = CreateSut();

        var detail = await sut.UpdateAsync(admin.Id, new UpdateUserCommand("A", "A", "admin@example.com", "User", "Active"));

        Assert.Equal(Role.User.ToString(), detail.Role);
    }

    [Fact]
    public async Task Update_SiteAdminDemotingLastOrgAdmin_IsAllowed_BecauseGuardIsSelfScoped()
    {
        var admin = _users.Add(Build.User(_org.Id, role: Role.OrgAdmin, email: "admin@example.com"));
        // Current user is the seeded Site Admin (not the target), so the last-admin guard does not apply.
        var sut = CreateSut();

        var detail = await sut.UpdateAsync(admin.Id, new UpdateUserCommand("A", "A", "admin@example.com", "User", "Active"));

        Assert.Equal(Role.User.ToString(), detail.Role);
    }
}
