"use client";

import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@collega/design-system";
import * as React from "react";

import { assigneeName } from "@/lib/format";
import type { Assignee, Member } from "@/lib/types";

/** A labelled fact in the read view's grid. `dt`/`dd`, so the label is programmatic. */
export function Fact({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    // The span is breakpoint-matched to the grid it sits in: below the threshold the facts grid
    // has one track, and an unconditional col-span-2 would add an implicit second column and
    // overflow the row it is meant to fill.
    <div className={wide ? "min-w-0 @min-[17rem]:col-span-2" : "min-w-0"}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="m-0 mt-0.5 min-w-0 text-sm">{children}</dd>
    </div>
  );
}

/** What a field is when the recording does not carry it. Never an empty string, never a dash. */
export function NotRecorded({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

/** A form row: one label, one control, and the hint or error that belongs to that control. */
export function FormField({
  id,
  label,
  required,
  hint,
  error,
  counter,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  counter?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only">(required)</span> : null}
      </Label>
      {children}
      <div className="mt-1 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {error ? (
            <p id={`${id}-error`} className="m-0 text-xs text-destructive">
              {error}
            </p>
          ) : hint ? (
            <p id={`${id}-hint`} className="m-0 text-xs text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
        {counter ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{counter}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A removable chip. A real `<button>`, so Enter and Space both activate it and neither
 * scrolls the page — the defect Sprint 7.5 found on the Blazor board's chip rows.
 *
 * `apps/web` depends on the design system and nothing else, so the dismiss mark is a glyph
 * rather than an icon package: hidden from assistive technology, with the button's real name
 * in `sr-only` text beside it.
 */
function Chip({ children, onRemove, label }: { children: React.ReactNode; onRemove: () => void; label: string }) {
  return (
    <Badge variant="secondary" className="pr-1">
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-sm px-1 leading-none hover:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span aria-hidden="true">×</span>
        <span className="sr-only">{label}</span>
      </button>
    </Badge>
  );
}

/**
 * Up to ten organization-scoped tags.
 *
 * Comp Q: "Autocomplete starts at two characters; Enter or a comma adds one." Enter adding a
 * tag rather than submitting the form is deliberate and scoped — it only intercepts while the
 * box has text in it, so an empty tag box still lets Enter submit the form like every other
 * field. The suggestion list is a native `datalist`, which is keyboard-reachable and
 * announced without a custom combobox to get wrong.
 */
export function TagPicker({
  id,
  value,
  onChange,
  suggestions,
  max = 10,
}: {
  id: string;
  value: readonly string[];
  onChange: (next: readonly string[]) => void;
  suggestions: readonly string[];
  max?: number;
}) {
  const [draft, setDraft] = React.useState("");
  const full = value.length >= max;

  const add = (raw: string) => {
    const name = raw.trim();
    if (name.length === 0 || full) return;
    // "trimmed, compared case-insensitively" — 20-feature-ideas-and-engagement.md, Tags 6.
    if (value.some((tag) => tag.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, name]);
    setDraft("");
  };

  return (
    <div className="min-w-0">
      <Label htmlFor={id}>
        Tags
        <span className="font-normal text-muted-foreground">
          ({value.length} / {max})
        </span>
      </Label>
      {value.length > 0 ? (
        <ul className="m-0 mb-2 flex list-none flex-wrap gap-1.5 p-0">
          {value.map((tag) => (
            <li key={tag}>
              <Chip label={`Remove tag ${tag}`} onRemove={() => onChange(value.filter((one) => one !== tag))}>
                {tag}
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          id={id}
          list={`${id}-suggestions`}
          value={draft}
          disabled={full}
          maxLength={100}
          placeholder={full ? `${max} tags is the limit` : "Add a tag…"}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            const next = event.target.value;
            if (next.endsWith(",")) add(next.slice(0, -1));
            else setDraft(next);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || draft.trim().length === 0) return;
            event.preventDefault();
            add(draft);
          }}
        />
        <datalist id={`${id}-suggestions`}>
          {suggestions.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        <Button type="button" variant="outline" disabled={full || draft.trim().length === 0} onClick={() => add(draft)}>
          Add
        </Button>
      </div>
      <p id={`${id}-hint`} className="m-0 mt-1 text-xs text-muted-foreground">
        Enter or a comma adds one. Up to {max}, 100 characters each.
      </p>
    </div>
  );
}

/**
 * Zero to five assignees, chosen from the organization's active members.
 *
 * A Select that empties itself on choose, rather than a custom combobox: it is one of the
 * frozen primitives, it is already keyboard- and screen-reader-correct, and the chosen people
 * are chips beside it so the current selection is visible rather than hidden in a popup.
 */
export function AssigneePicker({
  id,
  value,
  onChange,
  members,
  max = 5,
}: {
  id: string;
  value: readonly Assignee[];
  onChange: (next: readonly Assignee[]) => void;
  members: readonly Member[];
  max?: number;
}) {
  const chosen = new Set(value.map((one) => one.userId));
  const available = members.filter((member) => !chosen.has(member.userId));
  const full = value.length >= max;

  return (
    <div className="min-w-0">
      <Label htmlFor={id}>
        Assigned to
        <span className="font-normal text-muted-foreground">
          ({value.length} / {max})
        </span>
      </Label>
      {value.length > 0 ? (
        <ul className="m-0 mb-2 flex list-none flex-wrap gap-1.5 p-0">
          {value.map((assignee) => (
            <li key={assignee.userId}>
              <Chip
                label={`Remove ${assigneeName(assignee)}`}
                onRemove={() => onChange(value.filter((one) => one.userId !== assignee.userId))}
              >
                {assigneeName(assignee)}
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}
      <Select
        // Radix keeps no value once the choice has been folded into a chip, so the trigger has
        // to be told to re-render as its placeholder; a changing key is what does that.
        key={value.length}
        value=""
        disabled={full || available.length === 0}
        onValueChange={(userId) => {
          const member = members.find((one) => one.userId === userId);
          if (!member) return;
          onChange([
            ...value,
            {
              userId: member.userId,
              firstName: member.firstName,
              lastName: member.lastName,
              displayName: null,
              isActive: true,
            },
          ]);
        }}
      >
        <SelectTrigger id={id} aria-describedby={`${id}-hint`}>
          <SelectValue placeholder={full ? `${max} assignees is the limit` : "Add assignee…"} />
        </SelectTrigger>
        <SelectContent>
          {available.map((member) => (
            <SelectItem key={member.userId} value={member.userId}>
              {member.firstName} {member.lastName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id={`${id}-hint`} className="m-0 mt-1 text-xs text-muted-foreground">
        Up to {max} active members of this organization.
      </p>
    </div>
  );
}
