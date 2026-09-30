// The user import's two bounds, added in the authentication hardening pass (contracts/users.md
// `POST /organizations/{organizationId}/users/import`): a body over 5 MB is refused at the
// pipeline as `413`, before the handler runs; a file over 5,000 data rows is the handler's own
// field-keyed `400`. Either way nothing is imported.
//
// The 413 runs the route's real `FileInterceptor` over an in-memory multipart stream - no socket.

import { Readable } from 'node:stream'
import type { OrganizationService } from '@collega/application/organizations'
import type { UserService } from '@collega/application/users'
import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { OrganizationsController } from '../src/organizations/organizations.controller.js'
import { renderProblem } from './problem-render.js'

const ORG = '11111111-1111-4111-8111-111111111111'
const URL = `/api/v1/organizations/${ORG}/users/import`
const MB = 1024 * 1024

function controllerRecordingImports(): { controller: OrganizationsController; imported: number[] } {
  const imported: number[] = []
  const users = {
    import: async (_org: string, rows: readonly unknown[]) => {
      imported.push(rows.length)
      return { importedCount: rows.length, rejectedCount: 0, rejections: [] }
    },
  } as unknown as UserService
  return {
    controller: new OrganizationsController({} as OrganizationService, users),
    imported,
  }
}

function csv(dataRows: number): Buffer {
  const lines = ['FirstName,LastName,Email,Role']
  for (let i = 0; i < dataRows; i++) lines.push(`Ann,Row${i},ann${i}@acme.test,User`)
  return Buffer.from(lines.join('\n'), 'utf8')
}

async function outcomeOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    (value) => value,
    (error: unknown) => error,
  )
}

describe('User import - the row ceiling', () => {
  it('imports a file of exactly 5,000 data rows', async () => {
    const { controller, imported } = controllerRecordingImports()

    await controller.importUsers(ORG, { buffer: csv(5_000) })

    expect(imported).toEqual([5_000])
  })

  it('refuses 5,001 data rows as a 400 keyed on csvFile, and imports none of them', async () => {
    const { controller, imported } = controllerRecordingImports()

    const outcome = await outcomeOf(controller.importUsers(ORG, { buffer: csv(5_001) }))

    const rendered = renderProblem(outcome, URL)
    expect(rendered.status).toBe(400)
    expect(rendered.body.errors).toEqual({
      csvFile: [
        'The file has 5001 rows, which is more than the 5000 this import supports. Split it into smaller files.',
      ],
    })
    expect(imported).toEqual([])
  })
})

describe('User import - the body limit', () => {
  const BOUNDARY = 'collega-test-boundary'

  function multipartRequest(fileBytes: number) {
    const head = Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="csvFile"; filename="users.csv"\r\n` +
        'Content-Type: text/csv\r\n\r\n',
    )
    const tail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`)
    const body = Buffer.concat([head, Buffer.alloc(fileBytes, 0x61), tail])
    return Object.assign(Readable.from([body]), {
      headers: {
        'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
        'content-length': String(body.length),
      },
    }) as Readable & { headers: Record<string, string>; file?: { buffer: Buffer } }
  }

  async function intercept(fileBytes: number) {
    const [Interceptor] = Reflect.getMetadata(
      '__interceptors__',
      OrganizationsController.prototype.importUsers,
    ) as (new (
      options: object,
    ) => { intercept(c: ExecutionContext, n: CallHandler): unknown })[]
    if (Interceptor === undefined) throw new Error('importUsers has no interceptor')

    const request = multipartRequest(fileBytes)
    let handled = false
    const context = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
    } as unknown as ExecutionContext
    const next: CallHandler = {
      handle: () => {
        handled = true
        return null as never
      },
    }
    const outcome = await outcomeOf(Promise.resolve(new Interceptor({}).intercept(context, next)))
    return { outcome, handled, file: request.file }
  }

  it('hands the handler a file of exactly 5 MB', async () => {
    const { handled, file } = await intercept(5 * MB)

    expect(handled).toBe(true)
    expect(file?.buffer.length).toBe(5 * MB)
  })

  it('refuses one byte over 5 MB with 413 before the handler runs', async () => {
    const { outcome, handled } = await intercept(5 * MB + 1)

    expect(handled).toBe(false)
    expect(renderProblem(outcome, URL).status).toBe(413)
  })
})
