import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        // REG's `.badge`: bordered and tinted text, no fill — the fill belongs to `secondary`.
        default: "border text-primary",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground",
        outline: "border text-muted-foreground",
        destructive:
          "border border-destructive/40 bg-destructive/10 text-destructive",
        // The D-SUGGEST mark. --sug on --sug-soft is the pair SPEC/20-feature-client-ui.md
        // requires (5.6:1); --color-teal is the brand fill and is not legible as ink on its
        // own tint, so it is deliberately not used here.
        suggested: "border border-transparent bg-sug-soft text-sug",
        warning: "border border-warning/50 bg-warning/15 text-foreground",
        // `.key` / `.invite`: an identifier, not a status.
        mono: "rounded-sm border bg-muted font-mono tabular-nums tracking-wider",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

/** A keyboard key. shadcn has no Kbd primitive; REG maps `.kbd` onto one. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "rounded-sm border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants, Kbd };
