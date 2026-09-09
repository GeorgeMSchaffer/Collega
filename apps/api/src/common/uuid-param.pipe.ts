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
 * Two known divergences:
 * - the pipe runs AFTER guards, so an anonymous caller on a malformed path gets 401 where .NET
 *   answered 404 - routing ran before authentication there. Not reproducible with a pipe; it would
 *   take middleware.
 * - `Guid.TryParse` also accepted the `N`, `B` and `P` formats (unhyphenated, braced, bracketed),
 *   so `GET /users/fe9f702edc9c4eaab7c91c4e258a5717` was a 200 there and is a 404 here. This is
 *   NOT DONE rather than impossible: the pipe could rehyphenate and hand Prisma the canonical
 *   string, which is a few lines. It is left out because accepting a format no client sends is a
 *   behaviour change of its own - `apps/api/test/uuid-param.pipe.test.ts` pins the rejection - and
 *   nothing in the corpus or the UI produces one.
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
