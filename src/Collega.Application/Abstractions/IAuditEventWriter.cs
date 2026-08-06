using Collega.Domain.Auditing;

namespace Collega.Application.Abstractions;

public interface IAuditEventWriter
{
    Task WriteAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default);
}
