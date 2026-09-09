import { Label, Textarea } from '@collega/design-system'

export const Default = () => (
  <div className="max-w-md">
    <Label htmlFor="p-summary">Summary</Label>
    <Textarea
      id="p-summary"
      rows={4}
      defaultValue="Weekly reporting takes two people a full afternoon. Most of it is copying the same figures out of three dashboards into one spreadsheet."
    />
  </div>
)

export const Invalid = () => (
  <div className="max-w-md">
    <Label htmlFor="p-detail">Detail</Label>
    <Textarea id="p-detail" rows={3} defaultValue="Too short." invalid />
  </div>
)

/** The system-prompt editor is the tallest use in the product. */
export const Tall = () => (
  <div className="max-w-md">
    <Label htmlFor="p-prompt">System prompt</Label>
    <Textarea
      id="p-prompt"
      rows={8}
      defaultValue={
        'You help members of this organization write clear product ideas.\n\nAsk for the problem before the solution. Keep summaries under two sentences. Never invent a customer name, a date, or a figure that the member has not given you.'
      }
    />
  </div>
)
