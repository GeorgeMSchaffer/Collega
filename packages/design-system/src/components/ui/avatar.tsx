"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as React from "react";

import { cn } from "../../lib/utils";

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("flex size-full items-center justify-center", className)}
      {...props}
    />
  );
}

/**
 * Overlapping avatars. `role="group"` with a label, because the stack means "these people"
 * and a pile of initials does not say that on its own.
 */
function AvatarStack({
  className,
  ...props
}: React.ComponentProps<"div"> & { "aria-label": string }) {
  return (
    <div
      data-slot="avatar-stack"
      role="group"
      className={cn(
        "flex [&>[data-slot=avatar]]:ring-2 [&>[data-slot=avatar]]:ring-background [&>[data-slot=avatar]+[data-slot=avatar]]:-ml-1",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage, AvatarStack };
