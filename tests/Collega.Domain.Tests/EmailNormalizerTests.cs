using Collega.Domain.Users;

namespace Collega.Domain.Tests;

public sealed class EmailNormalizerTests
{
    [Theory]
    [InlineData("  User@Example.COM ", "user@example.com")]
    [InlineData("ADMIN@collega.local", "admin@collega.local")]
    [InlineData("mixed.Case@Domain.io", "mixed.case@domain.io")]
    public void Normalize_TrimsAndLowercases(string input, string expected)
    {
        Assert.Equal(expected, EmailNormalizer.Normalize(input));
    }

    [Fact]
    public void Normalize_NullInput_ReturnsEmpty()
    {
        Assert.Equal(string.Empty, EmailNormalizer.Normalize(null!));
    }
}
