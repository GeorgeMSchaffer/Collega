/**
 * The reflection keys Nest's routing decorators write, restated rather than imported.
 *
 * `@nestjs/common/constants` exports these as values but ships no type declarations reachable under
 * this package's module resolution, so importing it typechecks as a missing module even though it
 * resolves at runtime. The keys themselves are part of Nest's public metadata contract (a
 * `RouterExplorer` reads them by exactly these strings), so restating them is stable; a Nest upgrade
 * that changed one would fail the assertions here loudly rather than silently.
 */
export const PATH_METADATA = 'path'
export const METHOD_METADATA = 'method'
export const HTTP_CODE_METADATA = '__httpCode__'
export const GUARDS_METADATA = '__guards__'
