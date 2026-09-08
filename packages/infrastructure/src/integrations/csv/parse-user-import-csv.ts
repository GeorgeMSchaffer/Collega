import { ValidationError } from '@collega/application/common'
import type { UserImportRow } from '@collega/application/users'
import { parseCsvRecords } from './parse-csv-records.js'

const REQUIRED_COLUMNS = ['firstname', 'lastname', 'email']

/**
 * Parses the uploaded user-import CSV into {@link UserImportRow} values (SPEC/30-Contracts.md
 * user import; ports .NET's `CsvUserImportParser`). Columns are located by header name
 * (`firstName`, `lastName`, `email`, optional `role`), so column order is flexible. Upgraded to
 * the same `csv-parse`-backed quoting support as the idea importer rather than the .NET original's
 * deliberately minimal comma-splitter - one parser for both is simpler to maintain and quoted
 * names/emails are not a behavior anyone relies on being rejected.
 *
 * This function is direct: unlike idea import, user import does not require a View As session
 * (SPEC/50-typescript-migration.md plan) - a rule enforced by the Application layer, not by
 * anything this parser does or omits.
 */
export function parseUserImportCsv(content: string): readonly UserImportRow[] {
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
  const firstNameIndex = headers.indexOf('firstname')
  const lastNameIndex = headers.indexOf('lastname')
  const emailIndex = headers.indexOf('email')
  const roleIndex = headers.indexOf('role')

  if (firstNameIndex < 0 || lastNameIndex < 0 || emailIndex < 0) {
    throw new ValidationError('The CSV file is invalid.', {
      csvFile: [`The CSV must have these columns: ${REQUIRED_COLUMNS.join(', ')}.`],
    })
  }

  const rows: UserImportRow[] = []
  let rowNumber = 0

  for (let i = headerIndex + 1; i < records.length; i++) {
    const record = records[i]
    if (record === undefined || record.every((cell) => cell.trim().length === 0)) {
      continue
    }

    rowNumber++
    rows.push({
      rowNumber,
      firstName: cellAt(record, firstNameIndex),
      lastName: cellAt(record, lastNameIndex),
      email: cellAt(record, emailIndex),
      role: cellAt(record, roleIndex),
    })
  }

  return rows
}

function cellAt(record: readonly string[], index: number): string | null {
  if (index < 0 || index >= record.length) {
    return null
  }
  const value = record[index]
  return value === undefined ? null : value.trim()
}

function emptyFileError(): ValidationError {
  return new ValidationError('The CSV file is invalid.', {
    csvFile: ['The CSV file is empty.'],
  })
}
