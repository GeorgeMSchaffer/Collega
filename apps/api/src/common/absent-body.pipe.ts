import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common'

/**
 * Normalises a MISSING request body to `{}` for every `@Body()` parameter, globally.
 *
 * Express's JSON parser only runs when the request declares a JSON content type. A `PUT` or `POST`
 * carrying no body - or a body with no `Content-Type` - therefore leaves `req.body` as `undefined`,
 * Nest hands the handler that `undefined`, and the first `body.<field>` read is a `TypeError` and a
 * 500. Every body-taking route on every controller had that hole; the D1 routes shipped with it.
 *
 * Registered as a GLOBAL pipe rather than fixed per controller so a route added later cannot
 * reintroduce it by forgetting to guard.
 *
 * **A KNOWN DIVERGENCE, and deliberately the smaller one.** `[ApiController]` rejected a body-less
 * request during MODEL BINDING, before the action ran, so the .NET answer was a 400 - not the
 * `{}`-shaped answer this produces, which is a 400 from the route's own `validateFields` on every
 * route that requires a field and the Application envelope on the rest. Reproducing the .NET answer
 * exactly means reproducing its message, and **the exact .NET text is unverified**: no fixture in
 * the corpus sends a body-less request to a body-taking route, so the wording would be invented.
 * Record one against the frozen .NET app first, then tighten this to throw
 * `RequestValidationError` with the recorded wording.
 */
@Injectable()
export class AbsentBodyPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // `null` as well as `undefined`: an explicit JSON `null` body dereferences exactly the same.
    return metadata.type === 'body' && (value === undefined || value === null) ? {} : value
  }
}
