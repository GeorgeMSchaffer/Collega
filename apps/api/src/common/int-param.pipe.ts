import { Injectable, NotFoundException, type PipeTransform } from '@nestjs/common'

/** `int` is 32-bit and signed in the pre-migration API, and the route constraint bound to one. */
const INT32_MIN = -2147483648
const INT32_MAX = 2147483647

/** Optional sign then digits - what the pre-migration API's integer parsing accepted. */
const INTEGER = /^-?\d+$/

/**
 * Restores the `{version:int}` route constraint on
 * `POST /ai-assist/prompt/versions/{version}/restore`, the only integer route parameter in the API.
 *
 * **404, not 400**, for the same reason `uuid-param.pipe.ts` answers 404: in the pre-migration API `:int`
 * was part of route MATCHING, so a non-integer segment matched no endpoint and fell through to a
 * 404 - it never reached model binding and was never a validation failure. Nest's
 * built-in `ParseIntPipe` throws 400, which is why it is not used here.
 *
 * The range check is not pedantry: without it `versions/99999999999/restore` reaches Prisma's `Int`
 * column and answers 500, where `:int` refused to match it at all.
 */
@Injectable()
export class IntParamPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!INTEGER.test(value)) {
      throw new NotFoundException()
    }
    const parsed = Number(value)
    if (parsed < INT32_MIN || parsed > INT32_MAX) {
      throw new NotFoundException()
    }
    return parsed
  }
}
