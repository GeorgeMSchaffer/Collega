using Collega.Infrastructure.Security;

namespace Collega.Infrastructure.Tests;

public sealed class JwtAccessTokenServiceTests
{
    private static readonly DateTime IssuedAtUtc = new(2026, 8, 8, 12, 0, 0, DateTimeKind.Utc);
    private static readonly byte[] SigningKey = Enumerable.Range(1, 32).Select(value => (byte)value).ToArray();

    [Fact]
    public void Issue_EightHourLifetime_ReturnsExpectedDurationAndValidatesUntilExactExpiry()
    {
        var userId = Guid.NewGuid();
        const string securityStamp = "fixed-security-stamp";
        var service = CreateService(SigningKey);

        var result = service.Issue(userId, securityStamp, IssuedAtUtc);

        Assert.Equal(28_800, result.ExpiresInSeconds);
        Assert.True(service.TryValidate(result.Token, IssuedAtUtc, out var issuedUserId, out var issuedSecurityStamp));
        Assert.Equal(userId, issuedUserId);
        Assert.Equal(securityStamp, issuedSecurityStamp);
        Assert.True(service.TryValidate(result.Token, IssuedAtUtc.AddHours(8).AddSeconds(-1), out _, out _));
        Assert.False(service.TryValidate(result.Token, IssuedAtUtc.AddHours(8), out _, out _));
    }

    [Fact]
    public void TryValidate_WithDifferentSigningKey_ReturnsFalse()
    {
        var token = CreateService(SigningKey).Issue(Guid.NewGuid(), "security-stamp", IssuedAtUtc).Token;
        var differentKey = SigningKey.Select(value => (byte)(value + 1)).ToArray();

        var isValid = CreateService(differentKey).TryValidate(token, IssuedAtUtc, out _, out _);

        Assert.False(isValid);
    }

    private static JwtAccessTokenService CreateService(byte[] signingKey) =>
        new(new AccessTokenOptions
        {
            SigningKey = signingKey,
            Lifetime = TimeSpan.FromHours(8)
        });
}
