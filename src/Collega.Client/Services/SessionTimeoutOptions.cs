namespace Collega.Client.Services;

public sealed class SessionTimeoutOptions
{
    public TimeSpan IdleTimeout { get; init; } = TimeSpan.FromMinutes(30);

    public TimeSpan WarningAfter { get; init; } = TimeSpan.FromMinutes(28);
}
