using System.Text.Json;
using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Application.Exceptions;
using Collega.Domain.Auditing;
using Collega.Domain.Enums;
using Collega.Domain.Organizations;

namespace Collega.Application.Organizations;

/// <summary>
/// Organization administration use cases (SPEC/20-feature-organizations-and-users.md,
/// SPEC/30-Contracts.md "Organization Contracts"). Authorization and organization scoping are
/// enforced here, never in the controller.
/// </summary>
public sealed class OrganizationService : IOrganizationService
{
    private const int InviteCodeGenerationAttempts = 10;

    private readonly IOrganizationRepository _organizationRepository;
    private readonly IOrganizationBootstrapService _bootstrapService;
    private readonly IInviteCodeGenerator _inviteCodeGenerator;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditEventWriter _auditEventWriter;
    private readonly ICurrentUserContext _currentUser;
    private readonly IClock _clock;

    public OrganizationService(
        IOrganizationRepository organizationRepository,
        IOrganizationBootstrapService bootstrapService,
        IInviteCodeGenerator inviteCodeGenerator,
        IUnitOfWork unitOfWork,
        IAuditEventWriter auditEventWriter,
        ICurrentUserContext currentUser,
        IClock clock)
    {
        _organizationRepository = organizationRepository;
        _bootstrapService = bootstrapService;
        _inviteCodeGenerator = inviteCodeGenerator;
        _unitOfWork = unitOfWork;
        _auditEventWriter = auditEventWriter;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<PagedResult<OrganizationListItem>> ListAsync(OrganizationListQuery query, CancellationToken cancellationToken = default)
    {
        RequireSiteAdmin();

        var filter = new OrganizationListFilter(
            new PageRequest(query.Page, query.PageSize),
            query.Search?.Trim(),
            query.IncludeArchived,
            query.SortBy,
            query.SortDirection);

        var page = await _organizationRepository.ListAsync(filter, cancellationToken);
        var items = page.Items.Select(ToListItem).ToList();
        return new PagedResult<OrganizationListItem>(items, page.Page, page.PageSize, page.TotalCount, page.SortBy, page.SortDirection);
    }

    public async Task<CreateOrganizationResult> CreateAsync(CreateOrganizationCommand command, CancellationToken cancellationToken = default)
    {
        RequireSiteAdmin();

        var now = _clock.UtcNow;
        var actorUserId = _currentUser.UserId;
        var inviteCode = await GenerateUniqueInviteCodeAsync(cancellationToken);

        var organization = Organization.Create(
            command.Title,
            command.Description,
            inviteCode,
            now,
            actorUserId,
            command.LogoUrl,
            ToDomainProfile(command.Profile));

        await _organizationRepository.AddAsync(organization, cancellationToken);

        // Rule #10: a newly created organization starts with the default statuses and one default
        // board. Provisioned within the same unit of work so an org is never left half-created.
        var bootstrap = await _bootstrapService.ProvisionDefaultsAsync(organization.Id, now, actorUserId, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync(
            "OrganizationCreated",
            organization.Id,
            actorUserId,
            $"Organization '{organization.Title}' created.",
            now,
            new { organization.Title, bootstrap.DefaultStatusCount, bootstrap.DefaultBoardId },
            cancellationToken);

        return new CreateOrganizationResult(organization.Id, organization.InviteCode, bootstrap.DefaultBoardId, bootstrap.DefaultStatusCount);
    }

    public async Task<OrganizationDetail> GetByIdAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        var organization = await LoadForAdministrationAsync(organizationId, cancellationToken);
        return ToDetail(organization);
    }

    public async Task<OrganizationDetail> UpdateAsync(Guid organizationId, UpdateOrganizationCommand command, CancellationToken cancellationToken = default)
    {
        var organization = await LoadForAdministrationAsync(organizationId, cancellationToken);
        var now = _clock.UtcNow;

        organization.Update(command.Title, command.Description, command.LogoUrl, ToDomainProfile(command.Profile), now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("OrganizationUpdated", organization.Id, _currentUser.UserId, $"Organization '{organization.Title}' updated.", now, null, cancellationToken);

        return ToDetail(organization);
    }

    public async Task<RegenerateInviteCodeResult> RegenerateInviteCodeAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        var organization = await LoadForAdministrationAsync(organizationId, cancellationToken);
        var now = _clock.UtcNow;

        var newCode = await GenerateUniqueInviteCodeAsync(cancellationToken);
        organization.RegenerateInviteCode(newCode, now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("OrganizationInviteCodeRegenerated", organization.Id, _currentUser.UserId, "Organization invite code regenerated.", now, null, cancellationToken);

        return new RegenerateInviteCodeResult(organization.InviteCode);
    }

    public async Task ArchiveAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        // Only Site Admin can archive an organization (org-and-users requirement #8).
        RequireSiteAdmin();

        var organization = await _organizationRepository.GetByIdAsync(organizationId, cancellationToken)
            ?? throw new NotFoundAppException("Organization not found.");

        var now = _clock.UtcNow;
        organization.Archive(now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("OrganizationArchived", organization.Id, _currentUser.UserId, $"Organization '{organization.Title}' archived.", now, null, cancellationToken);
    }

    /// <summary>
    /// Loads an organization the caller is allowed to administer. Site Admin may administer any;
    /// Org Admin only their own (a different org is reported as 404 to avoid leaking existence);
    /// User and Read Only are forbidden.
    /// </summary>
    private async Task<Organization> LoadForAdministrationAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var role = RequireAuthenticatedRole();

        if (role != Role.SiteAdmin && role != Role.OrgAdmin)
        {
            throw new ForbiddenAppException("You are not allowed to administer organizations.");
        }

        if (role == Role.OrgAdmin && _currentUser.OrganizationId != organizationId)
        {
            throw new NotFoundAppException("Organization not found.");
        }

        return await _organizationRepository.GetByIdAsync(organizationId, cancellationToken)
            ?? throw new NotFoundAppException("Organization not found.");
    }

    private async Task<string> GenerateUniqueInviteCodeAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < InviteCodeGenerationAttempts; attempt++)
        {
            var candidate = _inviteCodeGenerator.Generate();
            if (!await _organizationRepository.InviteCodeExistsAsync(candidate, cancellationToken))
            {
                return candidate;
            }
        }

        throw new InvalidOperationException("Unable to generate a unique organization invite code.");
    }

    private Role RequireAuthenticatedRole()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        return _currentUser.Role.Value;
    }

    private void RequireSiteAdmin()
    {
        if (RequireAuthenticatedRole() != Role.SiteAdmin)
        {
            throw new ForbiddenAppException("Only a Site Admin can perform this action.");
        }
    }

    private static OrganizationProfile ToDomainProfile(OrganizationProfileFields profile) => new(
        profile.Address,
        profile.City,
        profile.State,
        profile.Zip,
        profile.Phone,
        profile.PrimaryContactFirstName,
        profile.PrimaryContactLastName);

    private static OrganizationListItem ToListItem(Organization o) => new(
        o.Id,
        o.Title,
        o.Description,
        o.InviteCode,
        o.City,
        o.State,
        o.Phone,
        o.LogoThumbnailUrl,
        o.IsArchived);

    private static OrganizationDetail ToDetail(Organization o) => new(
        o.Id,
        o.Title,
        o.Description,
        o.InviteCode,
        o.LogoUrl,
        o.LogoThumbnailUrl,
        o.LogoHeightPx,
        o.Address,
        o.City,
        o.State,
        o.Zip,
        o.Phone,
        o.PrimaryContactFirstName,
        o.PrimaryContactLastName,
        o.IsArchived,
        o.CreatedAtUtc,
        o.UpdatedAtUtc);

    private async Task AuditAsync(
        string eventType,
        Guid organizationId,
        Guid? actorUserId,
        string message,
        DateTime nowUtc,
        object? metadata,
        CancellationToken cancellationToken)
    {
        var metadataJson = metadata is null ? null : JsonSerializer.Serialize(metadata);
        var auditEvent = AuditEvent.Create(eventType, "Organization", message, nowUtc, organizationId, actorUserId, organizationId, metadataJson);
        await _auditEventWriter.WriteAsync(auditEvent, cancellationToken);
    }
}
