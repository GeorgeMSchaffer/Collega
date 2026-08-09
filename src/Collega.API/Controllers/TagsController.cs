using Collega.Application.Tags;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Organization-scoped tag autocomplete (SPEC/30-Contracts.md "Tag Contracts"). Tags themselves are
/// created implicitly when an idea is saved, so there is no tag create endpoint here.
/// </summary>
[ApiController]
[Authorize]
[Route("organizations")]
public sealed class TagsController : ControllerBase
{
    private readonly ITagService _tagService;

    public TagsController(ITagService tagService)
    {
        _tagService = tagService;
    }

    /// <summary>Return tag autocomplete suggestions within an organization.</summary>
    [HttpGet("{organizationId:guid}/tags")]
    [ProducesResponseType(typeof(IEnumerable<string>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Suggest(
        Guid organizationId,
        [FromQuery] string? search,
        [FromQuery] int? limit,
        CancellationToken cancellationToken)
    {
        var result = await _tagService.SuggestAsync(organizationId, search ?? string.Empty, limit, cancellationToken);
        return Ok(result);
    }
}
