using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;

namespace Collega.API.Tests;

/// <summary>
/// Integration coverage for <c>POST /api/v1/organizations/{id}/users/import</c> (T047-T049
/// hardening) through the real multipart pipeline: the happy-path bulk create, per-row rejection
/// of a duplicate email appearing twice in one file, per-row rejection of a Site-Admin role, the
/// missing/empty/malformed-file 400s, and the documented result shape (createdCount / rejectedCount
/// / rows with rowNumber, email, outcome, error, temporaryPassword).
///
/// Note: the endpoint enforces no explicit maximum row count or byte-size cap in code beyond the
/// framework's default request-body limits, so a large valid CSV imports every row — see
/// <see cref="Import_Processes_Every_Row_Of_A_Large_Valid_File"/>.
/// </summary>
public sealed class UserCsvImportTests : IClassFixture<CollegaApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private const string SiteAdminEmail = "siteadmin@collega.test";

    private readonly CollegaApiFactory _factory;

    public UserCsvImportTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Import_Creates_Users_From_A_Valid_Csv()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var csv =
            "firstName,lastName,email,role\n" +
            $"Ada,Lovelace,ada-{Guid.NewGuid():N}@import.test,OrgAdmin\n" +
            $"Grace,Hopper,grace-{Guid.NewGuid():N}@import.test,User\n";

        using var response = await ImportAsync(admin, org.OrganizationId, csv);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<UserImportResponse>(Json);
        Assert.NotNull(result);
        Assert.Equal(2, result!.CreatedCount);
        Assert.Equal(0, result.RejectedCount);
        Assert.Equal(2, result.Rows.Count);
        Assert.All(result.Rows, row =>
        {
            Assert.Equal("created", row.Outcome);
            Assert.Null(row.Error);
            Assert.False(string.IsNullOrWhiteSpace(row.TemporaryPassword));
        });

        // The imported users exist in the organization.
        var users = await admin.GetFromJsonAsync<PagedResponse<UserListItem>>(
            $"/api/v1/organizations/{org.OrganizationId}/users?pageSize=100", Json);
        Assert.Contains(users!.Items, u => u.Role == "OrgAdmin" && u.Email.StartsWith("ada-", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Import_Rejects_Duplicate_Email_Within_The_Same_File()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var duplicateEmail = $"dupe-{Guid.NewGuid():N}@import.test";
        var csv =
            "firstName,lastName,email\n" +
            $"First,Copy,{duplicateEmail}\n" +
            $"Second,Copy,{duplicateEmail}\n";

        using var response = await ImportAsync(admin, org.OrganizationId, csv);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<UserImportResponse>(Json);
        Assert.Equal(1, result!.CreatedCount);
        Assert.Equal(1, result.RejectedCount);

        var rejected = Assert.Single(result.Rows, r => r.Outcome == "rejected");
        Assert.Equal(2, rejected.RowNumber);
        Assert.False(string.IsNullOrWhiteSpace(rejected.Error));
        Assert.Null(rejected.TemporaryPassword);
    }

    [Fact]
    public async Task Import_Rejects_A_Row_Requesting_The_SiteAdmin_Role()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        // Site Admin is a global platform account that cannot be assigned to an organization user.
        var csv =
            "firstName,lastName,email,role\n" +
            $"Sneaky,Admin,sneaky-{Guid.NewGuid():N}@import.test,SiteAdmin\n";

        using var response = await ImportAsync(admin, org.OrganizationId, csv);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<UserImportResponse>(Json);
        Assert.Equal(0, result!.CreatedCount);
        Assert.Equal(1, result.RejectedCount);
        var rejected = Assert.Single(result.Rows);
        Assert.Equal("rejected", rejected.Outcome);
        Assert.False(string.IsNullOrWhiteSpace(rejected.Error));
    }

    [Fact]
    public async Task Import_Rejects_Incomplete_Rows_Individually()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var csv =
            "firstName,lastName,email\n" +
            $"Valid,User,valid-{Guid.NewGuid():N}@import.test\n" +
            "Missing,Email\n";

        using var response = await ImportAsync(admin, org.OrganizationId, csv);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<UserImportResponse>(Json);
        Assert.Equal(1, result!.CreatedCount);
        Assert.Equal(1, result.RejectedCount);
        Assert.Contains(result.Rows, r => r.Outcome == "rejected" && r.RowNumber == 2);
    }

    [Fact]
    public async Task Import_Processes_Every_Row_Of_A_Large_Valid_File()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        const int rowCount = 60;
        var batch = Guid.NewGuid().ToString("N");
        var builder = new StringBuilder("firstName,lastName,email,role\n");
        for (var i = 0; i < rowCount; i++)
        {
            builder.Append($"Bulk{i},User,bulk-{batch}-{i}@import.test,User\n");
        }

        using var response = await ImportAsync(admin, org.OrganizationId, builder.ToString());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<UserImportResponse>(Json);
        Assert.Equal(rowCount, result!.CreatedCount);
        Assert.Equal(0, result.RejectedCount);
        Assert.Equal(rowCount, result.Rows.Count);
    }

    [Fact]
    public async Task Import_Without_A_File_Returns_400()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        // Multipart body with an unrelated field but no "csvFile" part.
        using var content = new MultipartFormDataContent { { new StringContent("noop"), "somethingElse" } };
        using var response = await admin.PostAsync($"/api/v1/organizations/{org.OrganizationId}/users/import", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Import_With_Empty_File_Returns_400()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        using var response = await ImportAsync(admin, org.OrganizationId, string.Empty);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Import_With_Missing_Required_Columns_Returns_400()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var csv =
            "name,email\n" +
            "Nobody,nobody@import.test\n";

        using var response = await ImportAsync(admin, org.OrganizationId, csv);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Import_Requires_Authentication()
    {
        using var anonymous = _factory.CreateClient();
        var csv = "firstName,lastName,email\nJane,Doe,jane@import.test\n";

        using var response = await ImportAsync(anonymous, Guid.NewGuid(), csv);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Helpers -----------------------------------------------------------------------------------

    private static async Task<HttpResponseMessage> ImportAsync(HttpClient client, Guid organizationId, string csvContent, string fileName = "users.csv")
    {
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(csvContent));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/csv");

        var form = new MultipartFormDataContent { { fileContent, "csvFile", fileName } };
        return await client.PostAsync($"/api/v1/organizations/{organizationId}/users/import", form);
    }

    private async Task<CreateOrgResponse> CreateOrganizationAsync(HttpClient admin)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/organizations", new
        {
            title = $"Org {Guid.NewGuid():N}",
            description = "CSV import test organization."
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CreateOrgResponse>(Json))!;
    }

    // Rotates the seeded Site Admin's mandatory first-login password before use; shared so the
    // nine test classes that need a Site Admin session don't each carry a copy.
    private static Task AuthenticateAsSiteAdminAsync(HttpClient client) =>
        SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

    private sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, bool RequiresPasswordChange);
    private sealed record CreateOrgResponse(Guid OrganizationId, string InviteCode, Guid DefaultBoardId, int DefaultStatusCount);
    private sealed record UserImportResponse(int CreatedCount, int RejectedCount, IReadOnlyList<UserImportRowOutcome> Rows);
    private sealed record UserImportRowOutcome(int RowNumber, string? Email, string Outcome, string? Error, string? TemporaryPassword);
    private sealed record UserListItem(Guid UserId, Guid? OrganizationId, string FirstName, string LastName, string Email, string Role, string Status);
    private sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);
}
