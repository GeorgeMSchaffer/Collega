using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Dependency-free liveness check. Deliberately avoids touching the database so it stays
/// available for boot verification even when SQL Server isn't reachable.
/// </summary>
[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "Healthy", timestampUtc = DateTime.UtcNow });
}
