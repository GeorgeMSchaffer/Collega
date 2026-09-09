/**
 * The WRITE half of .NET's `src/Collega.API/Parsing/Csv.cs`, for the idea CSV export.
 *
 * The read half is already ported and lives in `packages/infrastructure/src/integrations/csv/`
 * (`parseCsvRecords` + `stripFormulaGuard`). The write half has no home there: nothing in
 * Infrastructure produces a CSV, and the .NET original was an API-layer helper for exactly that
 * reason - `IIdeaService` hands back headers and rows, and the controller serialises them.
 *
 * The guard logic below therefore mirrors `formula-guard.ts`'s, duplicated rather than imported:
 * that module exports only `stripFormulaGuard`, not the `needsFormulaGuard` predicate both halves
 * share, and widening its export surface is a change to `packages/` this slice may not make.
 * Whoever moves the export builder down a layer should collapse the two.
 *
 * FORMULA INJECTION (CWE-1236). Spreadsheets evaluate a cell whose text begins with `=`, `+`, `-`,
 * `@`, tab or CR, so user-authored content exported verbatim executes in the reader's spreadsheet.
 * A guard apostrophe is prefixed to such a cell and `stripFormulaGuard` removes exactly the same
 * guard on re-import, so export -> edit -> re-import is lossless. Counting the apostrophes is what
 * makes the pair exact inverses at every depth: `=1+1`, `'=1+1` and `''=1+1` are all guarded,
 * while `'tis`, `''` and `plain` are not.
 */

/** Leading characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r'])

const FORMULA_GUARD = "'"

/** Characters that force RFC 4180 quoting. */
const QUOTE_TRIGGERS = /["\n\r,]/

function needsFormulaGuard(value: string): boolean {
  let i = 0
  while (i < value.length && value[i] === FORMULA_GUARD) {
    i++
  }
  const next = value[i]
  return next !== undefined && FORMULA_TRIGGERS.has(next)
}

function escapeCell(value: string): string {
  // Guarded BEFORE quoting: the apostrophe becomes part of the cell text, so it belongs inside the
  // quotes when the value also needs them.
  const guarded = needsFormulaGuard(value) ? FORMULA_GUARD + value : value
  if (!QUOTE_TRIGGERS.test(guarded)) {
    return guarded
  }
  return `"${guarded.replaceAll('"', '""')}"`
}

/**
 * Serialises headers plus rows to CRLF-terminated CSV text, quoting only where required. Every
 * record ends in CRLF, the last one included - so the file ends `\r\n`, which is what the recorded
 * `ideas.export.*` bodies carry.
 */
export function writeCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return [headers, ...rows].map((cells) => `${cells.map(escapeCell).join(',')}\r\n`).join('')
}
