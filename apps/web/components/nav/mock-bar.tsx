"use client";

import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from "@collega/design-system";

import { MOCK_IDENTITIES, USE_MOCK_API, useMockIdentity, type MockIdentity } from "@/mocks";
import { useWorkspace } from "@/lib/workspace";

/**
 * The reviewer band: identity and screen state, above the app frame rather than inside it.
 *
 * `SPEC/decisions.md` 2026-08-31 keeps the two copy voices apart — product copy inside the
 * frame, anything addressed to whoever is driving the build outside it — and comp Q puts
 * exactly these two controls in exactly this place for exactly that reason.
 *
 * Switching identity is the point of the increment: every request below carries it, and the
 * corpus answers 228 refusals to 206 successes, so a role that cannot do something is
 * *shown* being refused rather than described. The band is rendered only while the mock is
 * what is behind the app; with `NEXT_PUBLIC_USE_MOCK_API=0` there is nothing here to choose.
 */

const STATES = ["normal", "empty", "loading", "error"] as const;

export function MockBar() {
  const { identity, setIdentity } = useMockIdentity();
  const { stateOverride, setStateOverride } = useWorkspace();

  if (!USE_MOCK_API) return null;

  return (
    <div
      data-testid="mock-bar"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-secondary px-4 py-1.5 text-xs text-secondary-foreground"
    >
      <span className="font-medium">Golden corpus · not the product</span>

      <span className="flex items-center gap-2">
        <Label htmlFor="mock-identity" className="mb-0 text-xs font-medium">
          Viewing as
        </Label>
        <Select value={identity} onValueChange={(value) => setIdentity(value as MockIdentity)}>
          <SelectTrigger id="mock-identity" size="sm" className="h-7 w-40 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MOCK_IDENTITIES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>

      <span className="flex items-center gap-2">
        <span id="mock-state-label" className="font-medium">
          State
        </span>
        <ToggleGroup
          type="single"
          aria-labelledby="mock-state-label"
          value={stateOverride ?? "normal"}
          onValueChange={(value) =>
            setStateOverride(value === "" || value === "normal" ? null : (value as "empty" | "loading" | "error"))
          }
        >
          {STATES.map((state) => (
            <ToggleGroupItem key={state} value={state} className="h-7 px-2 text-xs">
              {state}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </span>

      <a className="ml-auto text-xs" href="/api/mock/report">
        Mock report
      </a>
    </div>
  );
}
