using Collega.API.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Pipeline-verification endpoint only — proves request validation and the problem-details
/// error envelope work end to end (SPEC/30-Contracts.md "Error Envelope" and "Validation Message
/// Conventions"). Not a product feature; later epics add real resource controllers.
/// </summary>
[ApiController]
[Route("diagnostics")]
public sealed class DiagnosticsController : ControllerBase
{
    [HttpPost("echo")]
    public IActionResult Echo([FromBody] EchoRequest request) => Ok(new { message = request.Message.Trim() });
}
