// The idea-import parser's side of the structured fields (CSV Import rule 3a): both spellings of the
// new headers land on the same key (SPEC/30-Contracts.md writes `Proposed Solutions`, the ideas spec
// `ProposedSolutions`), a file written before the columns existed still parses, and a quoted
// multi-line Proposed Solutions cell reaches the service with its line breaks intact.

import { IdeaCsvColumns } from '@collega/application/ideas'
import { describe, expect, it } from 'vitest'
import { parseIdeaImportCsv } from '../src/integrations/csv/parse-idea-import-csv.js'

const REQUIRED = 'Title,Priority,Idea Type,Business Impact'
const VALUES = 'Idea,Medium,Improvement,Medium'

describe('parseIdeaImportCsv structured columns', () => {
  it.each([
    ['the exported spelling', 'Proposed Solutions,Impact Rationale'],
    ['the unspaced spelling', 'ProposedSolutions,ImpactRationale'],
    ['either spelling in any case', 'PROPOSEDSOLUTIONS,impact rationale'],
  ])('reads %s onto the same keys', (_label, headers) => {
    const [row] = parseIdeaImportCsv(`${REQUIRED},${headers}\r\n${VALUES},Add SSO.,Faster.\r\n`)

    expect(row?.cells.get(IdeaCsvColumns.proposedSolutions)).toBe('Add SSO.')
    expect(row?.cells.get(IdeaCsvColumns.impactRationale)).toBe('Faster.')
  })

  it('keeps each line of a quoted multi-line solutions cell', () => {
    const [row] = parseIdeaImportCsv(
      `${REQUIRED},Problem,Proposed Solutions\r\n${VALUES},Slow.,"Cut a form.\nAdd SSO, later."\r\n`,
    )

    expect(row?.cells.get(IdeaCsvColumns.problem)).toBe('Slow.')
    expect(row?.cells.get(IdeaCsvColumns.proposedSolutions)).toBe('Cut a form.\nAdd SSO, later.')
  })

  it('parses a file with no Description and none of the new columns', () => {
    const rows = parseIdeaImportCsv(`${REQUIRED}\n${VALUES}\n`)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.cells.has(IdeaCsvColumns.problem)).toBe(false)
    expect(rows[0]?.cells.has(IdeaCsvColumns.description)).toBe(false)
  })

  it('still refuses a file missing a required column', () => {
    expect(() => parseIdeaImportCsv('Title,Priority,Idea Type\nIdea,Medium,Improvement\n')).toThrow(
      'The CSV file is invalid.',
    )
  })
})
