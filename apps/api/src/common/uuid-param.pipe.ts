import { Injectable, NotFoundException, type PipeTransform } from '@nestjs/common'

/** Canonical 8-4-4-4-12 hex form. */
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Restores the `{id:guid}` route constraint every .NET route carried. Without it a non-GUID path
 * segment reaches Prisma, which raises `P2023` on the uuid column, and the caller gets a 500.
 *
 * **404, not 400, and that is the whole point.** On the .NET side the constraint was part of route
 * MATCHING: a segment that was not a GUID matched no endpoint at all, so routing fell through to
 * the framework's own 404 - it never reached model binding and was never a validation failure.
 * Nest's built-in `ParseUUIDPipe` throws a 400, which is why it is not used here.
 *
 * Two divergences worth knowing, neither reproducible with a pipe:
 * - the pipe runs AFTER guards, so an anonymous caller on a malformed path gets 401 where .NET
 *   answered 404 - routing ran before authentication there;
 * - `Guid.TryParse` also accepted the `N`, `B` and `P` formats (unhyphenated, braced, bracketed),
 *   which this rejects. Prisma only accepts the canonical form, so passing one through would just
 *   move the 500.
 */
@Injectable()
export class UuidParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) {
      throw new NotFoundException()
    }
    return value
  }
}
