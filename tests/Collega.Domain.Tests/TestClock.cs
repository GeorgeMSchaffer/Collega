namespace Collega.Domain.Tests;

/// <summary>Fixed timestamps for hermetic domain tests (no <c>DateTime.Now</c>).</summary>
internal static class TestClock
{
    public static readonly DateTime Now = new(2026, 8, 8, 12, 0, 0, DateTimeKind.Utc);
}
