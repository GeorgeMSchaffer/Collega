using Collega.Application.Auth;
using Collega.Application.Exceptions;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Enums;
using Collega.Domain.Users;

namespace Collega.Application.Tests;

public sealed class AuthServiceTests
{
    private readonly TestClock _clock = new();
    private readonly FakeUserRepository _users = new();
    private readonly FakeOrganizationRepository _orgs = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly FakePasswordHasher _hasher = new();
    private readonly FakeAccessTokenIssuer _tokenIssuer = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly FakeCurrentUserContext _currentUser = new();

    private AuthService CreateSut() =>
        new(_users, _orgs, _uow, _hasher, _tokenIssuer, _audit, _currentUser, _clock);

    private User AddUser(Role role = Role.User, UserStatus status = UserStatus.Active, string email = "pat@example.com", string password = "Secret1!", bool mustChange = false)
    {
        var org = _orgs.Add(Build.Organization());
        var user = role == Role.SiteAdmin
            ? User.CreateSiteAdmin("Site", "Admin", email, _hasher.Hash(password), _clock.UtcNow)
            : User.CreateOrganizationUser(org.Id, "Pat", "Jones", email, _hasher.Hash(password), role, status, mustChange, _clock.UtcNow);
        return _users.Add(user);
    }

    // Login -------------------------------------------------------------------------------------

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsTokenAndSummary()
    {
        var user = AddUser(mustChange: true);
        var sut = CreateSut();

        var result = await sut.LoginAsync(new LoginCommand("pat@example.com", "Secret1!"));

        Assert.Equal($"token-{user.Id:N}", result.AccessToken);
        Assert.Equal(3600, result.ExpiresInSeconds);
        Assert.True(result.RequiresPasswordChange);
        Assert.Equal(user.Id, result.User.UserId);
        Assert.Equal(user.SecurityStamp, _tokenIssuer.LastSecurityStamp);
        Assert.Contains(_audit.Events, e => e.EventType == "AuthLoginSucceeded");
    }

    [Fact]
    public async Task Login_NormalizesEmailBeforeLookup()
    {
        AddUser(email: "pat@example.com");
        var sut = CreateSut();

        var result = await sut.LoginAsync(new LoginCommand("  PAT@Example.COM ", "Secret1!"));

        Assert.NotNull(result.AccessToken);
    }

    [Fact]
    public async Task Login_UnknownEmail_ThrowsUnauthorized_AndAuditsFailure()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.LoginAsync(new LoginCommand("missing@example.com", "x")));
        Assert.Contains(_audit.Events, e => e.EventType == "AuthLoginFailed");
    }

    [Fact]
    public async Task Login_InactiveAccount_ThrowsForbidden_BeforePasswordCheck()
    {
        AddUser(status: UserStatus.Inactive);
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() => sut.LoginAsync(new LoginCommand("pat@example.com", "Secret1!")));
    }

    [Fact]
    public async Task Login_WrongPassword_IncrementsFailedCount_AndThrowsUnauthorized()
    {
        var user = AddUser();
        var sut = CreateSut();

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.LoginAsync(new LoginCommand("pat@example.com", "wrong")));

        Assert.Equal(1, user.FailedLoginCount);
        Assert.True(_uow.SaveChangesCount >= 1);
    }

    [Fact]
    public async Task Login_FifthWrongPassword_LocksOut()
    {
        var user = AddUser();
        var sut = CreateSut();

        for (var i = 0; i < 4; i++)
        {
            await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.LoginAsync(new LoginCommand("pat@example.com", "wrong")));
        }

        await Assert.ThrowsAsync<LockedOutAppException>(() => sut.LoginAsync(new LoginCommand("pat@example.com", "wrong")));
        Assert.True(user.IsLockedOut(_clock.UtcNow));
    }

    [Fact]
    public async Task Login_WhenAlreadyLockedOut_ThrowsLockedOut()
    {
        var user = AddUser();
        for (var i = 0; i < 5; i++)
        {
            user.RegisterFailedLoginAttempt(_clock.UtcNow);
        }

        var sut = CreateSut();

        await Assert.ThrowsAsync<LockedOutAppException>(() => sut.LoginAsync(new LoginCommand("pat@example.com", "Secret1!")));
    }

    [Fact]
    public async Task Login_WithExpiredTemporaryPassword_ThrowsUnauthorized_EvenIfHashMatches()
    {
        var user = AddUser();
        user.IssueTemporaryPassword(_hasher.Hash("Secret1!"), _clock.UtcNow, Guid.NewGuid());
        _clock.UtcNow = _clock.UtcNow.AddHours(25);
        var sut = CreateSut();

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.LoginAsync(new LoginCommand("pat@example.com", "Secret1!")));
    }

    // ChangePassword ----------------------------------------------------------------------------

    [Fact]
    public async Task ChangePassword_WithWrongCurrent_ThrowsUnauthorized()
    {
        var user = AddUser();
        var sut = CreateSut();

        await Assert.ThrowsAsync<UnauthorizedAppException>(() =>
            sut.ChangePasswordAsync(user.Id, new ChangePasswordCommand("wrong", "NewPass1!")));
    }

    [Fact]
    public async Task ChangePassword_WithWeakNewPassword_ThrowsValidation()
    {
        var user = AddUser();
        var sut = CreateSut();

        var ex = await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.ChangePasswordAsync(user.Id, new ChangePasswordCommand("Secret1!", "weak")));
        Assert.True(ex.Errors.ContainsKey("newPassword"));
    }

    [Fact]
    public async Task ChangePassword_Success_UpdatesHash_ClearsMustChange_AndAudits()
    {
        var user = AddUser(mustChange: true);
        var sut = CreateSut();

        await sut.ChangePasswordAsync(user.Id, new ChangePasswordCommand("Secret1!", "NewPass1!"));

        Assert.False(user.MustChangePassword);
        Assert.True(_hasher.Verify("NewPass1!", user.PasswordHash));
        Assert.Contains(_audit.Events, e => e.EventType == "AuthPasswordChanged");
    }

    // Register ----------------------------------------------------------------------------------

    [Fact]
    public async Task Register_MissingInviteCode_ThrowsValidation()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.RegisterAsync(new RegisterCommand(" ", "A", "B", "new@example.com", "Secret1!")));
    }

    [Fact]
    public async Task Register_UnknownInviteCode_ThrowsValidation()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.RegisterAsync(new RegisterCommand("NOPE", "A", "B", "new@example.com", "Secret1!")));
    }

    [Fact]
    public async Task Register_ArchivedOrganizationInviteCode_ThrowsValidation()
    {
        _orgs.Add(Build.Organization(inviteCode: "ARCHIVED-1", archived: true));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.RegisterAsync(new RegisterCommand("ARCHIVED-1", "A", "B", "new@example.com", "Secret1!")));
    }

    [Fact]
    public async Task Register_DuplicateEmail_ThrowsConflict()
    {
        var org = _orgs.Add(Build.Organization(inviteCode: "JOIN-1"));
        _users.Add(Build.User(org.Id, email: "taken@example.com"));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ConflictAppException>(() =>
            sut.RegisterAsync(new RegisterCommand("JOIN-1", "A", "B", "TAKEN@example.com", "Secret1!")));
    }

    [Fact]
    public async Task Register_WeakPassword_ThrowsValidation()
    {
        _orgs.Add(Build.Organization(inviteCode: "JOIN-2"));
        var sut = CreateSut();

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            sut.RegisterAsync(new RegisterCommand("JOIN-2", "A", "B", "new@example.com", "weak")));
    }

    [Fact]
    public async Task Register_Success_CreatesActiveUserRole_WithoutForcedChange()
    {
        var org = _orgs.Add(Build.Organization(inviteCode: "JOIN-3"));
        var sut = CreateSut();

        var result = await sut.RegisterAsync(new RegisterCommand(" JOIN-3 ", "New", "User", "new@example.com", "Secret1!"));

        Assert.Equal(org.Id, result.OrganizationId);
        Assert.Equal(Role.User.ToString(), result.Role);
        Assert.Equal(UserStatus.Active.ToString(), result.Status);
        var created = _users.Users.Single(u => u.NormalizedEmail == "new@example.com");
        Assert.False(created.MustChangePassword);
        Assert.Contains(_audit.Events, e => e.EventType == "UserSelfRegistered");
    }

    // IssueTemporaryPassword --------------------------------------------------------------------

    [Fact]
    public async Task IssueTemporaryPassword_WhenNotAuthenticated_ThrowsUnauthorized()
    {
        var target = AddUser();
        var sut = CreateSut();

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.IssueTemporaryPasswordAsync(target.Id));
    }

    [Fact]
    public async Task IssueTemporaryPassword_TargetNotFound_ThrowsNotFound()
    {
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = Guid.NewGuid();
        _currentUser.Role = Role.SiteAdmin;
        var sut = CreateSut();

        await Assert.ThrowsAsync<NotFoundAppException>(() => sut.IssueTemporaryPasswordAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task IssueTemporaryPassword_OrgAdminDifferentOrg_ThrowsForbidden()
    {
        var target = AddUser();
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = Guid.NewGuid();
        _currentUser.Role = Role.OrgAdmin;
        _currentUser.OrganizationId = Guid.NewGuid(); // different org
        var sut = CreateSut();

        await Assert.ThrowsAsync<ForbiddenAppException>(() => sut.IssueTemporaryPasswordAsync(target.Id));
    }

    [Fact]
    public async Task IssueTemporaryPassword_OrgAdminSameOrg_Succeeds_AndForcesChange()
    {
        var target = AddUser();
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = Guid.NewGuid();
        _currentUser.Role = Role.OrgAdmin;
        _currentUser.OrganizationId = target.OrganizationId;
        var sut = CreateSut();

        var result = await sut.IssueTemporaryPasswordAsync(target.Id);

        Assert.True(result.MustChangePassword);
        Assert.False(string.IsNullOrWhiteSpace(result.TemporaryPassword));
        Assert.True(target.MustChangePassword);
        Assert.Contains(_audit.Events, e => e.EventType == "AuthTemporaryPasswordIssued");
    }

    [Fact]
    public async Task IssueTemporaryPassword_SiteAdmin_Succeeds()
    {
        var target = AddUser();
        _currentUser.IsAuthenticated = true;
        _currentUser.UserId = Guid.NewGuid();
        _currentUser.Role = Role.SiteAdmin;
        var sut = CreateSut();

        var result = await sut.IssueTemporaryPasswordAsync(target.Id);

        Assert.True(result.MustChangePassword);
    }

    // Self endpoints ----------------------------------------------------------------------------

    [Fact]
    public async Task GetCurrentUser_UnknownId_ThrowsUnauthorized()
    {
        var sut = CreateSut();
        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.GetCurrentUserAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task UpdateProfile_UpdatesName_AndAudits()
    {
        var user = AddUser();
        var sut = CreateSut();

        var summary = await sut.UpdateProfileAsync(user.Id, new UpdateProfileCommand("  Robin ", " Diaz "));

        Assert.Equal("Robin", summary.FirstName);
        Assert.Equal("Diaz", summary.LastName);
        Assert.Contains(_audit.Events, e => e.EventType == "UserProfileUpdated");
    }
}
