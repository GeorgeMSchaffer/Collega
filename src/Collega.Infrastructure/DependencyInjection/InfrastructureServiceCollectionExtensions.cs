using System.Security.Cryptography;
using Collega.Application.Abstractions;
using Collega.Application.Ai;
using Collega.Infrastructure.Ai;
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
        services.AddScoped<IAiUsageRepository, EfAiUsageRepository>();
        services.AddScoped<IAiUsageService, AiUsageService>();
        services.AddScoped<IdeaAssistContextBuilder>();
        services.AddScoped<IIdeaAssistService, IdeaAssistService>();
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
        // AI cost controls. Limits are configuration, never hard-coded (rule 26); the defaults here
        // are the values agreed with the user on 2026-08-16 and are what a deployment gets if it
        // configures nothing. A non-positive DailyTokenLimit disables the gate entirely — intended
        // for local work, never for a deployment.
        services.AddSingleton(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var defaults = new AiUsageLimits();

            return new AiUsageLimits
            {
                DailyTokenLimit = long.TryParse(config["Ai:DailyTokenLimit"], out var limit)
                    ? limit
                    : defaults.DailyTokenLimit,
                Model = config["Ai:Model"] is { Length: > 0 } model ? model : defaults.Model,
                Effort = config["Ai:Effort"] is { Length: > 0 } effort ? effort : defaults.Effort,
                InputRatePerMillion = decimal.TryParse(config["Ai:Pricing:InputPerMillion"], out var inputRate)
                    ? inputRate
                    : defaults.InputRatePerMillion,
                OutputRatePerMillion = decimal.TryParse(config["Ai:Pricing:OutputPerMillion"], out var outputRate)
                    ? outputRate
                    : defaults.OutputRatePerMillion,

                // Rule 26: limits are configuration, never hard-coded. Non-positive disables, same
                // convention as DailyTokenLimit.
                RateLimitWindowSeconds = int.TryParse(config["Ai:RateLimit:WindowSeconds"], out var window)
                    ? window
                    : defaults.RateLimitWindowSeconds,
                PerUserCallsPerWindow = int.TryParse(config["Ai:RateLimit:PerUserCalls"], out var perUser)
                    ? perUser
                    : defaults.PerUserCallsPerWindow,
                PerOrganizationCallsPerWindow = int.TryParse(config["Ai:RateLimit:PerOrganizationCalls"], out var perOrg)
                    ? perOrg
                    : defaults.PerOrganizationCallsPerWindow,
            };
        });

        // The deployment AI credential. Absent is a supported state — the feature runs dark (rule 31),
        // so this must never fail startup the way the SiteAdmin keys do.
        services.AddSingleton(sp => new AiCredentials
        {
            ApiKey = sp.GetRequiredService<IConfiguration>()["Ai:ApiKey"],
        });

        // Singleton: the model client is stateless and holds an HTTP client, so one per process.
        services.AddSingleton<IIdeaDraftModel, AnthropicIdeaDraftModel>();

        services.AddSingleton<JwtAccessTokenService>();
        services.AddSingleton<IAccessTokenIssuer>(sp => sp.GetRequiredService<JwtAccessTokenService>());
        services.AddSingleton<IAccessTokenValidator>(sp => sp.GetRequiredService<JwtAccessTokenService>());

        return services;
    }

    /// <summary>
    /// Registers the Development-only factory that builds draft models carrying a caller-supplied
    /// system prompt (see <see cref="AnthropicIdeaDraftModelFactory"/>).
    /// </summary>
    /// <remarks>
    /// Separate from <see cref="AddInfrastructure"/> because it needs the host environment, which is
    /// not configuration. Registered unconditionally and made inert by the flag rather than skipped
    /// outside Development: a missing registration turns a routing regression into a resolution
    /// failure at activation, where refusing inside the factory keeps the failure specific and the
    /// capability equally dead.
    /// </remarks>
    public static IServiceCollection AddIdeaDraftModelFactory(this IServiceCollection services, bool isDevelopment)
    {
        services.AddSingleton<IIdeaDraftModelFactory>(sp => new AnthropicIdeaDraftModelFactory(
            sp.GetRequiredService<AiUsageLimits>(),
            sp.GetRequiredService<AiCredentials>(),
            isDevelopment));

        return services;
    }
}
