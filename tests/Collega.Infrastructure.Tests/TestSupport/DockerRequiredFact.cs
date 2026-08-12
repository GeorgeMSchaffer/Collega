using System.Diagnostics;

namespace Collega.Infrastructure.Tests.TestSupport;

/// <summary>
/// A <see cref="FactAttribute"/> that skips — rather than fails — when no Docker daemon is
/// reachable, so the container-backed PostgreSQL tests do not break a CI agent without Docker.
/// </summary>
/// <remarks>
/// This project is on xUnit v2, which resolves <see cref="FactAttribute.Skip"/> at discovery time
/// and has no runtime <c>Assert.Skip</c>. The probe therefore runs when the attribute is
/// constructed, and <see cref="DockerAvailability"/> caches its result for the test process.
/// </remarks>
public sealed class DockerRequiredFactAttribute : FactAttribute
{
    public DockerRequiredFactAttribute()
    {
        if (!DockerAvailability.IsAvailable)
        {
            Skip = DockerAvailability.SkipReason;
        }
    }
}

/// <summary>Cached "is a Docker daemon reachable?" probe.</summary>
internal static class DockerAvailability
{
    public const string SkipReason = "No reachable Docker daemon; skipping the PostgreSQL container tests.";

    private const int ProbeTimeoutMilliseconds = 15_000;

    private static readonly Lazy<bool> Probe = new(ProbeDaemon, LazyThreadSafetyMode.ExecutionAndPublication);

    public static bool IsAvailable => Probe.Value;

    /// <summary>
    /// Shells out to the Docker CLI because Testcontainers exposes no public capability check.
    /// </summary>
    /// <remarks>
    /// This is a heuristic in both directions. A daemon reachable only through <c>DOCKER_HOST</c>
    /// with no CLI installed reads as unavailable and the tests skip — the safe direction for a
    /// probe that must never fail the run. Conversely, a healthy CLI does not guarantee
    /// Testcontainers can resolve the same endpoint (a docker context pointing at Colima, Rancher,
    /// or a rootless socket), in which case the container start fails the test rather than skipping
    /// it. Widen the probe here if that case ever shows up in practice.
    /// </remarks>
    private static bool ProbeDaemon()
    {
        try
        {
            // --format keeps stdout to one line, so the redirected pipe cannot fill and deadlock.
            var startInfo = new ProcessStartInfo("docker", "info --format {{.ServerVersion}}")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            using var process = Process.Start(startInfo);
            if (process is null)
            {
                return false;
            }

            if (!process.WaitForExit(ProbeTimeoutMilliseconds))
            {
                process.Kill(entireProcessTree: true);
                return false;
            }

            return process.ExitCode == 0;
        }
        catch (Exception)
        {
            // Docker CLI missing (Win32Exception), sandboxed process start, etc.
            return false;
        }
    }
}
