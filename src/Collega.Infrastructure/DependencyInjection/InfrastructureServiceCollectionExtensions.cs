using Collega.Application.Abstractions;
using Collega.Infrastructure.Auditing;
using Collega.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Collega.Infrastructure.DependencyInjection;

public static class InfrastructureServiceCollectionExtensions
{
    public const string ConnectionStringName = "DefaultConnection";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName);

        services.AddDbContext<CollegaDbContext>(options => options.UseSqlServer(connectionString));

        services.AddScoped<IAuditEventWriter, EfAuditEventWriter>();

        return services;
    }
}
