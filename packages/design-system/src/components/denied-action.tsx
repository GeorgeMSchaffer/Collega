"use client";

import * as React from "react";

import { cn } from "../lib/utils";

/**
 * An action the viewer is not allowed to take, shown with its reason.
 *
 * `aria-disabled`, never the `disabled` attribute. A disabled control leaves the tab order,
 * so a keyboard or screen-reader user meets neither the button nor the explanation for why
 * it will not work — which is the one thing they needed. The reason is a real element the
 * button points at with `aria-describedby`, so it is read out on focus rather than being
 * hover-only, and the refusal never rests on the dimmed colour alone.
 *
 * Because `aria-disabled` is advisory, this wrapper also has to enforce it: it dims the
 * control and swallows activation in the capture phase, for the pointer and for Enter and
 * Space. Without that the forbidden action still fires. The dimming is scoped here rather
 * than applied to every `[aria-disabled]` on the page, because that attribute is also how a
 * breadcrumb marks the current page — which must not look disabled.
 *
 * This is the frozen pattern from SPEC/mockups/_build/README.md; screens use it rather than
 * writing their own.
 */
function DeniedAction({
  reason,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  reason: React.ReactNode;
  children: (props: {
    "aria-disabled": true;
    "aria-describedby": string;
  }) => React.ReactNode;
}) {
  const reasonId = React.useId();

  const swallow = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <span
      data-slot="denied-action"
      className={cn(
        "inline-flex items-center gap-2",
        "[&_[aria-disabled=true]]:cursor-not-allowed [&_[aria-disabled=true]]:opacity-50",
        className,
      )}
      onClickCapture={swallow}
      onKeyDownCapture={(event) => {
        if (event.key === "Enter" || event.key === " ") swallow(event);
      }}
      {...props}
    >
      {children({ "aria-disabled": true, "aria-describedby": reasonId })}
      <span id={reasonId} className="text-xs italic text-muted-foreground">
        {reason}
      </span>
    </span>
  );
}

export { DeniedAction };
