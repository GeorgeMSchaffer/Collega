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

    [HttpGet("{organizationId:guid}/tags")]
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
