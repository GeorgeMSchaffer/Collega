using Microsoft.Playwright;
using Microsoft.Playwright.Xunit;

namespace Collega.E2E.Tests.Infrastructure;

/// <summary>
/// Base class for Collega browser tests. Extends Playwright's <see cref="PageTest"/>
/// (fresh browser context + page per test, trace/screenshot on failure) and layers on
/// Collega-specific helpers: base-URL wiring, a Fluent-aware field filler, and a sign-in flow.
///
/// Prefer role/text locators over brittle CSS selectors so tests survive markup churn.
/// The exception is Fluent UI web components (see <see cref="FillFluentFieldAsync"/> and
/// CLAUDE.md → "Fluent UI web-component gotchas").
/// </summary>
public abstract class CollegaPageTest : PageTest
{
    protected static string BaseUrl => E2ETestConfig.BaseUrl;

    /// <summary>Every context starts at the running Client and ignores dev-cert issues.</summary>
    public override BrowserNewContextOptions ContextOptions() => new()
    {
        BaseURL = E2ETestConfig.BaseUrl,
        IgnoreHTTPSErrors = true,
    };

    /// <summary>Navigate relative to the configured base URL and wait for the SPA to settle.</summary>
    protected Task GotoAsync(string relativePath) =>
        Page.GotoAsync(relativePath, new() { WaitUntil = WaitUntilState.NetworkIdle });

    /// <summary>
    /// Fill a &lt;fluent-text-field id="..."&gt;. The real &lt;input&gt; lives in the component's
    /// (open) shadow root, so we address it through the host id — Playwright's selector engine
    /// pierces open shadow DOM. Filling the inner input fires input/change events, which Blazor's
    /// @bind-Value observes.
    /// </summary>
    protected Task FillFluentFieldAsync(string hostId, string value) =>
        Page.Locator($"#{hostId}").Locator("input, textarea").First.FillAsync(value);

    /// <summary>
    /// Sign in through the real login form and wait for the workspace to load.
    /// Defaults to the seeded Org Admin (no forced password change). Pass credentials
    /// for accounts whose flow you want to assert (e.g. a forced-change account).
    /// </summary>
    protected async Task SignInAsync(string? email = null, string? password = null)
    {
        var (defaultEmail, defaultPassword) = E2ETestConfig.OrgAdmin;
        email ??= defaultEmail;
        password ??= defaultPassword;

        await GotoAsync("/login");
        await FillFluentFieldAsync("email", email);
        await FillFluentFieldAsync("password", password);
        await Page.GetByRole(AriaRole.Button, new() { Name = "Sign in" }).ClickAsync();

        // Landing anywhere other than /login or /change-password means auth succeeded.
        await Page.WaitForURLAsync(url => !url.Contains("/login") && !url.Contains("/change-password"));
    }
}
