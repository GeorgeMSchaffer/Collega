using System.Net.Http.Json;
using System.Text.Json;

namespace Collega.API.Tests.Infrastructure;

/// <summary>
/// Puts an already-Site-Admin-authenticated client into a View As session, so that org-content
/// mutations in a test go through the path the product now requires.
/// </summary>
/// <remarks>
/// <para>Since rule 25 (SPEC/20-feature-view-as.md) a Site Admin acting as themselves is refused
/// <c>403</c> on any create, edit or delete of organization-owned content. Integration tests
/// historically did all their setup as the Site Admin because it was the most privileged account
/// available — so nearly every one of them broke on that rule.</para>
///
/// <para>Rather than re-actor each test to a different user, this helper keeps the existing client
/// and elevates it the way the product intends: create an Org Admin in the target organization
/// (still permitted directly — that is the bootstrap exception, rule 26), then start a session as
/// them. The test body continues unchanged, and now exercises the real Site-Admin-mutates-org-content
/// path end to end, which nothing otherwise covers.</para>
///
/// <para>Note what this deliberately does <i>not</i> do: it never bypasses the rule. The mutation
/// still has to be legal for the impersonated Org Admin, so a test that was passing only because
/// Site Admin skipped an org-scope check will still fail — correctly.</para>
/// </remarks>
public static class ViewAsAuth
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Creates an Org Admin in <paramref name="organizationId"/> and leaves <paramref name="client"/>
    /// acting as them. Returns the impersonated user's id for tests that need to assert on authorship.
    /// </summary>
    /// <remarks>
    /// <para>Safe to call with a session already open: it ends that one first, so a test that moves
    /// between two organizations just calls this again with the one it wants.</para>
    ///
    /// <para><b>Call this explicitly, from the test body — never from a shared setup helper.</b> The
    /// <c>CreateOrganizationAsync</c> helpers in this project used to end with it, which read as a
    /// convenience and behaved as a trap: a test body silently continued as an Org Admin of whichever
    /// organization was created <i>last</i>, so tests operating on an earlier one failed for a reason
    /// unrelated to what they asserted. It also added an Org Admin to every organization any test
    /// created, quietly inflating membership lists, View As candidate lists and notification fan-out.
    /// Opting in per test costs one visible line and makes both the actor and the target organization
    /// readable at the point they matter.</para>
    /// </remarks>
    public static async Task<Guid> ActAsOrgAdminAsync(HttpClient client, Guid organizationId)
    {
        // Sessions are non-nestable, and creating the Org Admin below is itself a Site-Admin-only
        // action, so any live session has to be closed before either step.
        await StopActingAsync(client);


        // Unique per call: test classes share one InMemory database via IClassFixture, so a fixed
        // address would collide across tests in the same class (email is globally unique).
        var email = $"viewas-{Guid.NewGuid():N}@collega.test";

        var create = await client.PostAsJsonAsync(
            $"/api/v1/organizations/{organizationId}/users",
            new
            {
                firstName = "View",
                lastName = "Asadmin",
                email,
                role = "OrgAdmin",
                // Required by the create-user contract; the account is never logged into directly —
                // it exists only to be acted as.
                initialPassword = "Str0ng!Passw0rd"
            });
        create.EnsureSuccessStatusCode();

        var created = (await create.Content.ReadFromJsonAsync<CreatedUser>(Json))!;

        var start = await client.PostAsJsonAsync("/api/v1/auth/view-as", new { targetUserId = created.UserId });
        start.EnsureSuccessStatusCode();

        return created.UserId;
    }

    /// <summary>Ends the session, returning the client to acting as the Site Admin. Idempotent.</summary>
    public static async Task StopActingAsync(HttpClient client)
    {
        var response = await client.DeleteAsync("/api/v1/auth/view-as");
        response.EnsureSuccessStatusCode();
    }

    private sealed record CreatedUser(Guid UserId);
}
