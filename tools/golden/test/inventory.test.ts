// The inventory is read from the real controllers, so these tests pin the
// parser against the shapes this codebase actually uses — a class-level
// [Route] prefix, two controllers in one file, [Authorize] above [HttpGet].

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { readInventory } from "../src/inventory.ts";
import { report as coverageReport, expectedRoles } from "../src/coverage.ts";
import { scenarioFor } from "../src/scaffold.ts";

const SAMPLE = `
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

[ApiController]
[Route("auth")]
public sealed class AuthController : ControllerBase
{
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request) => Ok();

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Me() => Ok();
}

[ApiController]
[Authorize(Roles = "OrgAdmin,SiteAdmin")]
[Route("organizations/{organizationId:guid}/ai-assist")]
public sealed class OrganizationAiAssistController : ControllerBase
{
    private readonly IThing _thing;

    public OrganizationAiAssistController(IThing thing)
    {
        _thing = thing;
    }

    [HttpGet("usage")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOrganizationUsage(Guid organizationId) => Ok();
}
`;

async function inventoryOf(source: string) {
  const dir = await mkdtemp(path.join(tmpdir(), "inventory-"));
  try {
    await writeFile(path.join(dir, "SampleController.cs"), source);
    return await readInventory(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("routes combine the class prefix with the method template, constraints stripped", async () => {
  const endpoints = await inventoryOf(SAMPLE);
  assert.deepEqual(
    endpoints.map((e) => e.id),
    [
      "POST /auth/login",
      "GET /auth/me",
      "GET /organizations/{organizationId}/ai-assist/usage",
    ],
  );
  assert.deepEqual(endpoints[2].params, ["organizationId"]);
});

test("a second controller in the same file gets its own prefix and roles", async () => {
  const endpoints = await inventoryOf(SAMPLE);
  assert.equal(endpoints[2].controller, "OrganizationAiAssist");
  assert.deepEqual(endpoints[2].authorize, ["OrgAdmin", "SiteAdmin"]);
});

test("[Authorize] above [HttpGet] still applies to that action", async () => {
  const endpoints = await inventoryOf(SAMPLE);
  assert.equal(endpoints[0].authorize, "anonymous", "login is reachable without a token");
  assert.equal(endpoints[1].authorize, "any", "GET /auth/me is not");
});

test("declared response statuses come along", async () => {
  const endpoints = await inventoryOf(SAMPLE);
  assert.deepEqual(endpoints[0].statuses, [200, 401]);
});

test("a constructor is not an action", async () => {
  const endpoints = await inventoryOf(SAMPLE);
  assert.equal(endpoints.filter((e) => e.action.endsWith("Controller")).length, 0);
});

test("two actions claiming one route is an error, not a silent overwrite", async () => {
  const clash = SAMPLE.replace("GetOrganizationUsage", "Login").replace(
    '[Route("organizations/{organizationId:guid}/ai-assist")]',
    '[Route("auth")]',
  ).replace('[HttpGet("usage")]', '[HttpPost("login")]');
  await assert.rejects(() => inventoryOf(clash), /two actions claim POST \/auth\/login/);
});

test("the live controllers still parse to the 81 endpoints the plan is costed on", async () => {
  const endpoints = await readInventory(
    path.resolve(import.meta.dirname, "..", "..", "..", "src", "Collega.API", "Controllers"),
  );
  assert.equal(endpoints.length, 81);
  assert.deepEqual(
    endpoints.filter((e) => e.authorize === "anonymous").map((e) => e.id).sort(),
    ["GET /health", "POST /auth/login", "POST /auth/register"],
  );
});

test("coverage counts an endpoint no scenario touches", async () => {
  const endpoints = await inventoryOf(SAMPLE);
  const r = coverageReport(endpoints, [
    { endpoint: "POST /auth/login", role: "anonymous", kind: "success" },
  ]);
  assert.equal(r.covered, 1);
  assert.deepEqual(r.untouched, ["GET /auth/me", "GET /organizations/{organizationId}/ai-assist/usage"]);
  assert.deepEqual(r.successOnly, ["POST /auth/login"]);
});

test("coverage names the roles an endpoint is missing", async () => {
  const endpoints = await inventoryOf(SAMPLE);
  const r = coverageReport(endpoints, [
    { endpoint: "GET /auth/me", role: "OrgAdmin", kind: "success" },
    { endpoint: "GET /auth/me", role: "anonymous", kind: "denied" },
  ]);
  const partial = r.partialRoles.find((p) => p.endpoint === "GET /auth/me");
  assert.deepEqual(partial?.missing, ["SiteAdmin", "User", "ReadOnly"]);
});

test("an authorized endpoint expects all four roles plus anonymous", async () => {
  const endpoints = await inventoryOf(SAMPLE);
  assert.deepEqual(expectedRoles(endpoints[0]), ["anonymous"]);
  assert.equal(expectedRoles(endpoints[1]).length, 5);
});

test("the scaffold writes a cell per role, with the status each should see", async () => {
  const endpoints = await inventoryOf(SAMPLE);
  const scenario = scenarioFor("Auth", endpoints.slice(0, 2));
  assert.equal(scenario.steps.length, 1 + 5);
  assert.ok(scenario.steps.every((s) => s.todo === true));

  const anonymousMe = scenario.steps.find((s) => s.id === "me.anonymous");
  assert.deepEqual([anonymousMe?.kind, anonymousMe?.expect], ["denied", 401]);
  const adminMe = scenario.steps.find((s) => s.id === "me.orgadmin");
  assert.deepEqual([adminMe?.kind, adminMe?.expect], ["success", 200]);
});

test("the scaffold turns route parameters into bindable variables", async () => {
  const endpoints = await inventoryOf(SAMPLE);
  const scenario = scenarioFor("OrganizationAiAssist", endpoints.slice(2));
  assert.equal(scenario.steps[0].path, "/organizations/{{organizationId}}/ai-assist/usage");

  const refused = scenario.steps.find((s) => s.id === "getorganizationusage.user");
  assert.deepEqual([refused?.kind, refused?.expect], ["denied", 401], "no 403 is declared on this action");
});
