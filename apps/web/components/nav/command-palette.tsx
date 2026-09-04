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
 * moves to the input on open, and the desk behind it is inert while it is up — three of the
 * four behaviours Sprint 7.5 found missing on the Blazor drawers, none of them written here.
 * The fourth, returning focus to whatever opened it, is written here; see `useCommandPalette`.
 *
 * The boards in it are the real recorded boards, so the palette is a way to reach a board
 * rather than a demonstration of one.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean, restoreFocus?: boolean) => void;
}) {
  const router = useRouter();
  const boards = useWorkspace().boards.data ?? [];

  const go = React.useCallback(
    (href: string) => {
      // Closing to go somewhere, so the focus restore is suppressed: putting focus back on
      // the sidebar launcher a tick after arriving on a new page is not returning the
      // keyboard user to where they were, it is taking them away from where they went.
      onOpenChange(false, false);
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

/**
 * Binds Ctrl K / ⌘K, returns the open state so the launcher button shares it, and gives
 * focus back to whatever opened the palette when it closes.
 *
 * Radix restores focus to a `DialogTrigger`, and this dialog has none — it is opened from a
 * button in the sidebar and from a global key, with the open state held here. With no trigger
 * to return to, Radix's close handler lands focus on `<body>`, which is the keyboard user
 * losing their place: verified in Chromium, not assumed. So the element that had focus at the
 * moment it opened is remembered and handed it back.
 *
 * The restore is deferred by a tick because Radix moves focus during the unmount that this
 * same state change causes; focusing synchronously would simply be undone.
 */
export function useCommandPalette() {
  const [open, setOpenState] = React.useState(false);
  const opener = React.useRef<HTMLElement | null>(null);
  const restore = React.useRef<number | null>(null);

  const setOpen = React.useCallback((next: boolean, restoreFocus = true) => {
    if (next) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else {
      const previous = opener.current;
      opener.current = null;
      if (restoreFocus && previous) {
        restore.current = window.setTimeout(() => {
          restore.current = null;
          if (previous.isConnected) previous.focus();
        }, 0);
      }
    }
    setOpenState(next);
  }, []);

  React.useEffect(
    () => () => {
      if (restore.current !== null) window.clearTimeout(restore.current);
    },
    [],
  );

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen(!open);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  return { open, setOpen };
}
