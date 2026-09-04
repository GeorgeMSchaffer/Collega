"use client";

import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@collega/design-system";

import { USE_MOCK_API } from "@/mocks";

/**
 * The reviewer band on an auth screen — the counterpart of `MockBar` on the desk, and the
 * same voice: outside the app frame, addressed to whoever is driving the build.
 *
 * The desk band offers an identity because every desk request carries one. An auth screen
 * offers a *recorded case* instead, because the thing that decides its answer is not who is
 * asking but which of several recordings at one endpoint is replayed — and the mock cannot
 * choose for itself. Every password in the corpus is redacted, so nothing downstream can tell
 * the recorded 200 from the recorded 401 by looking at the request. Deciding it here, in the
 * open, is the alternative to the client quietly deciding an authentication outcome.
 *
 * With `NEXT_PUBLIC_USE_MOCK_API=0` there is no recording to choose and the band disappears.
 */

export interface RecordedOption {
  readonly value: string;
  readonly label: string;
}

export function RecordedCaseBand({
  id,
  options,
  value,
  onChange,
  children,
}: {
  /** Distinct per screen so the label binds when two bands ever share a page. */
  id: string;
  options: readonly RecordedOption[];
  value: string;
  onChange: (value: string) => void;
  /** One sentence naming what the chosen recording is. */
  children: React.ReactNode;
}) {
  if (!USE_MOCK_API) return null;

  return (
    <div
      data-testid="recorded-case-band"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-secondary px-4 py-1.5 text-xs text-secondary-foreground"
    >
      <span className="font-medium">Golden corpus · not the product</span>
      <span className="flex items-center gap-2">
        <Label htmlFor={id} className="mb-0 text-xs font-medium">
          Recorded outcome
        </Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} size="sm" className="h-7 w-72 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
      <span className="min-w-0">{children}</span>
      <a className="ml-auto text-xs" href="/api/mock/report">
        Mock report
      </a>
    </div>
  );
}
