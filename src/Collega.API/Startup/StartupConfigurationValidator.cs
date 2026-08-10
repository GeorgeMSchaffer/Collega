namespace Collega.API.Startup;

/// <summary>
/// One-pass validation of the configuration the host must have before it can serve traffic:
/// the seed Site Admin credentials (auth requirement #8) and the database connection string.
/// Program.cs runs this as the very first step so a misconfigured deployment fails immediately
/// with a clear, actionable banner instead of an opaque stack trace deep inside EF Core or the
/// startup seeder. Every missing setting is reported at once rather than one-at-a-time.
/// </summary>
public static class StartupConfigurationValidator
{
    private static readonly RequiredSetting[] RequiredSettings =
    {
        new("SiteAdmin:Email", "SiteAdmin__Email", "the seed Site Admin's login email"),
        new("SiteAdmin:Password", "SiteAdmin__Password", "the seed Site Admin's initial password"),
        new("ConnectionStrings:DefaultConnection", "ConnectionStrings__DefaultConnection", "the SQL Server connection string"),
    };

    /// <summary>
    /// Returns every required setting that is absent or blank in <paramref name="configuration"/>,
    /// in declaration order. An empty list means configuration is complete.
    /// </summary>
    public static IReadOnlyList<RequiredSetting> FindMissing(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var missing = new List<RequiredSetting>();
        foreach (var setting in RequiredSettings)
        {
            if (string.IsNullOrWhiteSpace(configuration[setting.ConfigurationKey]))
            {
                missing.Add(setting);
            }
        }

        return missing;
    }

    /// <summary>
    /// Builds a framed, human-readable banner naming each missing setting, what it is for, and the
    /// environment variable that supplies it. Intended to be written to stderr before the process
    /// exits with a non-zero code.
    /// </summary>
    public static string FormatMissingConfigurationMessage(IReadOnlyList<RequiredSetting> missing)
    {
        ArgumentNullException.ThrowIfNull(missing);

        const string rule = "========================================================================";
        var builder = new System.Text.StringBuilder();

        builder.AppendLine(rule);
        builder.AppendLine("  Collega API cannot start: required configuration is missing");
        builder.AppendLine(rule);
        builder.AppendLine();
        builder.AppendLine("The following settings must be provided before the application can boot:");
        builder.AppendLine();

        foreach (var setting in missing)
        {
            builder.AppendLine($"  * {setting.ConfigurationKey}");
            builder.AppendLine($"      {setting.Description}");
            builder.AppendLine($"      set environment variable: {setting.EnvironmentVariable}");
            builder.AppendLine();
        }

        builder.AppendLine("Supply these via environment variables (shown above), an appsettings file,");
        builder.AppendLine("or `dotnet user-secrets` for local development.");
        builder.AppendLine("See SPEC/20-feature-auth.md requirement #8.");
        builder.AppendLine(rule);

        return builder.ToString();
    }
}

/// <summary>
/// A single required configuration value: its ASP.NET Core configuration key, the equivalent
/// environment-variable name (double-underscore form), and a short human description.
/// </summary>
public sealed record RequiredSetting(string ConfigurationKey, string EnvironmentVariable, string Description);
