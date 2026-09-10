/**
 * Which page of a list screen is being shown, and how that survives opening a row.
 *
 * `/ideas` and `/ideas/[ideaId]` render the same table and have to agree about which page it is,
 * or the companion table beside an open idea is a different twenty rows than the one the reader
 * clicked from — with the selected row not among them. So both read the number through here rather
 * than each parsing `?page=` its own way, and `IdeasTable` writes it back into every row link.
 */

/** Anything that is not a page number past the first is the first page, including nothing at all. */
export function requestedPage(raw: string | undefined): number {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1
}

/** `?page=` only where it carries information, so page one keeps the bare URL it is linked at. */
export function pageQuery(page: number): string {
  return page > 1 ? `?page=${page}` : ''
}
