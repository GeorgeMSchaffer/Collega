using Collega.Domain.Auditing;
using Collega.Infrastructure.Auditing;
using Collega.Infrastructure.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Tests;

public sealed class EfAuditEventWriterTests
{
    [Fact]
    public async Task Write_PersistsAuditEventImmediately()
    {
        var dbName = Guid.NewGuid().ToString();
        Guid eventId;

        using (var ctx = InMemoryContext.Create(dbName))
        {
            var writer = new EfAuditEventWriter(ctx);
            var auditEvent = AuditEvent.Create("UserCreated", "User", "A user was created.", TestClock.Default,
                organizationId: Guid.NewGuid(), actorUserId: Guid.NewGuid(), entityId: Guid.NewGuid(), metadataJson: "{}");
            eventId = auditEvent.Id;

            await writer.WriteAsync(auditEvent);
        }

        // The writer commits on its own (no external unit of work), so a fresh context sees it.
        using var verifyCtx = InMemoryContext.Create(dbName);
        var stored = await verifyCtx.AuditEvents.SingleAsync();
        Assert.Equal(eventId, stored.Id);
        Assert.Equal("UserCreated", stored.EventType);
    }
}
