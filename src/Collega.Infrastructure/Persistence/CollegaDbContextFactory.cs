using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Collega.Infrastructure.Persistence;

/// <summary>
/// Design-time factory for `dotnet ef` tooling. The Infrastructure project has no appsettings of
/// its own and auto-discovery of the minimal-hosting Program in Collega.API proved unreliable for
/// resolving configuration at design time, so this factory resolves the connection string
/// explicitly: the ConnectionStrings__DefaultConnection environment variable if set, otherwise the
/// same local default used by src/Collega.API/appsettings.Development.json. Not used at runtime —
/// Collega.API wires the real DbContext through AddInfrastructure/Program.cs.
/// </summary>
public sealed class CollegaDbContextFactory : IDesignTimeDbContextFactory<CollegaDbContext>
{
    private const string LocalDevelopmentDefault =
        "Host=localhost;Port=5432;Database=Collega;Username=postgres;Password=Ch4ngeMe!Now";

    public CollegaDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? LocalDevelopmentDefault;

        var optionsBuilder = new DbContextOptionsBuilder<CollegaDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new CollegaDbContext(optionsBuilder.Options);
    }
}
