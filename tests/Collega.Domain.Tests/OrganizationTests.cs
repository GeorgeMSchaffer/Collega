using Collega.Domain.Organizations;

namespace Collega.Domain.Tests;

public sealed class OrganizationTests
{
    [Fact]
    public void Create_TrimsTitleAndDescription()
    {
        var org = Organization.Create("  Acme  ", "  Robotics maker  ", "CODE123", TestClock.Now);

        Assert.Equal("Acme", org.Title);
        Assert.Equal("Robotics maker", org.Description);
        Assert.Equal("CODE123", org.InviteCode);
        Assert.False(org.IsArchived);
    }

    [Theory]
    [InlineData("", "desc", "CODE")]
    [InlineData("title", "", "CODE")]
    [InlineData("title", "desc", "")]
    public void Create_RejectsMissingRequiredFields(string title, string description, string inviteCode)
    {
        Assert.Throws<ArgumentException>(() => Organization.Create(title, description, inviteCode, TestClock.Now));
    }

    [Fact]
    public void Update_AppliesNewValuesAndProfile()
    {
        var org = Organization.Create("Acme", "desc", "CODE", TestClock.Now);
        var profile = new OrganizationProfile(City: "  Denver  ", State: "CO");

        org.Update("Acme Inc", "New desc", "https://logo", profile, TestClock.Now.AddMinutes(1), Guid.NewGuid());

        Assert.Equal("Acme Inc", org.Title);
        Assert.Equal("New desc", org.Description);
        Assert.Equal("https://logo", org.LogoUrl);
        Assert.Equal("Denver", org.City);
        Assert.Equal("CO", org.State);
    }

    [Fact]
    public void RegenerateInviteCode_ReplacesCode()
    {
        var org = Organization.Create("Acme", "desc", "OLD", TestClock.Now);
        org.RegenerateInviteCode("NEW", TestClock.Now.AddMinutes(1), Guid.NewGuid());
        Assert.Equal("NEW", org.InviteCode);
    }

    [Fact]
    public void Archive_IsIdempotent()
    {
        var org = Organization.Create("Acme", "desc", "CODE", TestClock.Now);

        org.Archive(TestClock.Now, Guid.NewGuid());
        Assert.True(org.IsArchived);

        org.Archive(TestClock.Now.AddDays(1), Guid.NewGuid()); // no throw
        Assert.True(org.IsArchived);
    }

    // ---- AI assist scope statement (SPEC/20-feature-ai-idea-assist.md rules 6, 9) ----

    [Fact]
    public void SetAiScopeStatement_TrimsAndStores()
    {
        var org = Organization.Create("Acme", "Desc", "ACME-1", TestClock.Now);

        org.SetAiScopeStatement("  Only warehouse operations.  ", TestClock.Now, null);

        Assert.Equal("Only warehouse operations.", org.AiScopeStatement);
    }

    /// <summary>
    /// Clearing is a legitimate choice, not an unset state: an empty statement means "no narrowing
    /// beyond the active Idea Types", which is a valid configuration an Org Admin may want back.
    /// </summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void SetAiScopeStatement_ClearsOnEmptyInput(string? input)
    {
        var org = Organization.Create("Acme", "Desc", "ACME-1", TestClock.Now);
        org.SetAiScopeStatement("Something", TestClock.Now, null);

        org.SetAiScopeStatement(input, TestClock.Now, null);

        Assert.Null(org.AiScopeStatement);
    }

    [Fact]
    public void SetAiScopeStatement_RejectsAnOverlongStatement()
    {
        var org = Organization.Create("Acme", "Desc", "ACME-1", TestClock.Now);
        var tooLong = new string('x', Organization.AiScopeStatementMaxLength + 1);

        Assert.Throws<ArgumentException>(() => org.SetAiScopeStatement(tooLong, TestClock.Now, null));
    }

    [Fact]
    public void SetAiScopeStatement_AcceptsExactlyTheMaximum()
    {
        var org = Organization.Create("Acme", "Desc", "ACME-1", TestClock.Now);
        var atLimit = new string('x', Organization.AiScopeStatementMaxLength);

        org.SetAiScopeStatement(atLimit, TestClock.Now, null);

        Assert.Equal(atLimit, org.AiScopeStatement);
    }

    [Fact]
    public void Organization_HasNoScopeStatementUntilOneIsSet()
    {
        var org = Organization.Create("Acme", "Desc", "ACME-1", TestClock.Now);

        Assert.Null(org.AiScopeStatement);
    }
}
