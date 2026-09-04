"use client";

/**
 * The parts every organization-scoped list screen repeats: the search box, the screen state,
 * and the note that has to appear when filtering happens in the browser.
 *
 * Filtering in the browser is not a shortcut — the corpus captured each of these lists once,
 * unfiltered, and none of these endpoints was ever recorded with a query string. Asking the
 * API would get the same recording back with a flag saying the query was ignored, which is
 * a worse answer than narrowing what is already here and saying so.
 */

import { Input, Label, type ScreenState } from "@collega/design-system";
import * as React from "react";

import { CorpusNote } from "@/components/desk/notices";

export interface ListFrame<T> {
  readonly search: string;
  readonly setSearch: (value: string) => void;
  readonly visible: readonly T[];
  readonly narrowed: boolean;
  readonly state: ScreenState;
}

/**
 * `matches` is called for every item on every keystroke, so it must be stable — wrap it in
 * `useCallback` at the call site or define it at module scope.
 */
export function useListFrame<T>({
  items,
  filter,
  loading,
  error,
  matches,
  override,
}: {
  /** The unfiltered list, exactly as it came back. */
  items: readonly T[];
  /**
   * A screen's own dropdown, applied here rather than before the hook — narrowing `items`
   * first would make `narrowed` false for a filter that matched nothing, and the screen
   * would then say "no users yet" to an administrator whose organization is full of them.
   * Must be stable: it runs for every item on every keystroke.
   */
  filter?: (item: T) => boolean;
  loading: boolean;
  error: boolean;
  matches: (item: T, needle: string) => boolean;
  override: ScreenState | null;
}): ListFrame<T> {
  const [search, setSearch] = React.useState("");

  const visible = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (filter === undefined || filter(item)) && (needle.length === 0 || matches(item, needle)),
    );
  }, [items, filter, search, matches]);

  const state: ScreenState =
    override ?? (loading ? "loading" : error ? "error" : visible.length === 0 ? "empty" : "normal");

  return { search, setSearch, visible, narrowed: visible.length !== items.length, state };
}

export function SearchField({
  id,
  label = "Search",
  placeholder,
  value,
  onChange,
  children,
}: {
  id: string;
  label?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Further filters, rendered inside the same form so Enter dismisses the keyboard once. */
  children?: React.ReactNode;
}) {
  return (
    <form
      role="search"
      className="mb-4 flex flex-wrap items-end gap-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="min-w-60 flex-1 sm:max-w-sm sm:flex-none sm:basis-80">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {children}
    </form>
  );
}

/** Said once, the same way, wherever the browser did the narrowing rather than the API. */
export function NarrowedNote({
  shown,
  total,
  noun,
  className,
}: {
  shown: number;
  total: number;
  noun: string;
  className?: string;
}) {
  return (
    <CorpusNote className={className}>
      the corpus captured this list once, unfiltered, so the search above narrows the recorded
      rows in the browser rather than asking the API. {shown} of {total} {noun} match.
    </CorpusNote>
  );
}
