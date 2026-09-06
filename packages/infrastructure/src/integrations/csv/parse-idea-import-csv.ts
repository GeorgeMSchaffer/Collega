import { ValidationError } from '@collega/application/common'
import { IDEA_CSV_REQUIRED_KEYS, type IdeaImportRow } from '@collega/application/ideas'
import { stripFormulaGuard } from './formula-guard.js'
import { parseCsvRecords } from './parse-csv-records.js'

/**
 * Parses an uploaded idea-import CSV into {@link IdeaImportRow} values (ports .NET's
 * `CsvIdeaImportParser`). Columns are located by header name (case-insensitive) so order is
 * flexible; every cell is exposed keyed by its lowercased header, including any per-UDF-field
 * columns the caller resolves downstream. A missing/empty file, or a header missing a required
 * column, is a malformed request; individual bad-data rows are the Application layer's concern
 * to reject per-row.
 *
 * This function only extracts raw cell values - it has no idea which user or organization the
 * caller acts as, so it cannot bypass the View-As-only rule for idea import (SPEC/50-typescript-
 * migration.md plan): that gate lives entirely in the Application layer, above this parser.
 */
export function parseIdeaImportCsv(content: string): readonly IdeaImportRow[] {
  const records = parseCsvRecords(content)

  const headerIndex = records.findIndex((record) => record.some((cell) => cell.trim().length > 0))
  if (headerIndex < 0) {
    throw emptyFileError()
  }

  const headerRecord = records[headerIndex]
  if (headerRecord === undefined) {
    throw emptyFileError()
  }

  const headers = headerRecord.map((cell) => cell.trim().toLowerCase())
  const missing = IDEA_CSV_REQUIRED_KEYS.filter((key) => !headers.includes(key))
  if (missing.length > 0) {
    throw new ValidationError('The CSV file is invalid.', {
      csvFile: [`The CSV must have these columns: ${IDEA_CSV_REQUIRED_KEYS.join(', ')}.`],
    })
  }

  const rows: IdeaImportRow[] = []
  let rowNumber = 0

  for (let i = headerIndex + 1; i < records.length; i++) {
    const record = records[i]
    if (record === undefined || record.every((cell) => cell.trim().length === 0)) {
      continue
    }

    rowNumber++
    const cells = new Map<string, string | null>()
    for (let column = 0; column < headers.length; column++) {
      const header = headers[column]
      if (header === undefined) {
        continue
      }
      // Last column with a duplicated header wins; unmapped extra cells are ignored.
      const raw = column < record.length ? record[column] : undefined
      cells.set(header, raw === undefined ? null : stripFormulaGuard(raw.trim()))
    }

    rows.push({ rowNumber, cells })
  }

  return rows
}

function emptyFileError(): ValidationError {
  return new ValidationError('The CSV file is invalid.', {
    csvFile: ['The CSV file is empty.'],
  })
}
