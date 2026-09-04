"use client";

import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";

const toggleVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
    "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    // Pressed shows as a coloured border *and* a weight change, never colour alone.
    "data-[state=on]:border-primary data-[state=on]:font-semibold data-[state=on]:text-primary",
  ),
  {
    variants: {
      variant: {
        default: "border border-transparent text-muted-foreground",
        outline: "border bg-background text-muted-foreground",
      },
      size: {
        default: "h-8 px-2",
        sm: "px-2 py-0.5",
      },
    },
    defaultVariants: { variant: "outline", size: "sm" },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
