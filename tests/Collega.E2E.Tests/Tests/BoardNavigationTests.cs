using Collega.E2E.Tests.Infrastructure;
using Microsoft.Playwright;

namespace Collega.E2E.Tests.Tests;

/// <summary>
/// Board navigation and route terminology
/// (SPEC/40-test-strategy.md → "Board navigation" / "Client UI — Kanban Board").
/// </summary>
[Collection("e2e")]
public class BoardNavigationTests : CollegaPageTest
{
    [Fact(Skip = "Scaffold: enable once a running Client+API and Playwright browsers are available (see CLAUDE.md).")]
    public async Task Boards_route_lists_boards()
    {
        await SignInAsync();

        await GotoAsync("/boards");

        // Demo seed provisions at least one board per org.
        await Expect(Page.GetByRole(AriaRole.Link, new() { Name = "Board" }).First).ToBeVisibleAsync();
    }

    [Fact(Skip = "Scaffold: enable once a running Client+API and Playwright browsers are available (see CLAUDE.md).")]
    public async Task No_workflow_terminology_leaks_into_the_ui()
    {
        await SignInAsync();
        await GotoAsync("/boards");

        var body = await Page.Locator("body").InnerTextAsync();
        Assert.DoesNotContain("Workflow", body, StringComparison.OrdinalIgnoreCase);
    }
}
