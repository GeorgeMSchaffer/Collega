import { parse } from 'csv-parse/sync'

/**
 * RFC 4180-aware CSV parsing shared by the idea and user import readers, backed by `csv-parse`
 * rather than a hand-rolled state machine (ports .NET's `Csv.Parse`, which existed only because
 * the .NET side avoided a new NuGet dependency for it). Handles quoted fields with embedded
 * commas/newlines and either line-ending style; a trailing newline does not produce a phantom
 * empty trailing record.
 */
export function parseCsvRecords(content: string): readonly (readonly string[])[] {
  if (content.length === 0) {
    return []
  }

  return parse(content, {
    bom: true,
    // Rows may legitimately have fewer columns than the header (a trailing column left blank) -
    // the caller, not this parser, decides what a missing cell means.
    relax_column_count: true,
    // Blank lines are preserved as `[""]` rather than dropped, matching .NET's behaviour of
    // reaching the row and letting the caller's own "all cells blank" check skip it.
    skip_empty_lines: false,
  }) as string[][]
}
