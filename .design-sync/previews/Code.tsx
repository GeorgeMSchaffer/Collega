import { Code } from '@collega/design-system'

/** Inline monospace for a literal the reader may have to type or match exactly. */
export const InProse = () => (
  <p className="m-0 max-w-prose text-sm">
    Two rows were rejected because the <Code>role</Code> column held a value this deployment does
    not define. The importer expects one of <Code>administrator</Code>, <Code>member</Code> or{' '}
    <Code>read-only</Code>.
  </p>
)

export const Literals = () => (
  <div className="flex flex-wrap items-center gap-3 text-sm">
    <Code>organization_id</Code>
    <Code>created_at</Code>
    <Code>{'{{idea.summary}}'}</Code>
  </div>
)
