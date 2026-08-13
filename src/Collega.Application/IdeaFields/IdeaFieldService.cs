using System.Text.Json;
using System.Text.RegularExpressions;
using Collega.Application.Abstractions;
using Collega.Application.Exceptions;
using Collega.Domain.Auditing;
using Collega.Domain.Enums;
using Collega.Domain.IdeaFields;

namespace Collega.Application.IdeaFields;

/// <summary>
/// One service for both option collections — they share identical authorization, ordering, uniqueness,
/// and last-active-option rules and differ only in whether a color is carried.
/// </summary>
public sealed partial class IdeaFieldService : IIdeaFieldService
{
    private const int SortOrderStep = 10;

    private readonly IIdeaTypeRepository _ideaTypeRepository;
    private readonly IBusinessImpactRepository _businessImpactRepository;
    private readonly IFieldDefinitionRepository _fieldDefinitionRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditEventWriter _auditEventWriter;
    private readonly ICurrentUserContext _currentUser;
    private readonly IClock _clock;

    public IdeaFieldService(
        IIdeaTypeRepository ideaTypeRepository,
        IBusinessImpactRepository businessImpactRepository,
        IFieldDefinitionRepository fieldDefinitionRepository,
        IOrganizationRepository organizationRepository,
        IUnitOfWork unitOfWork,
        IAuditEventWriter auditEventWriter,
        ICurrentUserContext currentUser,
        IClock clock)
    {
        _ideaTypeRepository = ideaTypeRepository;
        _businessImpactRepository = businessImpactRepository;
        _fieldDefinitionRepository = fieldDefinitionRepository;
        _organizationRepository = organizationRepository;
        _unitOfWork = unitOfWork;
        _auditEventWriter = auditEventWriter;
        _currentUser = currentUser;
        _clock = clock;
    }

    // ---------------- Idea Type ----------------

    public async Task<IReadOnlyList<IdeaTypeItem>> ListIdeaTypesAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        EnsureReadScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);

        var options = await _ideaTypeRepository.ListByOrganizationAsync(organizationId, includeDeleted, cancellationToken);
        return options.Select(ToItem).ToList();
    }

    public async Task<IdeaTypeItem> CreateIdeaTypeAsync(Guid organizationId, CreateIdeaTypeCommand command, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);

        var existing = await _ideaTypeRepository.ListByOrganizationAsync(organizationId, includeDeleted: true, cancellationToken);
        EnsureNameAvailable(command.Name, existing.Where(o => !o.IsDeleted).Select(o => o.Name), null);

        var now = _clock.UtcNow;
        var sortOrder = command.SortOrder ?? NextSortOrder(existing.Select(o => o.SortOrder));
        var option = IdeaType.Create(organizationId, command.Name, sortOrder, now, _currentUser.UserId);

        await _ideaTypeRepository.AddAsync(option, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("IdeaTypeCreated", "IdeaType", organizationId, option.Id, $"Idea Type '{option.Name}' created.", now, cancellationToken);

        return ToItem(option);
    }

    public async Task<IdeaTypeItem> UpdateIdeaTypeAsync(Guid ideaTypeId, UpdateIdeaTypeCommand command, CancellationToken cancellationToken = default)
    {
        var option = await _ideaTypeRepository.GetByIdAsync(ideaTypeId, cancellationToken)
            ?? throw new NotFoundAppException("Idea Type not found.");
        EnsureAdminScope(option.OrganizationId);
        if (option.IsDeleted)
        {
            throw new NotFoundAppException("Idea Type not found.");
        }

        var existing = await _ideaTypeRepository.ListByOrganizationAsync(option.OrganizationId, includeDeleted: false, cancellationToken);
        EnsureNameAvailable(command.Name, existing.Select(o => o.Name), option.Name);

        var now = _clock.UtcNow;
        option.Update(command.Name, command.SortOrder ?? option.SortOrder, now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("IdeaTypeUpdated", "IdeaType", option.OrganizationId, option.Id, $"Idea Type '{option.Name}' updated.", now, cancellationToken);

        return ToItem(option);
    }

    public async Task ReorderIdeaTypesAsync(Guid organizationId, IReadOnlyList<Guid> orderedIds, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);
        var active = await _ideaTypeRepository.ListByOrganizationAsync(organizationId, includeDeleted: false, cancellationToken);
        EnsureReorderCoversActive(orderedIds, active.Select(o => o.Id));

        var now = _clock.UtcNow;
        var byId = active.ToDictionary(o => o.Id);
        for (var i = 0; i < orderedIds.Count; i++)
        {
            byId[orderedIds[i]].SetSortOrder((i + 1) * SortOrderStep, now, _currentUser.UserId);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("IdeaTypesReordered", "IdeaType", organizationId, organizationId, "Idea Type order updated.", now, cancellationToken);
    }

    public async Task DeleteIdeaTypeAsync(Guid ideaTypeId, CancellationToken cancellationToken = default)
    {
        var option = await _ideaTypeRepository.GetByIdAsync(ideaTypeId, cancellationToken)
            ?? throw new NotFoundAppException("Idea Type not found.");
        EnsureAdminScope(option.OrganizationId);
        if (option.IsDeleted)
        {
            return;
        }

        var activeCount = await _ideaTypeRepository.CountActiveByOrganizationAsync(option.OrganizationId, cancellationToken);
        if (activeCount <= IdeaType.MinimumActivePerOrganization)
        {
            throw new ValidationAppException("ideaType", new[] { "An organization must keep at least one active Idea Type; this option cannot be deleted." });
        }

        var now = _clock.UtcNow;
        option.SoftDelete(now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("IdeaTypeDeleted", "IdeaType", option.OrganizationId, option.Id, $"Idea Type '{option.Name}' soft-deleted.", now, cancellationToken);
    }

    public async Task SetIdeaTypeFieldsAsync(Guid organizationId, Guid ideaTypeId, IReadOnlyList<IdeaTypeFieldSelectionInput> fields, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);

        var option = await _ideaTypeRepository.GetByIdAsync(ideaTypeId, cancellationToken);
        if (option is null || option.OrganizationId != organizationId || option.IsDeleted)
        {
            throw new NotFoundAppException("Idea Type not found.");
        }

        var selection = fields ?? Array.Empty<IdeaTypeFieldSelectionInput>();

        // Every selected field must be active and in the same organization; none may repeat.
        var activeFieldIds = (await _fieldDefinitionRepository.ListByOrganizationAsync(organizationId, includeDeleted: false, cancellationToken))
            .Select(d => d.Id)
            .ToHashSet();

        var seen = new HashSet<Guid>();
        foreach (var field in selection)
        {
            if (!seen.Add(field.FieldDefinitionId))
            {
                throw new ValidationAppException("fields", new[] { "A field may appear at most once in the selection." });
            }

            if (!activeFieldIds.Contains(field.FieldDefinitionId))
            {
                throw new ValidationAppException("fields", new[] { $"'{field.FieldDefinitionId}' is not an active custom field in this organization." });
            }
        }

        var now = _clock.UtcNow;
        var links = selection
            .Select(f => new IdeaTypeFieldInput(f.FieldDefinitionId, f.DisplayOrder, f.IsRequired))
            .ToList();
        option.SetFieldSelection(links, now, _currentUser.UserId);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("IdeaTypeFieldsUpdated", "IdeaType", organizationId, option.Id,
            $"Idea Type '{option.Name}' field selection updated ({option.FieldMode}).", now, cancellationToken);
    }

    public async Task SetIdeaTypeAppearanceAsync(Guid organizationId, Guid ideaTypeId, string? colorHex, string? icon, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);

        var option = await _ideaTypeRepository.GetByIdAsync(ideaTypeId, cancellationToken);
        if (option is null || option.OrganizationId != organizationId || option.IsDeleted)
        {
            throw new NotFoundAppException("Idea Type not found.");
        }

        // Validate here so an invalid color surfaces as a 400 rather than the domain's ArgumentException.
        if (!string.IsNullOrWhiteSpace(colorHex) && !HexColorRegex().IsMatch(colorHex.Trim()))
        {
            throw new ValidationAppException("colorHex", new[] { "Color must be a valid #RRGGBB hex color." });
        }

        var now = _clock.UtcNow;
        option.SetAppearance(colorHex, icon, now, _currentUser.UserId);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("IdeaTypeAppearanceUpdated", "IdeaType", organizationId, option.Id,
            $"Idea Type '{option.Name}' appearance updated.", now, cancellationToken);
    }

    // ---------------- Business Impact ----------------

    public async Task<IReadOnlyList<BusinessImpactItem>> ListBusinessImpactsAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        EnsureReadScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);

        var options = await _businessImpactRepository.ListByOrganizationAsync(organizationId, includeDeleted, cancellationToken);
        return options.Select(ToItem).ToList();
    }

    public async Task<BusinessImpactItem> CreateBusinessImpactAsync(Guid organizationId, CreateBusinessImpactCommand command, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);
        EnsureValidColor(command.Color);

        var existing = await _businessImpactRepository.ListByOrganizationAsync(organizationId, includeDeleted: true, cancellationToken);
        EnsureNameAvailable(command.Name, existing.Where(o => !o.IsDeleted).Select(o => o.Name), null);

        var now = _clock.UtcNow;
        var sortOrder = command.SortOrder ?? NextSortOrder(existing.Select(o => o.SortOrder));
        var option = BusinessImpact.Create(organizationId, command.Name, command.Color, sortOrder, now, _currentUser.UserId);

        await _businessImpactRepository.AddAsync(option, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("BusinessImpactCreated", "BusinessImpact", organizationId, option.Id, $"Business Impact '{option.Name}' created.", now, cancellationToken);

        return ToItem(option);
    }

    public async Task<BusinessImpactItem> UpdateBusinessImpactAsync(Guid businessImpactId, UpdateBusinessImpactCommand command, CancellationToken cancellationToken = default)
    {
        var option = await _businessImpactRepository.GetByIdAsync(businessImpactId, cancellationToken)
            ?? throw new NotFoundAppException("Business Impact not found.");
        EnsureAdminScope(option.OrganizationId);
        if (option.IsDeleted)
        {
            throw new NotFoundAppException("Business Impact not found.");
        }

        EnsureValidColor(command.Color);
        var existing = await _businessImpactRepository.ListByOrganizationAsync(option.OrganizationId, includeDeleted: false, cancellationToken);
        EnsureNameAvailable(command.Name, existing.Select(o => o.Name), option.Name);

        var now = _clock.UtcNow;
        option.Update(command.Name, command.Color, command.SortOrder ?? option.SortOrder, now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("BusinessImpactUpdated", "BusinessImpact", option.OrganizationId, option.Id, $"Business Impact '{option.Name}' updated.", now, cancellationToken);

        return ToItem(option);
    }

    public async Task ReorderBusinessImpactsAsync(Guid organizationId, IReadOnlyList<Guid> orderedIds, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);
        var active = await _businessImpactRepository.ListByOrganizationAsync(organizationId, includeDeleted: false, cancellationToken);
        EnsureReorderCoversActive(orderedIds, active.Select(o => o.Id));

        var now = _clock.UtcNow;
        var byId = active.ToDictionary(o => o.Id);
        for (var i = 0; i < orderedIds.Count; i++)
        {
            byId[orderedIds[i]].SetSortOrder((i + 1) * SortOrderStep, now, _currentUser.UserId);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("BusinessImpactsReordered", "BusinessImpact", organizationId, organizationId, "Business Impact order updated.", now, cancellationToken);
    }

    public async Task DeleteBusinessImpactAsync(Guid businessImpactId, CancellationToken cancellationToken = default)
    {
        var option = await _businessImpactRepository.GetByIdAsync(businessImpactId, cancellationToken)
            ?? throw new NotFoundAppException("Business Impact not found.");
        EnsureAdminScope(option.OrganizationId);
        if (option.IsDeleted)
        {
            return;
        }

        var activeCount = await _businessImpactRepository.CountActiveByOrganizationAsync(option.OrganizationId, cancellationToken);
        if (activeCount <= BusinessImpact.MinimumActivePerOrganization)
        {
            throw new ValidationAppException("businessImpact", new[] { "An organization must keep at least one active Business Impact; this option cannot be deleted." });
        }

        var now = _clock.UtcNow;
        option.SoftDelete(now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("BusinessImpactDeleted", "BusinessImpact", option.OrganizationId, option.Id, $"Business Impact '{option.Name}' soft-deleted.", now, cancellationToken);
    }

    // ---------------- Shared helpers ----------------

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColorRegex();

    private static void EnsureValidColor(string? color)
    {
        if (string.IsNullOrWhiteSpace(color) || !HexColorRegex().IsMatch(color.Trim()))
        {
            throw new ValidationAppException("color", new[] { "Color must be a valid #RRGGBB hex color." });
        }
    }

    private static void EnsureNameAvailable(string? name, IEnumerable<string> activeNames, string? currentName)
    {
        var trimmed = (name ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            throw new ValidationAppException("name", new[] { "Name is required." });
        }

        // Active labels are unique case-insensitively within the same organization and option type.
        if (!string.Equals(trimmed, currentName, StringComparison.OrdinalIgnoreCase)
            && activeNames.Any(n => string.Equals(n, trimmed, StringComparison.OrdinalIgnoreCase)))
        {
            throw new ValidationAppException("name", new[] { $"An option named '{trimmed}' already exists in this organization." });
        }
    }

    private static void EnsureReorderCoversActive(IReadOnlyList<Guid> orderedIds, IEnumerable<Guid> activeIds)
    {
        var active = activeIds.ToHashSet();
        if (orderedIds is null || orderedIds.Count != active.Count || orderedIds.Distinct().Count() != orderedIds.Count || !orderedIds.All(active.Contains))
        {
            throw new ValidationAppException("orderedIds", new[] { "The reorder must list every active option exactly once." });
        }
    }

    private static int NextSortOrder(IEnumerable<int> existing)
    {
        var orders = existing.ToList();
        return orders.Count == 0 ? SortOrderStep : orders.Max() + SortOrderStep;
    }

    private async Task EnsureOrganizationExistsAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        _ = await _organizationRepository.GetByIdAsync(organizationId, cancellationToken)
            ?? throw new NotFoundAppException("Organization not found.");
    }

    private void EnsureReadScope(Guid organizationId)
    {
        var role = RequireAuthenticatedRole();
        if (role == Role.SiteAdmin || _currentUser.OrganizationId == organizationId)
        {
            return;
        }

        throw new NotFoundAppException("Organization not found.");
    }

    private void EnsureAdminScope(Guid organizationId)
    {
        var role = RequireAuthenticatedRole();
        if (role == Role.SiteAdmin)
        {
            return;
        }

        if (role == Role.OrgAdmin)
        {
            if (_currentUser.OrganizationId == organizationId)
            {
                return;
            }

            throw new NotFoundAppException("Organization not found.");
        }

        throw new ForbiddenAppException("You are not allowed to manage idea field options in this organization.");
    }

    private Role RequireAuthenticatedRole()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        return _currentUser.Role.Value;
    }

    private static IdeaTypeItem ToItem(IdeaType o) => new(
        o.Id,
        o.OrganizationId,
        o.Name,
        o.SortOrder,
        o.IsDeleted,
        o.ColorHex,
        o.Icon,
        o.FieldMode.ToString(),
        o.Fields
            .OrderBy(f => f.DisplayOrder)
            .Select(f => new IdeaTypeFieldItem(f.FieldDefinitionId, f.DisplayOrder, f.IsRequired))
            .ToList());

    private static BusinessImpactItem ToItem(BusinessImpact o) => new(o.Id, o.OrganizationId, o.Name, o.Color, o.SortOrder, o.IsDeleted);

    private async Task AuditAsync(string eventType, string entityType, Guid organizationId, Guid entityId, string message, DateTime nowUtc, CancellationToken cancellationToken)
    {
        // Rule 14: while acting as someone, the real administrator is the actor and the target
        // moves to OnBehalfOfUserId — an audit row must never read as though the target did it.
        var attribution = _currentUser.AttributeAudit(_currentUser.UserId);
        var auditEvent = AuditEvent.Create(eventType, entityType, message, nowUtc, organizationId, attribution.ActorUserId, entityId, null, attribution.OnBehalfOfUserId);
        await _auditEventWriter.WriteAsync(auditEvent, cancellationToken);
    }
}
