import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";
import { Button, buttonVariants } from "./button";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="pagination"
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center gap-3 border-t bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: React.ComponentProps<"a"> & {
  isActive?: boolean;
  size?: "default" | "sm" | "icon";
}) {
  return (
    // Same pass-through case as InspectorTitle: children come via {...props}.
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a
      data-slot="pagination-link"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? "outline" : "ghost", size }),
        // The current page carries aria-current and a border, not just a tint.
        isActive && "font-semibold text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("gap-1", className)}
      {...props}
    >
      <ChevronLeft className="size-4" />
      Previous
    </Button>
  );
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("gap-1", className)}
      {...props}
    >
      Next
      <ChevronRight className="size-4" />
    </Button>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
