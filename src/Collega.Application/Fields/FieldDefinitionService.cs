using System.Text.Json;
using Collega.Application.Abstractions;
using Collega.Application.Exceptions;
using Collega.Domain.Auditing;
using Collega.Domain.Enums;
using Collega.Domain.Fields;

namespace Collega.Application.Fields;

/// <summary>
/// User-Defined Field definition use cases (SPEC/20-feature-user-defined-fields.md). Site Admin may
/// manage any organization; Org Admin only their own. Listing/getting active definitions is available
/// to any authenticated member of the organization because every idea form needs the field schema;
/// create/update/delete/reorder and <c>includeDeleted</c> are admin-only.
/// </summary>
public sealed class FieldDefinitionService : IFieldDefinitionService
{
    private const int DisplayOrderStep = 10;

    private readonly IFieldDefinitionRepository _repository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditEventWriter _auditEventWriter;
    private readonly ICurrentUserContext _currentUser;
    private readonly IClock _clock;

    public FieldDefinitionService(
        IFieldDefinitionRepository repository,
        IOrganizationRepository organizationRepository,
        IUnitOfWork unitOfWork,
        IAuditEventWriter auditEventWriter,
        ICurrentUserContext currentUser,
        IClock clock)
    {
        _repository = repository;
        _organizationRepository = organizationRepository;
        _unitOfWork = unitOfWork;
        _auditEventWriter = auditEventWriter;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<IReadOnlyList<FieldDefinitionModel>> ListAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        EnsureReadScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);

        // Archived definitions are visible to admins only; members always see the active schema only.
        var effectiveIncludeDeleted = includeDeleted && IsAdminScope(organizationId);

        var definitions = await _repository.ListByOrganizationAsync(organizationId, effectiveIncludeDeleted, cancellationToken);
        return definitions.Select(ToModel).ToList();
    }

    public async Task<FieldDefinitionModel> GetAsync(Guid organizationId, Guid id, CancellationToken cancellationToken = default)
    {
        EnsureReadScope(organizationId);

        var definition = await _repository.GetByIdAsync(id, cancellationToken);
        if (definition is null || definition.OrganizationId != organizationId)
        {
            throw new NotFoundAppException("Field definition not found.");
        }

        // Members cannot see archived definitions; admins can.
        if (definition.IsDeleted && !IsAdminScope(organizationId))
        {
            throw new NotFoundAppException("Field definition not found.");
        }

        return ToModel(definition);
    }

    public async Task<FieldDefinitionModel> CreateAsync(Guid organizationId, CreateFieldDefinitionCommand command, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);

        var fieldType = ParseFieldType(command.FieldType);
        await EnsureNameAvailableAsync(organizationId, command.Name, excludeId: null, cancellationToken);

        var now = _clock.UtcNow;
        var displayOrder = command.DisplayOrder ?? await NextDisplayOrderAsync(organizationId, cancellationToken);
        var options = ToOptionInputs(command.Options);

        var definition = AsValidation(() => FieldDefinition.Create(
            organizationId, command.Name, command.Description, fieldType, command.IsRequired, displayOrder, options, now, _currentUser.UserId));

        await _repository.AddAsync(definition, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("FieldDefinitionCreated", organizationId, definition.Id,
            $"Field '{definition.Name}' created.", now,
            new { definition.Name, FieldType = definition.FieldType.ToString(), definition.IsRequired }, cancellationToken);

        return ToModel(definition);
    }

    public async Task<FieldDefinitionModel> UpdateAsync(Guid organizationId, Guid id, UpdateFieldDefinitionCommand command, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);

        var definition = await _repository.GetByIdAsync(id, cancellationToken);
        if (definition is null || definition.OrganizationId != organizationId || definition.IsDeleted)
        {
            throw new NotFoundAppException("Field definition not found.");
        }

        var fieldType = ParseFieldType(command.FieldType);
        if (fieldType != definition.FieldType)
        {
            throw new ValidationAppException("fieldType", new[] { "Field type cannot be changed after creation." });
        }

        await EnsureNameAvailableAsync(organizationId, command.Name, excludeId: id, cancellationToken);

        var now = _clock.UtcNow;
        var displayOrder = command.DisplayOrder ?? definition.DisplayOrder;

        AsValidation(() =>
        {
            definition.Update(command.Name, command.Description, command.IsRequired, displayOrder, now, _currentUser.UserId);
            if (definition.IsOptionBacked)
            {
                definition.SetOptions(ToOptionInputs(command.Options), now, _currentUser.UserId);
            }
        });

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("FieldDefinitionUpdated", organizationId, definition.Id,
            $"Field '{definition.Name}' updated.", now,
            new { definition.Name, definition.IsRequired, definition.DisplayOrder }, cancellationToken);

        return ToModel(definition);
    }

    public async Task DeleteAsync(Guid organizationId, Guid id, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);

        var definition = await _repository.GetByIdAsync(id, cancellationToken);
        if (definition is null || definition.OrganizationId != organizationId)
        {
            throw new NotFoundAppException("Field definition not found.");
        }

        if (definition.IsDeleted)
        {
            // Soft delete is idempotent.
            return;
        }

        var now = _clock.UtcNow;
        definition.SoftDelete(now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("FieldDefinitionDeleted", organizationId, definition.Id,
            $"Field '{definition.Name}' archived.", now, null, cancellationToken);
    }

    public async Task ReorderAsync(Guid organizationId, ReorderFieldDefinitionsCommand command, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);

        var definitions = await _repository.ListActiveTrackedByOrganizationAsync(organizationId, cancellationToken);
        var byId = definitions.ToDictionary(d => d.Id);

        var now = _clock.UtcNow;
        var order = 0;
        foreach (var definitionId in command.OrderedIds ?? Array.Empty<Guid>())
        {
            if (!byId.TryGetValue(definitionId, out var definition))
            {
                // Unknown or already-archived ids are ignored (the active set is authoritative).
                continue;
            }

            order += DisplayOrderStep;
            definition.SetDisplayOrder(order, now, _currentUser.UserId);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("FieldDefinitionsReordered", organizationId, null, "Field display order updated.", now, null, cancellationToken);
    }

    private async Task<int> NextDisplayOrderAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var existing = await _repository.ListByOrganizationAsync(organizationId, includeDeleted: true, cancellationToken);
        return existing.Count == 0 ? DisplayOrderStep : existing.Max(d => d.DisplayOrder) + DisplayOrderStep;
    }

    private async Task EnsureNameAvailableAsync(Guid organizationId, string name, Guid? excludeId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            // Let the domain produce the canonical "Name is required." message.
            return;
        }

        if (await _repository.ExistsActiveByNameAsync(organizationId, name, excludeId, cancellationToken))
        {
            throw new ValidationAppException("name", new[] { $"A field named '{name.Trim()}' already exists in this organization." });
        }
    }

    private async Task EnsureOrganizationExistsAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        _ = await _organizationRepository.GetByIdAsync(organizationId, cancellationToken)
            ?? throw new NotFoundAppException("Organization not found.");
    }

    private static FieldType ParseFieldType(string fieldType)
    {
        if (!string.IsNullOrWhiteSpace(fieldType)
            && Enum.TryParse<FieldType>(fieldType.Trim(), ignoreCase: true, out var parsed)
            && Enum.IsDefined(parsed))
        {
            return parsed;
        }

        var supported = string.Join(", ", Enum.GetNames<FieldType>());
        throw new ValidationAppException("fieldType", new[] { $"Field type must be one of: {supported}." });
    }

    private static IReadOnlyList<FieldOptionInput> ToOptionInputs(IReadOnlyList<FieldOptionCommand>? options) =>
        (options ?? Array.Empty<FieldOptionCommand>())
            .Select((o, index) => new FieldOptionInput(o.OptionId, o.Label, o.DisplayOrder == 0 ? index : o.DisplayOrder))
            .ToList();

    /// <summary>Site Admin (any org) or a member of the target organization (any role) may read the schema.</summary>
    private void EnsureReadScope(Guid organizationId)
    {
        var role = RequireAuthenticatedRole();
        if (role == Role.SiteAdmin || _currentUser.OrganizationId == organizationId)
        {
            return;
        }

        throw new NotFoundAppException("Organization not found.");
    }

    /// <summary>Site Admin (any org) or Org Admin (own org) may manage field definitions.</summary>
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

        throw new ForbiddenAppException("You are not allowed to manage field definitions in this organization.");
    }

    private bool IsAdminScope(Guid organizationId)
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            return false;
        }

        return _currentUser.Role == Role.SiteAdmin
            || (_currentUser.Role == Role.OrgAdmin && _currentUser.OrganizationId == organizationId);
    }

    private Role RequireAuthenticatedRole()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        return _currentUser.Role.Value;
    }

    private static FieldDefinitionModel ToModel(FieldDefinition d) => new(
        d.Id,
        d.OrganizationId,
        d.Name,
        d.Description,
        d.FieldType.ToString(),
        d.IsRequired,
        d.DisplayOrder,
        d.IsDeleted,
        d.Options
            .OrderBy(o => o.DisplayOrder)
            .Select(o => new FieldOptionModel(o.Id, o.Label, o.DisplayOrder))
            .ToList());

    private static T AsValidation<T>(Func<T> action)
    {
        try
        {
            return action();
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            throw new ValidationAppException("fieldDefinition", new[] { ex.Message });
        }
    }

    private static void AsValidation(Action action) =>
        AsValidation<object?>(() =>
        {
            action();
            return null;
        });

    private async Task AuditAsync(
        string eventType,
        Guid organizationId,
        Guid? entityId,
        string message,
        DateTime nowUtc,
        object? metadata,
        CancellationToken cancellationToken)
    {
        var metadataJson = metadata is null ? null : JsonSerializer.Serialize(metadata);
        var auditEvent = AuditEvent.Create(eventType, "FieldDefinition", message, nowUtc, organizationId, _currentUser.UserId, entityId, metadataJson);
        await _auditEventWriter.WriteAsync(auditEvent, cancellationToken);
    }
}
