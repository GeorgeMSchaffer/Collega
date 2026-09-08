import { FileButton } from '@collega/design-system'

/**
 * A file picker that looks like a button: the real `<input type="file">` stays in the DOM and in
 * the tab order, positioned 1x1 at zero opacity inside the label.
 */
export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <FileButton id="p-csv" label="Choose CSV" accept=".csv" />
    <FileButton id="p-csv2" label="Choose CSV" accept=".csv" variant="default" />
    <FileButton id="p-csv3" label="Choose CSV" accept=".csv" variant="secondary" />
  </div>
)

export const UserImport = () => (
  <div className="flex max-w-lg flex-col gap-2">
    <span className="text-sm font-medium">Import users</span>
    <p className="m-0 text-sm text-muted-foreground">
      A CSV with <code className="font-mono text-xs">email</code>,{' '}
      <code className="font-mono text-xs">name</code> and{' '}
      <code className="font-mono text-xs">role</code> columns. Rows that fail validation are
      reported and nothing is imported.
    </p>
    <FileButton id="p-users" label="Choose CSV" accept=".csv" className="self-start" />
  </div>
)
