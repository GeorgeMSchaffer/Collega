namespace Collega.Infrastructure.Security;

public sealed class AccessTokenOptions
{
    public required byte[] SigningKey { get; init; }

    public TimeSpan Lifetime { get; init; } = TimeSpan.FromHours(8);
}
