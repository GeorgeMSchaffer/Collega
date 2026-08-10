using Collega.E2E.Tests.Infrastructure;
using Microsoft.Playwright;

namespace Collega.E2E.Tests.Tests;

/// <summary>
/// Release-readiness smoke test for the MVP critical path
/// (SPEC/40-test-strategy.md → "Smoke Tests"): sign in → create a board → create an idea.
///
/// NOTE: assertions are intentionally coarse and locator names are best-effort against the
/// current UI. GetByRole's Name is a case-insensitive substring match by default. These are the
/// scaffold's worked example; tighten selectors against the running app when wiring into CI
/// (see CLAUDE.md → "Status of each case").
/// </summary>
[Collection("e2e")]
public class SmokeTests : CollegaPageTest
{
    [Fact(Skip = "Scaffold: enable once a running Client+API and Playwright browsers are available (see CLAUDE.md).")]
    public async Task Signin_lands_on_workspace()
    {
        await SignInAsync();

        // The signed-in workspace shows the icon rail (Home/Boards/Ideas/Settings).
        await Expect(Page.GetByRole(AriaRole.Link, new() { Name = "Boards" })).ToBeVisibleAsync();
    }

    [Fact(Skip = "Scaffold: enable once a running Client+API and Playwright browsers are available (see CLAUDE.md).")]
    public async Task Create_board_then_create_idea_on_it()
    {
        await SignInAsync();

        // 1. Create a board with the default status structure.
        await GotoAsync("/settings/boards/new");
        await FillFluentFieldAsync("name", "E2E Smoke Board");
        await Page.GetByRole(AriaRole.Button, new() { Name = "Save" }).ClickAsync();
        await Expect(Page.GetByText("E2E Smoke Board")).ToBeVisibleAsync();

        // 2. Create an idea and confirm it appears without validation errors.
        await GotoAsync("/ideas");
        await Page.GetByRole(AriaRole.Button, new() { Name = "New idea" }).ClickAsync();
        await FillFluentFieldAsync("title", "E2E Smoke Idea");
        await Page.GetByRole(AriaRole.Button, new() { Name = "Create" }).ClickAsync();

        await Expect(Page.GetByText("E2E Smoke Idea")).ToBeVisibleAsync();
        await Expect(Page.GetByRole(AriaRole.Alert)).Not.ToBeVisibleAsync();
    }
}
