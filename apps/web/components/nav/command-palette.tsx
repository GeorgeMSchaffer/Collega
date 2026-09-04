"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Kbd,
} from "@collega/design-system";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useWorkspace } from "@/lib/workspace";

/**
 * Ctrl K / ⌘K from anywhere. `CommandDialog` is a Radix Dialog, so Escape closes it, focus
 * moves to the input on open and returns to whatever opened it on close, and the desk behind
 * it is inert while it is up — the four behaviours Sprint 7.5 found missing on the Blazor
 * drawers, none of them written here.
 *
 * The boards in it are the real recorded boards, so the palette is a way to reach a board
 * rather than a demonstration of one.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const boards = useWorkspace().boards.data ?? [];

  const go = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Go to">
          <CommandItem value="ideas" onSelect={() => go("/ideas")}>
            Ideas <CommandShortcut>G I</CommandShortcut>
          </CommandItem>
          <CommandItem value="boards" onSelect={() => go("/boards")}>
            Boards <CommandShortcut>G B</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        {boards.length > 0 ? (
          <CommandGroup heading="Boards">
            {boards.map((board) => (
              <CommandItem
                key={board.boardId}
                value={`board ${board.name}`}
                onSelect={() => go(`/board/${board.boardId}`)}
              >
                {board.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
      <CommandFooter>
        <span>
          <Kbd>↵</Kbd> open
        </span>
        <span>
          <Kbd>esc</Kbd> close
        </span>
      </CommandFooter>
    </CommandDialog>
  );
}

/** Binds Ctrl K / ⌘K, and returns the open state so the launcher button shares it. */
export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}
