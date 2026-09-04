import { cn } from "@collega/design-system";

/**
 * The one encoding comp Q uses for a category: an 8px dot with its label always beside it.
 *
 * The label is the meaning; the dot is decoration and is hidden from assistive technology.
 * `SPEC/decisions.md` 2026-08-31 forbids colour carrying meaning alone, and the Blazor board
 * broke that rule twice — once for idea type, once for priority — which is why type, status
 * and priority all come through here rather than each drawing its own chip.
 *
 * A category with no configured colour (idea types carry `colorHex: null` throughout the
 * corpus) simply renders without a dot. That is correct: an absent colour is not a colour.
 */
export function Marker({
  color,
  children,
  className,
}: {
  color?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex max-w-full min-w-0 items-center gap-1.5 text-sm", className)}>
      {color ? (
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ background: color }}
        />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
