using Collega.API.Contracts.Organizations;
using Collega.API.Contracts.Users;
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

    [HttpGet]
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

    [HttpPost]
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

    [HttpGet("{organizationId:guid}")]
    public async Task<IActionResult> GetById(Guid organizationId, CancellationToken cancellationToken)
    {
        var result = await _organizationService.GetByIdAsync(organizationId, cancellationToken);
        return Ok(result);
    }

    [HttpPut("{organizationId:guid}")]
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

    [HttpPost("{organizationId:guid}/invite-code/regenerate")]
    public async Task<IActionResult> RegenerateInviteCode(Guid organizationId, CancellationToken cancellationToken)
    {
        var result = await _organizationService.RegenerateInviteCodeAsync(organizationId, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{organizationId:guid}/archive")]
    public async Task<IActionResult> Archive(Guid organizationId, CancellationToken cancellationToken)
    {
        await _organizationService.ArchiveAsync(organizationId, cancellationToken);
        return NoContent();
    }

    [HttpGet("{organizationId:guid}/users")]
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

    [HttpPost("{organizationId:guid}/users")]
    public async Task<IActionResult> CreateUser(Guid organizationId, [FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateUserCommand(request.FirstName, request.LastName, request.Email, request.Role, request.InitialPassword, request.Status);
        var result = await _userService.CreateAsync(organizationId, command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
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
