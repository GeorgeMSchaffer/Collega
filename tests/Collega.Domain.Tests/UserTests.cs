using Collega.Domain.Enums;
using Collega.Domain.Users;

namespace Collega.Domain.Tests;

public sealed class UserTests
{
    private static readonly Guid OrgId = Guid.NewGuid();

    private static User NewOrgUser(Role role = Role.User, UserStatus status = UserStatus.Active) =>
        User.CreateOrganizationUser(OrgId, "Pat", "Jones", "pat@example.com", "hash", role, status, mustChangePassword: false, TestClock.Now);

    [Fact]
    public void CreateSiteAdmin_HasNoOrganization_AndForcesPasswordChange()
    {
        var admin = User.CreateSiteAdmin("Site", "Admin", "admin@collega.local", "hash", TestClock.Now);

        Assert.Null(admin.OrganizationId);
        Assert.Equal(Role.SiteAdmin, admin.Role);
        Assert.True(admin.MustChangePassword);
        Assert.False(string.IsNullOrEmpty(admin.SecurityStamp));
    }

    [Fact]
    public void CreateOrganizationUser_RejectsSiteAdminRole()
    {
        Assert.Throws<ArgumentException>(() => User.CreateOrganizationUser(
            OrgId, "Pat", "Jones", "pat@example.com", "hash", Role.SiteAdmin, UserStatus.Active, false, TestClock.Now));
    }

    [Fact]
    public void CreateOrganizationUser_NormalizesEmail_AndTrimsNames()
    {
        var user = User.CreateOrganizationUser(OrgId, "  Pat ", " Jones ", "  Pat@Example.COM ", "hash", Role.User, UserStatus.Active, false, TestClock.Now);

        Assert.Equal("Pat", user.FirstName);
        Assert.Equal("Jones", user.LastName);
        Assert.Equal("Pat@Example.COM", user.Email);
        Assert.Equal("pat@example.com", user.NormalizedEmail);
    }

    [Fact]
    public void FourFailedAttempts_DoNotLockOut()
    {
        var user = NewOrgUser();
        for (var i = 0; i < 4; i++)
        {
            user.RegisterFailedLoginAttempt(TestClock.Now);
        }

        Assert.False(user.IsLockedOut(TestClock.Now));
    }

    [Fact]
    public void FiveFailedAttemptsWithinWindow_LockOut()
    {
        var user = NewOrgUser();
        for (var i = 0; i < 5; i++)
        {
            user.RegisterFailedLoginAttempt(TestClock.Now.AddSeconds(i));
        }

        Assert.True(user.IsLockedOut(TestClock.Now.AddSeconds(5)));
    }

    [Fact]
    public void Lockout_Expires_After15Minutes()
    {
        var user = NewOrgUser();
        for (var i = 0; i < 5; i++)
        {
            user.RegisterFailedLoginAttempt(TestClock.Now);
        }

        Assert.True(user.IsLockedOut(TestClock.Now.AddMinutes(14)));
        Assert.False(user.IsLockedOut(TestClock.Now.AddMinutes(15).AddSeconds(1)));
    }

    [Fact]
    public void FailedAttempts_OutsideWindow_ResetTheCounter()
    {
        var user = NewOrgUser();
        for (var i = 0; i < 4; i++)
        {
            user.RegisterFailedLoginAttempt(TestClock.Now);
        }

        // A 5th attempt more than 15 minutes later starts a fresh window rather than locking out.
        user.RegisterFailedLoginAttempt(TestClock.Now.AddMinutes(16));

        Assert.False(user.IsLockedOut(TestClock.Now.AddMinutes(16)));
    }

    [Fact]
    public void SuccessfulLogin_ClearsFailedAttemptsAndLockout()
    {
        var user = NewOrgUser();
        for (var i = 0; i < 5; i++)
        {
            user.RegisterFailedLoginAttempt(TestClock.Now);
        }

        user.RegisterSuccessfulLogin(TestClock.Now.AddMinutes(20));

        Assert.False(user.IsLockedOut(TestClock.Now.AddMinutes(20)));
        Assert.Equal(0, user.FailedLoginCount);
    }

    [Fact]
    public void ChangePassword_ClearsMustChangeAndRotatesSecurityStamp()
    {
        var user = User.CreateOrganizationUser(OrgId, "Pat", "Jones", "pat@example.com", "old", Role.User, UserStatus.Active, mustChangePassword: true, TestClock.Now);
        var originalStamp = user.SecurityStamp;

        user.ChangePassword("newhash", TestClock.Now.AddMinutes(1));

        Assert.False(user.MustChangePassword);
        Assert.Equal("newhash", user.PasswordHash);
        Assert.NotEqual(originalStamp, user.SecurityStamp);
    }

    [Fact]
    public void IssueTemporaryPassword_ForcesChange_SetsExpiry_AndClearsLockout()
    {
        var user = NewOrgUser();
        for (var i = 0; i < 5; i++)
        {
            user.RegisterFailedLoginAttempt(TestClock.Now);
        }

        user.IssueTemporaryPassword("temphash", TestClock.Now, Guid.NewGuid());

        Assert.True(user.MustChangePassword);
        Assert.False(user.IsLockedOut(TestClock.Now));
        Assert.False(user.IsTemporaryPasswordExpired(TestClock.Now.AddHours(23)));
        Assert.True(user.IsTemporaryPasswordExpired(TestClock.Now.AddHours(24).AddSeconds(1)));
    }

    [Fact]
    public void UpdateName_ChangesOnlyNames()
    {
        var user = NewOrgUser();
        user.UpdateName("  Robin ", " Diaz ", TestClock.Now, user.Id);

        Assert.Equal("Robin", user.FirstName);
        Assert.Equal("Diaz", user.LastName);
        Assert.Equal("pat@example.com", user.NormalizedEmail);
    }

    [Fact]
    public void Administer_RejectsSiteAdminRoleForOrganizationUser()
    {
        var user = NewOrgUser();
        Assert.Throws<ArgumentException>(() =>
            user.Administer("Pat", "Jones", "pat@example.com", Role.SiteAdmin, UserStatus.Active, TestClock.Now, Guid.NewGuid()));
    }

    [Fact]
    public void Administer_UpdatesRoleStatusAndReNormalizesEmail()
    {
        var user = NewOrgUser();
        user.Administer("Pat", "Jones", " New@Example.COM ", Role.OrgAdmin, UserStatus.Inactive, TestClock.Now, Guid.NewGuid());

        Assert.Equal(Role.OrgAdmin, user.Role);
        Assert.Equal(UserStatus.Inactive, user.Status);
        Assert.Equal("new@example.com", user.NormalizedEmail);
    }
}
