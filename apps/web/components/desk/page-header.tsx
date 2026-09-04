/**
 * Comp Q's page head: the `h1` and the one-line standfirst that says what the page shows and
 * how it is ordered. Every content screen opens with this, so it is one component rather
 * than the same two elements written out on each.
 */
export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1">
        <h1>{title}</h1>
        {children ? <p className="mt-1 mb-0 text-sm text-muted-foreground">{children}</p> : null}
      </div>
    </div>
  );
}
