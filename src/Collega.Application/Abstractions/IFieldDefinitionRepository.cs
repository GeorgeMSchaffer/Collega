using Collega.Domain.Fields;

namespace Collega.Application.Abstractions;

/// <summary>
/// Persistence for organization-scoped User-Defined Field definitions
/// (SPEC/20-feature-user-defined-fields.md). Reads that back a mutation are tracked; list/validation
/// reads are untracked. All results include the definition's <see cref="FieldDefinition.Options"/>.
/// </summary>
public interface IFieldDefinitionRepository
{
    Task AddAsync(FieldDefinition definition, CancellationToken cancellationToken = default);

    /// <summary>Tracked single fetch (with options) for update/delete.</summary>
    Task<FieldDefinition?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Untracked list in display order. When <paramref name="includeDeleted"/> is false only active
    /// definitions are returned (the set idea forms and value validation use).
    /// </summary>
    Task<IReadOnlyList<FieldDefinition>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default);

    /// <summary>Tracked active definitions for the organization, for a reorder that persists new display orders.</summary>
    Task<IReadOnlyList<FieldDefinition>> ListActiveTrackedByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>Whether an active definition already uses <paramref name="name"/> (case-insensitive), excluding <paramref name="excludeId"/>.</summary>
    Task<bool> ExistsActiveByNameAsync(Guid organizationId, string name, Guid? excludeId, CancellationToken cancellationToken = default);
}
