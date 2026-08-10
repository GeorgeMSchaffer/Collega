using Collega.E2E.Tests.Infrastructure;
using Microsoft.Playwright;

namespace Collega.E2E.Tests.Tests;

/// <summary>
/// Authentication routing / session behavior at the browser boundary
/// (SPEC/40-test-strategy.md → "Smoke Tests" auth items).
/// </summary>
[Collection("e2e")]
public class AuthNavigationTests : CollegaPageTest
{
    [Fact(Skip = "Scaffold: enable once a running Client+API and Playwright browsers are available (see CLAUDE.md).")]
    public async Task Protected_route_redirects_anonymous_to_login()
    {
        await GotoAsync("/settings");

        await Page.WaitForURLAsync(url => url.Contains("/login"));
        await Expect(Page.GetByRole(AriaRole.Button, new() { Name = "Sign in" })).ToBeVisibleAsync();
    }

    [Fact(Skip = "Scaffold: enable once a running Client+API and Playwright browsers are available (see CLAUDE.md).")]
    public async Task Successful_login_lands_on_home()
    {
        await SignInAsync();

        Assert.Equal($"{BaseUrl}/", Page.Url.TrimEnd('/') + "/");
    }

    [Fact(Skip = "Scaffold: enable once a running Client+API and Playwright browsers are available (see CLAUDE.md).")]
    public async Task Logout_clears_session_and_returns_to_login()
    {
        await SignInAsync();

        await GotoAsync("/logout");

        await Page.WaitForURLAsync(url => url.Contains("/login"));

        // Session is gone: a protected route should bounce back to /login.
        await GotoAsync("/settings");
        await Page.WaitForURLAsync(url => url.Contains("/login"));
    }

    [Fact(Skip = "Scaffold: enable once a running Client+API and Playwright browsers are available (see CLAUDE.md).")]
    public async Task Valid_session_survives_browser_reload()
    {
        await SignInAsync();

        await Page.ReloadAsync(new() { WaitUntil = WaitUntilState.NetworkIdle });

        // Still authenticated — not bounced to /login by the token-restoration flow.
        Assert.DoesNotContain("/login", Page.Url);
    }
}
