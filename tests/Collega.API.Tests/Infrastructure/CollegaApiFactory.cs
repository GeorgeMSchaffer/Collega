using Collega.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Collega.API.Tests.Infrastructure;

/// <summary>
/// Shared integration-test harness for Collega.API. Boots the real ASP.NET Core
/// host in-memory via <see cref="WebApplicationFactory{TEntryPoint}"/> so tests can
/// exercise the actual request pipeline (routing, middleware, error handling)
/// instead of a hand-rolled substitute.
/// </summary>
/// <remarks>
/// Requires <c>public partial class Program</c> in <c>src/Collega.API/Program.cs</c>
/// (a testing-only shim; see that file) because top-level statements otherwise
/// generate an internal, unreachable <c>Program</c> type.
///
/// Updated for the Auth slice (Epic 2, T005-T011), which is the first slice to add a real
/// DbContext-backed startup path: Program.cs now fails fast unless SiteAdmin:Email/Password are
/// configured, and it migrates/seeds the database on every boot.
///
/// Reviewer note: SiteAdmin credentials are supplied via real process environment variables set in
/// the constructor below, NOT via <c>ConfigureWebHost</c>/<c>ConfigureAppConfiguration</c>. That's
/// deliberate, not an oversight — Program.cs's fail-fast check and <c>AddInfrastructure</c> call
/// run as plain top-level statements executed synchronously before
/// <c>WebApplicationBuilder.Build()</c>, but <c>WebApplicationFactory</c>'s
/// <c>ConfigureWebHost</c> hooks (for a minimal-hosting entry point) are only spliced in at the
/// intercepted <c>Build()</c> call itself — too late for code that already read
/// <c>builder.Configuration</c> earlier in the file. Environment variables don't have that problem
/// because the default <c>AddEnvironmentVariables()</c> config source reads the current process
/// environment as soon as it's added during <c>CreateBuilder()</c>, which happens well before this
/// factory's first host build. The DbContext provider swap below, by contrast, targets the
/// service collection (via <c>ConfigureServices</c>), which — unlike configuration — genuinely is
/// still open for modification at <c>Build()</c> time, so that override works as commonly
/// documented for this pattern; see CLAUDE.md's testing conventions ("EF Core tests use the
/// InMemory provider, never a real database").
/// </remarks>
public sealed class CollegaApiFactory : WebApplicationFactory<Program>
{
    // Fixed per factory INSTANCE (not regenerated inside ConfigureServices) because
    // WebApplicationFactory can invoke ConfigureWebHost/ConfigureServices more than once while
    // building a minimal-hosting Program — a name generated inside the lambda would then point
    // successive builds at different InMemory databases, so seeding (which runs during host
    // startup) and request handling (served by whichever build wins) would silently see different,
    // disconnected data stores.
    private readonly string _inMemoryDatabaseName = $"collega-api-tests-{Guid.NewGuid()}";

    public CollegaApiFactory()
    {
        // Must be set before the first host build (constructor runs before any CreateClient()/
        // Server access) so Program.cs's synchronous fail-fast check and AddInfrastructure() see
        // them — see the ConfigureAppConfiguration-vs-environment-variables note above.
        Environment.SetEnvironmentVariable("SiteAdmin__Email", "siteadmin@collega.test");
        Environment.SetEnvironmentVariable("SiteAdmin__Password", "Test123!Password");
    }

    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            var dbContextOptionsDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<CollegaDbContext>));
            if (dbContextOptionsDescriptor is not null)
            {
                services.Remove(dbContextOptionsDescriptor);
            }

            services.AddDbContext<CollegaDbContext>(options =>
                options.UseInMemoryDatabase(_inMemoryDatabaseName));
        });

        base.ConfigureWebHost(builder);
    }
}
