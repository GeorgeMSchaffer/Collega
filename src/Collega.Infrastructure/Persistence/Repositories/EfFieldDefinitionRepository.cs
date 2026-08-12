using Collega.Application.Abstractions;
using Collega.Domain.Fields;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

public sealed class EfFieldDefinitionRepository : IFieldDefinitionRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfFieldDefinitionRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task AddAsync(FieldDefinition definition, CancellationToken cancellationToken = default) =>
        await _dbContext.FieldDefinitions.AddAsync(definition, cancellationToken);

    // Tracked (no AsNoTracking) so callers can mutate and persist through the unit of work.
    public Task<FieldDefinition?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _dbContext.FieldDefinitions
            .Include(f => f.Options)
            .FirstOrDefaultAsync(f => f.Id == id, cancellationToken);

    public async Task<IReadOnlyList<FieldDefinition>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.FieldDefinitions
            .AsNoTracking()
            .Include(f => f.Options)
            .Where(f => f.OrganizationId == organizationId);

        if (!includeDeleted)
        {
            query = query.Where(f => !f.IsDeleted);
        }

        return await query
            .OrderBy(f => f.DisplayOrder)
            .ThenBy(f => f.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<FieldDefinition>> ListActiveTrackedByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        await _dbContext.FieldDefinitions
            .Include(f => f.Options)
            .Where(f => f.OrganizationId == organizationId && !f.IsDeleted)
            .OrderBy(f => f.DisplayOrder)
            .ToListAsync(cancellationToken);

    public Task<bool> ExistsActiveByNameAsync(Guid organizationId, string name, Guid? excludeId, CancellationToken cancellationToken = default)
    {
        // Compares the stored normalized column rather than lower-casing the raw name in SQL, so this
        // check and the ux_field_definitions_organization_id_normalized_name constraint agree exactly.
        var normalized = FieldDefinition.Normalize(name);
        return _dbContext.FieldDefinitions.AnyAsync(
            f => f.OrganizationId == organizationId
                && !f.IsDeleted
                && f.NormalizedName == normalized
                && (excludeId == null || f.Id != excludeId),
            cancellationToken);
    }
}
