using Collega.Domain.Users;

namespace Collega.Domain.Tests;

public sealed class PasswordPolicyTests
{
    [Theory]
    [InlineData("Abc123!")]
    [InlineData("Str0ng!Pass")]
    [InlineData("aB3$xy")] // exactly 6 chars, all classes
    public void Validate_ReturnsNoErrors_ForCompliantPassword(string password)
    {
        Assert.Empty(PasswordPolicy.Validate(password));
        Assert.True(PasswordPolicy.IsSatisfiedBy(password));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("aB3$x")]      // 5 chars — too short
    [InlineData("abc123!")]    // no uppercase
    [InlineData("ABC123!")]    // no lowercase
    [InlineData("Abcdef!")]    // no digit
    [InlineData("Abc1234")]    // no special character
    public void Validate_ReturnsErrors_ForNonCompliantPassword(string? password)
    {
        Assert.NotEmpty(PasswordPolicy.Validate(password));
        Assert.False(PasswordPolicy.IsSatisfiedBy(password));
    }

    [Fact]
    public void Validate_NullPassword_ReportsRequiredOnly()
    {
        var errors = PasswordPolicy.Validate(null);
        Assert.Single(errors);
    }
}
