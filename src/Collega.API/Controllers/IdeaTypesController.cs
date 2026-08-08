using Collega.API.Contracts.IdeaFields;
using Collega.Application.IdeaFields;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Idea Type option administration (SPEC/30-Contracts.md "Idea Field Option Contracts"). Org-scoped
/// list/create/reorder hang off `/organizations/{organizationId}/idea-types`; update/delete are keyed
/// by option id under `/idea-types/{id}`. Authorization and invariants live in
/// <see cref="IIdeaFieldService"/>.
/// </summary>
[ApiController]
[Authorize]
public sealed class IdeaTypesController : ControllerBase
{
    private readonly IIdeaFieldService _service;

    public IdeaTypesController(IIdeaFieldService service)
    {
        _service = service;
    }

    [HttpGet("organizations/{organizationId:guid}/idea-types")]
    public async Task<IActionResult> List(Guid organizationId, [FromQuery] bool includeDeleted, CancellationToken cancellationToken)
    {
        var result = await _service.ListIdeaTypesAsync(organizationId, includeDeleted, cancellationToken);
        return Ok(result);
    }

    [HttpPost("organizations/{organizationId:guid}/idea-types")]
    public async Task<IActionResult> Create(Guid organizationId, [FromBody] CreateIdeaTypeRequest request, CancellationToken cancellationToken)
    {
        var result = await _service.CreateIdeaTypeAsync(organizationId, new CreateIdeaTypeCommand(request.Name, request.SortOrder), cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPut("idea-types/{ideaTypeId:guid}")]
    public async Task<IActionResult> Update(Guid ideaTypeId, [FromBody] UpdateIdeaTypeRequest request, CancellationToken cancellationToken)
    {
        var result = await _service.UpdateIdeaTypeAsync(ideaTypeId, new UpdateIdeaTypeCommand(request.Name, request.SortOrder), cancellationToken);
        return Ok(result);
    }

    [HttpPost("organizations/{organizationId:guid}/idea-types/reorder")]
    public async Task<IActionResult> Reorder(Guid organizationId, [FromBody] ReorderIdeaTypesRequest request, CancellationToken cancellationToken)
    {
        await _service.ReorderIdeaTypesAsync(organizationId, request.OrderedIdeaTypeIds, cancellationToken);
        return NoContent();
    }

    [HttpDelete("idea-types/{ideaTypeId:guid}")]
    public async Task<IActionResult> Delete(Guid ideaTypeId, CancellationToken cancellationToken)
    {
        await _service.DeleteIdeaTypeAsync(ideaTypeId, cancellationToken);
        return NoContent();
    }
}
