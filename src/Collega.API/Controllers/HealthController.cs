using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Dependency-free liveness check. Deliberately avoids touching the database so it stays
/// available for boot verification even when PostgreSQL isn't reachable.
/// </summary>
[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    /// <summary>Dependency-free liveness probe. Always returns <c>200 Healthy</c> when the host is up.</summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult Get() => Ok(new { status = "Healthy", timestampUtc = DateTime.UtcNow });
}
