using Collega.API.Contracts.FieldDefinitions;
using Collega.Application.Fields;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Organization User-Defined Field definitions (SPEC/20-feature-user-defined-fields.md "API Endpoints").
/// All routes hang off `/organizations/{organizationId}/field-definitions`. The controller stays thin —
/// authorization (member read vs. admin manage), field-type/option validation, name uniqueness, and
/// audit live in <see cref="IFieldDefinitionService"/>.
/// </summary>
[ApiController]
[Authorize]
public sealed class FieldDefinitionsController : ControllerBase
{
    private readonly IFieldDefinitionService _service;

    public FieldDefinitionsController(IFieldDefinitionService service)
    {
        _service = service;
    }

    [HttpGet("organizations/{organizationId:guid}/field-definitions")]
    public async Task<IActionResult> List(Guid organizationId, [FromQuery] bool includeDeleted, CancellationToken cancellationToken)
    {
        var result = await _service.ListAsync(organizationId, includeDeleted, cancellationToken);
        return Ok(result);
    }

    [HttpGet("organizations/{organizationId:guid}/field-definitions/{id:guid}")]
    public async Task<IActionResult> Get(Guid organizationId, Guid id, CancellationToken cancellationToken)
    {
        var result = await _service.GetAsync(organizationId, id, cancellationToken);
        return Ok(result);
    }

    [HttpPost("organizations/{organizationId:guid}/field-definitions")]
    public async Task<IActionResult> Create(Guid organizationId, [FromBody] CreateFieldDefinitionRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateFieldDefinitionCommand(
            request.Name,
            request.Description,
            request.FieldType,
            request.IsRequired,
            request.DisplayOrder,
            request.Options.Select(ToOptionCommand).ToList());

        var result = await _service.CreateAsync(organizationId, command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPut("organizations/{organizationId:guid}/field-definitions/reorder")]
    public async Task<IActionResult> Reorder(Guid organizationId, [FromBody] ReorderFieldDefinitionsRequest request, CancellationToken cancellationToken)
    {
        await _service.ReorderAsync(organizationId, new ReorderFieldDefinitionsCommand(request.OrderedIds), cancellationToken);
        return NoContent();
    }

    [HttpPut("organizations/{organizationId:guid}/field-definitions/{id:guid}")]
    public async Task<IActionResult> Update(Guid organizationId, Guid id, [FromBody] UpdateFieldDefinitionRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateFieldDefinitionCommand(
            request.Name,
            request.Description,
            request.FieldType,
            request.IsRequired,
            request.DisplayOrder,
            request.Options.Select(ToOptionCommand).ToList());

        var result = await _service.UpdateAsync(organizationId, id, command, cancellationToken);
        return Ok(result);
    }

    [HttpDelete("organizations/{organizationId:guid}/field-definitions/{id:guid}")]
    public async Task<IActionResult> Delete(Guid organizationId, Guid id, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(organizationId, id, cancellationToken);
        return NoContent();
    }

    private static FieldOptionCommand ToOptionCommand(FieldOptionRequest option) =>
        new(option.OptionId, option.Label, option.DisplayOrder);
}
