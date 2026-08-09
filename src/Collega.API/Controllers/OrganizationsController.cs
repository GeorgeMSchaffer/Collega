using Collega.API.Contracts.Organizations;
using Collega.API.Contracts.Users;
using Collega.API.Parsing;
using Collega.Application.Common;
using Collega.Application.Exceptions;
using Collega.Application.Organizations;
using Collega.Application.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Organization administration and org-scoped user membership
/// (SPEC/30-Contracts.md "Organization Contracts" and the org-scoped "User Contracts").
/// Controllers stay thin — authorization, scoping, and provisioning live in the Application services.
/// </summary>
[ApiController]
[Authorize]
[Route("organizations")]
public sealed class OrganizationsController : ControllerBase
{
    private readonly IOrganizationService _organizationService;
    private readonly IUserService _userService;

    public OrganizationsController(IOrganizationService organizationService, IUserService userService)
    {
        _organizationService = organizationService;
        _userService = userService;
    }

    /// <summary>List organizations for Site Admin with pagination. Archived orgs are excluded unless <paramref name="isArchived"/> is set.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<OrganizationListItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> List(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? search,
        [FromQuery] bool isArchived,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortDirection,
        CancellationToken cancellationToken)
    {
        var result = await _organizationService.ListAsync(
            new OrganizationListQuery(page, pageSize, search, isArchived, sortBy, sortDirection),
            cancellationToken);
        return Ok(result);
    }

    /// <summary>Create an organization, generate its invite code, and provision default statuses plus one default board.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(CreateOrganizationResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreateOrganizationRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateOrganizationCommand(
            request.Title,
            request.Description,
            request.LogoUrl,
            ToProfile(request.Address, request.City, request.State, request.Zip, request.Phone, request.PrimaryContactFirstName, request.PrimaryContactLastName));

        var result = await _organizationService.CreateAsync(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Return organization detail. AI-key metadata is omitted for User and Read Only callers.</summary>
    [HttpGet("{organizationId:guid}")]
    [ProducesResponseType(typeof(OrganizationDetail), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid organizationId, CancellationToken cancellationToken)
    {
        var result = await _organizationService.GetByIdAsync(organizationId, cancellationToken);
        return Ok(result);
    }

    /// <summary>Update organization detail.</summary>
    [HttpPut("{organizationId:guid}")]
    [ProducesResponseType(typeof(OrganizationDetail), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid organizationId, [FromBody] UpdateOrganizationRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateOrganizationCommand(
            request.Title,
            request.Description,
            request.LogoUrl,
            ToProfile(request.Address, request.City, request.State, request.Zip, request.Phone, request.PrimaryContactFirstName, request.PrimaryContactLastName));

        var result = await _organizationService.UpdateAsync(organizationId, command, cancellationToken);
        return Ok(result);
    }

    /// <summary>Regenerate the organization invite code, invalidating the previous code.</summary>
    [HttpPost("{organizationId:guid}/invite-code/regenerate")]
    [ProducesResponseType(typeof(RegenerateInviteCodeResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RegenerateInviteCode(Guid organizationId, CancellationToken cancellationToken)
    {
        var result = await _organizationService.RegenerateInviteCodeAsync(organizationId, cancellationToken);
        return Ok(result);
    }

    /// <summary>Archive an organization without hard deletion.</summary>
    [HttpPost("{organizationId:guid}/archive")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Archive(Guid organizationId, CancellationToken cancellationToken)
    {
        await _organizationService.ArchiveAsync(organizationId, cancellationToken);
        return NoContent();
    }

    /// <summary>List users within an organization with pagination.</summary>
    [HttpGet("{organizationId:guid}/users")]
    [ProducesResponseType(typeof(PagedResult<UserListItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListUsers(
        Guid organizationId,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] string? status,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortDirection,
        CancellationToken cancellationToken)
    {
        var result = await _userService.ListByOrganizationAsync(
            organizationId,
            new UserListQuery(page, pageSize, search, role, status, sortBy, sortDirection),
            cancellationToken);
        return Ok(result);
    }

    /// <summary>Create a user within an organization.</summary>
    [HttpPost("{organizationId:guid}/users")]
    [ProducesResponseType(typeof(CreateUserResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateUser(Guid organizationId, [FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateUserCommand(request.FirstName, request.LastName, request.Email, request.Role, request.InitialPassword, request.Status);
        var result = await _userService.CreateAsync(organizationId, command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Bulk-create users from an uploaded CSV file. Invalid or duplicate rows are rejected individually.</summary>
    [HttpPost("{organizationId:guid}/users/import")]
    [ProducesResponseType(typeof(UserImportResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ImportUsers(Guid organizationId, IFormFile? csvFile, CancellationToken cancellationToken)
    {
        if (csvFile is null || csvFile.Length == 0)
        {
            throw new ValidationAppException("csvFile", new[] { "A CSV file is required." });
        }

        string content;
        using (var reader = new StreamReader(csvFile.OpenReadStream()))
        {
            content = await reader.ReadToEndAsync(cancellationToken);
        }

        var rows = CsvUserImportParser.Parse(content);
        var result = await _userService.ImportAsync(organizationId, rows, cancellationToken);
        return Ok(result);
    }

    private static OrganizationProfileFields ToProfile(
        string? address,
        string? city,
        string? state,
        string? zip,
        string? phone,
        string? primaryContactFirstName,
        string? primaryContactLastName) =>
        new(address, city, state, zip, phone, primaryContactFirstName, primaryContactLastName);
}
