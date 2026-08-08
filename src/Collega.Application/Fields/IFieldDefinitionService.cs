namespace Collega.Application.Fields;

/// <summary>
/// Organization User-Defined Field definition management (SPEC/20-feature-user-defined-fields.md).
/// Reads (list/get active) are available to any member of the organization because idea forms need
/// the schema to render; create/update/delete/reorder and viewing archived definitions are admin-only.
/// </summary>
public interface IFieldDefinitionService
{
    Task<IReadOnlyList<FieldDefinitionModel>> ListAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default);

    Task<FieldDefinitionModel> GetAsync(Guid organizationId, Guid id, CancellationToken cancellationToken = default);

    Task<FieldDefinitionModel> CreateAsync(Guid organizationId, CreateFieldDefinitionCommand command, CancellationToken cancellationToken = default);

    Task<FieldDefinitionModel> UpdateAsync(Guid organizationId, Guid id, UpdateFieldDefinitionCommand command, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid organizationId, Guid id, CancellationToken cancellationToken = default);

    Task ReorderAsync(Guid organizationId, ReorderFieldDefinitionsCommand command, CancellationToken cancellationToken = default);
}
