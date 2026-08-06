using Collega.Application.Abstractions;
using Collega.Domain.Auditing;
using Collega.Infrastructure.Persistence;

namespace Collega.Infrastructure.Auditing;

public sealed class EfAuditEventWriter : IAuditEventWriter
{
    private readonly CollegaDbContext _dbContext;

    public EfAuditEventWriter(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task WriteAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default)
    {
        await _dbContext.AuditEvents.AddAsync(auditEvent, cancellationToken).ConfigureAwait(false);
        await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
