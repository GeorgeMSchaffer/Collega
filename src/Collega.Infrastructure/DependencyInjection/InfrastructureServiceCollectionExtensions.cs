using System.Security.Cryptography;
using Collega.Application.Abstractions;
using Collega.Infrastructure.Auditing;
using Collega.Infrastructure.Imaging;
using Collega.Infrastructure.Notifications;
using Collega.Infrastructure.Persistence;
using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Security;
using Collega.Infrastructure.Seeding;
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

        services.AddDbContext<CollegaDbContext>(options => options.UseNpgsql(connectionString));

        services.AddScoped<IAuditEventWriter, EfAuditEventWriter>();
        services.AddScoped<INotificationEventWriter, EfNotificationEventWriter>();

        services.AddScoped<IUserRepository, EfUserRepository>();
        services.AddScoped<IImpersonationSessionRepository, EfImpersonationSessionRepository>();
        services.AddScoped<IOrganizationRepository, EfOrganizationRepository>();
        services.AddScoped<IStatusRepository, EfStatusRepository>();
        services.AddScoped<IIdeaTypeRepository, EfIdeaTypeRepository>();
        services.AddScoped<IBusinessImpactRepository, EfBusinessImpactRepository>();
        services.AddScoped<IBoardRepository, EfBoardRepository>();
        services.AddScoped<IBoardReader, EfBoardReader>();
        services.AddScoped<IIdeaRepository, EfIdeaRepository>();
        services.AddScoped<ITagRepository, EfTagRepository>();
        services.AddScoped<ICommentRepository, EfCommentRepository>();
        services.AddScoped<IIdeaUpvoteRepository, EfIdeaUpvoteRepository>();
        services.AddScoped<IFieldDefinitionRepository, EfFieldDefinitionRepository>();
        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped<IStartupSeeder, StartupSeeder>();

        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddSingleton<IInviteCodeGenerator, InviteCodeGenerator>();
        services.AddSingleton<IImageProcessor, ImageSharpImageProcessor>();

        services.AddSingleton(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var configuredKey = config["Auth:TokenSigningKey"];
            var signingKey = string.IsNullOrWhiteSpace(configuredKey)
                ? RandomNumberGenerator.GetBytes(32)
                : Convert.FromBase64String(configuredKey);
            var lifetimeMinutes = int.TryParse(config["Auth:AccessTokenLifetimeMinutes"], out var configuredMinutes)
                ? configuredMinutes
                : 480;

            return new AccessTokenOptions { SigningKey = signingKey, Lifetime = TimeSpan.FromMinutes(lifetimeMinutes) };
        });
        services.AddSingleton<JwtAccessTokenService>();
        services.AddSingleton<IAccessTokenIssuer>(sp => sp.GetRequiredService<JwtAccessTokenService>());
        services.AddSingleton<IAccessTokenValidator>(sp => sp.GetRequiredService<JwtAccessTokenService>());

        return services;
    }
}
