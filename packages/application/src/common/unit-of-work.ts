/**
 * Commits everything a use case has changed, as one transaction.
 *
 * A port so the application layer can express a transaction boundary without knowing what
 * implements it — Wave C1 owns the Prisma-backed version. Ported from the .NET
 * `IUnitOfWork.SaveChangesAsync`, which is the whole of that interface: deliberately narrow,
 * because a service that can begin, nest and roll back transactions ends up encoding
 * persistence strategy in the layer that is supposed to be free of it.
 *
 * Promoted to the kernel before Wave B's remaining partitions start, since the first one to
 * need it defined its own and the next six would each have defined another.
 */
export interface UnitOfWork {
  saveChanges(): Promise<void>
}
