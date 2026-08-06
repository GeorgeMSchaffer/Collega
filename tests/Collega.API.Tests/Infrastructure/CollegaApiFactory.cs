using Microsoft.AspNetCore.Mvc.Testing;

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
/// Currently boots against the API's real configuration since there is no
/// DbContext or external dependency registered yet in this slice (Epic 1).
/// Once Infrastructure adds a DbContext backed by a real SQL Server connection
/// string (T002), whoever extends this harness will likely need to override
/// <see cref="WebApplicationFactory{TEntryPoint}.ConfigureWebHost"/> here to swap
/// in the EF Core InMemory provider per the repo's testing conventions
/// (CLAUDE.md: "EF Core tests use the InMemory provider, never a real database"),
/// so integration tests stay hermetic.
/// </remarks>
public sealed class CollegaApiFactory : WebApplicationFactory<Program>
{
}
