/**
 * Formula injection (CWE-1236) guard, ported from .NET's `Csv.StripFormulaGuard`. Spreadsheet
 * applications evaluate a cell whose text begins with `=`, `+`, `-`, `@`, tab, or CR as a formula
 * when the file is opened, so an export prefixes a guard apostrophe on such cells - re-importing
 * that file must strip the same guard back off, or the apostrophe becomes permanent stored data.
 *
 * This package does not build the export side (out of this slice's scope), but import must still
 * undo a guard applied by a previous export for the round trip to be lossless.
 */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r'])
const FORMULA_GUARD = "'"

/** True when `value`, after skipping any leading guard apostrophes, starts with a character a
 * spreadsheet would treat as a formula trigger. Guarding by depth (rather than only checking the
 * very first character) is what makes {@link stripFormulaGuard} an exact inverse of the export
 * side's guard at every level - see the .NET original for the `''=1+1` case this handles. */
function needsFormulaGuard(value: string): boolean {
  let i = 0
  while (i < value.length && value[i] === FORMULA_GUARD) {
    i++
  }
  const next = value[i]
  return next !== undefined && FORMULA_TRIGGERS.has(next)
}

/** Removes one leading guard apostrophe, but only when what remains would itself have been
 * guarded on export. A field that genuinely starts with an apostrophe (`'tis`, `''`) is left
 * untouched. */
export function stripFormulaGuard(field: string): string {
  if (field.length > 0 && field[0] === FORMULA_GUARD && needsFormulaGuard(field.slice(1))) {
    return field.slice(1)
  }
  return field
}
