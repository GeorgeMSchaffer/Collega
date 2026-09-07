import { randomUUID } from 'node:crypto'
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { ApplicationError, RateLimitedError, ValidationError } from '@collega/application/common'
import type { Request, Response } from 'express'

/**
 * The one place every non-2xx response is built. Mirrors `src/Collega.API/ErrorHandling/
 * AppExceptionHandler.cs`, and reproduces its most important property: THE SAME STATUS CODE
 * RENDERS DIFFERENTLY DEPENDING ON WHICH LAYER REJECTED THE REQUEST. The golden corpus records
 * two distinct 401 shapes and two distinct 403 shapes for exactly this reason (447 fixtures;
 * 80+2 at 401, 24+122 at 403 - see the D0 slice report):
 *
 * | Rejected by | Example | `type` | Headers |
 * |---|---|---|---|
 * | A guard, before any Application code runs (`AuthGuard` throwing `UnauthorizedException`, or
 * | any other built-in Nest `HttpException`) | anonymous call to a protected route | RFC 9110 URI
 * | | `content-type` carries `; charset=utf-8`; no cache-control headers |
 * | An Application service throwing a kernel `ApplicationError` after authenticating fine | a
 * | wrong password | `https://collega.dev/problems/*` | `content-type` has NO charset;
 * | `Cache-Control: no-cache,no-store` / `Pragma: no-cache` / `Expires: -1` are present |
 *
 * That second row's headers are not decorative choices made here - they reproduce what ASP.NET's
 * own `UseExceptionHandler` middleware does automatically the moment something is thrown and
 * caught (clearing response caching headers), which is why .NET's two paths differ identically.
 * A Nest `HttpException` thrown deliberately by a guard never passed through anything like that,
 * so it keeps the plainer, framework-default shape instead.
 *
 * `errors` (field-keyed validation failures) is set only for the kernel's `ValidationError`. A
 * future request-DTO validation pipe (D1-D7's to build) that wants the identical `400` shape
 * should throw `ValidationError` itself rather than a Nest `BadRequestException` - throwing the
 * kernel type is what routes it through the first row of this table's SECOND column, not a new
 * branch added here.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const instance = (request.originalUrl ?? request.url).split('?')[0] ?? request.url
    // A fresh id per error response, not the ambient request id: this file must not join the
    // identity chokepoint's allowlist (tools/arch/identity-chokepoint.test.ts) over something
    // that has nothing to do with identity. The golden corpus only checks a traceId is PRESENT,
    // never that it matches anything else in the response.
    const traceId = randomUUID()

    if (exception instanceof ApplicationError) {
      this.sendKernel(response, exception, instance, traceId)
      return
    }

    if (exception instanceof HttpException) {
      this.sendFramework(response, exception, instance, traceId)
      return
    }

    // eslint-disable-next-line no-console -- the one place an unexpected error is allowed to be
    // logged rather than silently swallowed; nothing about this response reveals it to the caller.
    console.error('Unhandled exception', exception)
    this.sendFramework(
      response,
      new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR),
      instance,
      traceId,
    )
  }

  private sendKernel(
    response: Response,
    exception: ApplicationError,
    instance: string,
    traceId: string,
  ): void {
    const status = KERNEL_STATUS[exception.kind] ?? HttpStatus.INTERNAL_SERVER_ERROR
    const body: ProblemBody = {
      type: KERNEL_TYPE[exception.kind] ?? 'https://collega.dev/problems/error',
      title: KERNEL_TITLE[exception.kind] ?? 'Error',
      status,
      detail:
        exception instanceof ValidationError
          ? 'The request failed validation. See the errors property for field-level details.'
          : exception.message,
      instance,
      traceId,
    }
    if (exception instanceof ValidationError) {
      body.errors = exception.failures
    }
    if (exception instanceof RateLimitedError) {
      response.setHeader('Retry-After', String(exception.retryAfterSeconds))
    }

    response
      .status(status)
      // No charset: matches AppExceptionHandler's explicit WriteAsJsonAsync(..., contentType:
      // "application/problem+json") call, which passes the content type verbatim.
      .setHeader('Content-Type', 'application/problem+json')
      .setHeader('Cache-Control', 'no-cache,no-store')
      .setHeader('Pragma', 'no-cache')
      .setHeader('Expires', '-1')
      .send(JSON.stringify(body))
  }

  private sendFramework(
    response: Response,
    exception: HttpException,
    instance: string,
    traceId: string,
  ): void {
    const status = exception.getStatus()
    const rfcType = RFC_TYPE[status]
    const body: ProblemBody = {
      type: rfcType ?? 'https://collega.dev/problems/error',
      title: RFC_TITLE[status] ?? exception.name.replace(/Exception$/, ''),
      status,
      detail: rfcType
        ? `No further details are available for this ${status} response.`
        : messageFrom(exception),
      instance,
      traceId,
    }

    response
      .status(status)
      // WITH charset: matches the default ASP.NET problem-details writer used for a framework-
      // level rejection (a guard throwing before any Application code runs), never the explicit
      // no-charset call AppExceptionHandler makes for a thrown Application exception.
      .setHeader('Content-Type', 'application/problem+json; charset=utf-8')
      .send(JSON.stringify(body))
  }
}

type ProblemBody = {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  traceId: string
  errors?: Readonly<Record<string, readonly string[]>>
}

const KERNEL_TYPE: Readonly<Record<string, string>> = {
  validation: 'https://collega.dev/problems/validation-error',
  unauthorized: 'https://collega.dev/problems/unauthorized',
  forbidden: 'https://collega.dev/problems/forbidden',
  notFound: 'https://collega.dev/problems/not-found',
  conflict: 'https://collega.dev/problems/conflict',
  lockedOut: 'https://collega.dev/problems/too-many-requests',
  rateLimited: 'https://collega.dev/problems/too-many-requests',
  aiAssistUnavailable: 'https://collega.dev/problems/service-unavailable',
}

const KERNEL_STATUS: Readonly<Record<string, number>> = {
  validation: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  notFound: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  lockedOut: HttpStatus.TOO_MANY_REQUESTS,
  rateLimited: HttpStatus.TOO_MANY_REQUESTS,
  aiAssistUnavailable: HttpStatus.SERVICE_UNAVAILABLE,
}

const KERNEL_TITLE: Readonly<Record<string, string>> = {
  validation: 'One or more fields are invalid.',
  unauthorized: 'Unauthorized',
  forbidden: 'Forbidden',
  notFound: 'Not Found',
  conflict: 'Conflict',
  lockedOut: 'Too Many Requests',
  rateLimited: 'Too Many Requests',
  aiAssistUnavailable: 'Service Unavailable',
}

/** RFC 9110 URIs for a framework-level rejection - only the two statuses the corpus actually
 * records this way (401/403). Any other framework `HttpException` falls back to a generic
 * `collega.dev/problems/error` type in `sendFramework` above. */
const RFC_TYPE: Readonly<Record<number, string>> = {
  [HttpStatus.UNAUTHORIZED]: 'https://tools.ietf.org/html/rfc9110#section-15.5.2',
  [HttpStatus.FORBIDDEN]: 'https://tools.ietf.org/html/rfc9110#section-15.5.4',
}

const RFC_TITLE: Readonly<Record<number, string>> = {
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
}

function messageFrom(exception: HttpException): string {
  const body = exception.getResponse()
  if (typeof body === 'string') return body
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message
    if (typeof message === 'string') return message
    if (Array.isArray(message)) return message.join(' ')
  }
  return exception.message
}
