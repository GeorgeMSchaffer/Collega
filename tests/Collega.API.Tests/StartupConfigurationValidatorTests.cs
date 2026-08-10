using Collega.API.Startup;
using Microsoft.Extensions.Configuration;

namespace Collega.API.Tests;

/// <summary>
/// Hermetic unit coverage for the boot-time configuration validation pass (auth requirement #8).
/// Verifies that every required setting is reported when absent or blank, that a complete
/// configuration reports nothing, and that the failure banner names each missing setting and its
/// environment variable. No host, network, or database — pure in-memory configuration.
/// </summary>
public sealed class StartupConfigurationValidatorTests
{
    private static IConfiguration BuildConfiguration(params (string Key, string? Value)[] pairs)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(pairs.Select(p => new KeyValuePair<string, string?>(p.Key, p.Value)))
            .Build();
    }

    private static (string Key, string? Value)[] CompleteConfiguration() => new (string, string?)[]
    {
        ("SiteAdmin:Email", "admin@collega.test"),
        ("SiteAdmin:Password", "Test123!Password"),
        ("ConnectionStrings:DefaultConnection", "Server=(localdb)\\MSSQLLocalDB;Database=Collega;Trusted_Connection=True"),
    };

    [Fact]
    public void FindMissing_ReturnsEmpty_WhenAllRequiredSettingsPresent()
    {
        // Arrange
        var configuration = BuildConfiguration(CompleteConfiguration());

        // Act
        var missing = StartupConfigurationValidator.FindMissing(configuration);

        // Assert
        Assert.Empty(missing);
    }

    [Fact]
    public void FindMissing_ReportsAllRequiredSettings_WhenConfigurationEmpty()
    {
        // Arrange
        var configuration = BuildConfiguration();

        // Act
        var missing = StartupConfigurationValidator.FindMissing(configuration);

        // Assert
        Assert.Equal(
            new[] { "SiteAdmin:Email", "SiteAdmin:Password", "ConnectionStrings:DefaultConnection" },
            missing.Select(m => m.ConfigurationKey));
    }

    [Theory]
    [InlineData("SiteAdmin:Email")]
    [InlineData("SiteAdmin:Password")]
    [InlineData("ConnectionStrings:DefaultConnection")]
    public void FindMissing_ReportsSetting_WhenBlank(string blankedKey)
    {
        // Arrange: start complete, then blank exactly one setting.
        var pairs = CompleteConfiguration()
            .Select(p => p.Key == blankedKey ? (p.Key, (string?)"   ") : p)
            .ToArray();
        var configuration = BuildConfiguration(pairs);

        // Act
        var missing = StartupConfigurationValidator.FindMissing(configuration);

        // Assert
        Assert.Equal(new[] { blankedKey }, missing.Select(m => m.ConfigurationKey));
    }

    [Fact]
    public void FormatMissingConfigurationMessage_NamesEachMissingSettingAndEnvironmentVariable()
    {
        // Arrange
        var configuration = BuildConfiguration(("SiteAdmin:Email", "admin@collega.test"));
        var missing = StartupConfigurationValidator.FindMissing(configuration);

        // Act
        var message = StartupConfigurationValidator.FormatMissingConfigurationMessage(missing);

        // Assert
        Assert.Contains("required configuration is missing", message);
        Assert.Contains("SiteAdmin:Password", message);
        Assert.Contains("SiteAdmin__Password", message);
        Assert.Contains("ConnectionStrings:DefaultConnection", message);
        Assert.Contains("ConnectionStrings__DefaultConnection", message);
        // A present setting must not be listed as missing.
        Assert.DoesNotContain("SiteAdmin__Email", message);
    }
}
