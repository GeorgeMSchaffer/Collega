using Collega.E2E.Tests.Infrastructure;
using Microsoft.Playwright;

namespace Collega.E2E.Tests.Tests;

/// <summary>
/// Regression coverage for two Bug Triage fixes:
///  • every drill-in list view (a page reached *from* a rail destination) exposes a "Back"
///    control, for all roles — the primary rail destinations themselves (/settings, /boards,
///    /ideas) intentionally omit it, since they are top-level nav, not "back"-able (commit c15454a);
///  • every admin list view exposes an "Add New" action for a role that can create;
///  • the Back control returns to the previous page.
///
/// Signed in as the seeded Org Admin, whose Settings list views are org-scoped and all grant
/// create rights. (The Site Admin *global* aggregated views route "Add New" to the Organizations
/// list instead — covered separately once a Site Admin seed without a forced password change exists.)
/// </summary>
[Collection("e2e")]
public class SettingsNavigationTests : CollegaPageTest
{
    // Drill-in list views (reached from a rail destination). Each shows a Back control for all
    // roles. The primary rail destinations themselves (/settings, /boards, /ideas) intentionally
    // omit Back — top-level nav is not "back"-able (see commit c15454a).
    private static readonly string[] ListViews =
    {
        "/settings/statuses",
        "/settings/idea-types",
        "/settings/fields",
        "/settings/users",
        "/settings/boards",
    };

    // Admin list views that let an Org Admin create, with the label of their create control.
    private static readonly (string Route, string AddNew)[] AdminLists =
    {
        ("/settings/statuses", "New status"),
        ("/settings/idea-types", "New idea type"),
        ("/settings/fields", "New field"),
        ("/settings/users", "New user"),
        ("/settings/boards", "New board"),
    };

    [Fact(Skip = "E2E: needs a running Client+API; verified passing 2026-08-10 (see CLAUDE.md).")]
    public async Task Every_list_view_shows_a_back_button()
    {
        await SignInAsync();

        foreach (var route in ListViews)
        {
            await GotoAsync(route);
            await Expect(Page.GetByRole(AriaRole.Button, new() { Name = "Back" }))
                .ToBeVisibleAsync(new() { Timeout = 15_000 });
        }
    }

    [Fact(Skip = "E2E: needs a running Client+API; verified passing 2026-08-10 (see CLAUDE.md).")]
    public async Task Admin_lists_show_an_add_new_action()
    {
        await SignInAsync();

        foreach (var (route, addNew) in AdminLists)
        {
            await GotoAsync(route);

            // The create control is a button on inline-edit pages and a link on routed-form pages.
            var control = Page.GetByRole(AriaRole.Button, new() { Name = addNew })
                .Or(Page.GetByRole(AriaRole.Link, new() { Name = addNew }));
            await Expect(control.First).ToBeVisibleAsync(new() { Timeout = 15_000 });
        }
    }

    [Fact(Skip = "E2E: needs a running Client+API; verified passing 2026-08-10 (see CLAUDE.md).")]
    public async Task Back_button_returns_to_the_previous_page()
    {
        await SignInAsync();

        // Settings hub → open Statuses via its link (SPA navigation)…
        await GotoAsync("/settings");
        await Page.GetByRole(AriaRole.Link, new() { Name = "Manage statuses" }).ClickAsync();
        await Page.WaitForURLAsync(url => url.Contains("/settings/statuses"));

        // …then Back returns to the hub.
        await Page.GetByRole(AriaRole.Button, new() { Name = "Back" }).ClickAsync();
        await Page.WaitForURLAsync(url => url.TrimEnd('/').EndsWith("/settings"));

        Assert.EndsWith("/settings", Page.Url.TrimEnd('/'));
    }
}
