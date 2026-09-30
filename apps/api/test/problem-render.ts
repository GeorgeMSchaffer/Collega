import { ProblemDetailsFilter } from '../src/common/errors/problem-details.filter.js'

/** What `ProblemDetailsFilter` writes for one exception, captured without an HTTP server. */
export type RenderedProblem = {
  status: number
  headers: Record<string, string>
  body: Record<string, unknown>
}

export function renderProblem(exception: unknown, url = '/api/v1/auth/login'): RenderedProblem {
  const captured: RenderedProblem = { status: 0, headers: {}, body: {} }
  const response = {
    status(code: number) {
      captured.status = code
      return this
    },
    setHeader(name: string, value: string) {
      captured.headers[name.toLowerCase()] = value
      return this
    },
    send(payload: string | Buffer) {
      captured.body = JSON.parse(payload.toString())
      return this
    },
  }
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url, originalUrl: url }),
    }),
  } as never

  new ProblemDetailsFilter().catch(exception, host)
  return captured
}
