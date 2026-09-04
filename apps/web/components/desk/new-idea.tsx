"use client";

import {
  Button,
  DeniedAction,
  ForRoles,
  Inspector,
  InspectorBody,
  InspectorClose,
  InspectorHeader,
  InspectorTitle,
} from "@collega/design-system";
import Link from "next/link";

import { useWorkspace } from "@/lib/workspace";

/**
 * The primary action, and the two roles that may not take it.
 *
 * `SPEC/20-feature-client-ui.md` (2026-09-02): denied is shown, not hidden. A Site Admin and
 * a read-only account both meet the button and the sentence explaining why it will not work,
 * rather than finding an empty top bar and no account of it. `DeniedAction` is the frozen
 * pattern — `aria-disabled` with `aria-describedby`, never the `disabled` attribute, which
 * would take the control out of the tab order and the explanation with it.
 */
export function NewIdeaAction({ href }: { href: string }) {
  // Nothing until the API has said who is looking. `RoleProvider` has to publish *some*
  // role before then, and whichever one it picks would render a refusal — or an offer — to
  // the wrong person for the length of the round trip. A false "you may not" is worse than
  // a control that arrives a moment late.
  const { me } = useWorkspace();
  if (!me) return null;

  return (
    <>
      <ForRoles roles={["OrgAdmin", "User"]}>
        <Button asChild>
          <Link href={href}>New idea</Link>
        </Button>
      </ForRoles>
      <ForRoles roles={["SiteAdmin"]}>
        <DeniedAction reason="Act as a member of an organization to add ideas">
          {(denied) => (
            <Button {...denied}>New idea</Button>
          )}
        </DeniedAction>
      </ForRoles>
      <ForRoles roles={["ReadOnly"]}>
        <DeniedAction reason="Read-only accounts can’t create ideas">
          {(denied) => (
            <Button {...denied}>New idea</Button>
          )}
        </DeniedAction>
      </ForRoles>
    </>
  );
}

/**
 * Create opens the same docked column detail uses — comp P: *there is no create drawer*. The
 * form itself is the AI-assist and idea-detail slices' work; this holds the column open so
 * the action leads somewhere and the surface is established.
 */
export function CreateIdeaPanel({ boardName, onClose }: { boardName: string; onClose: () => void }) {
  return (
    <Inspector aria-label="New idea">
      <InspectorHeader>
        <div className="min-w-0">
          <InspectorTitle>New idea</InspectorTitle>
        </div>
        <InspectorClose onClick={onClose} />
      </InspectorHeader>
      <InspectorBody>
        <p className="m-0 text-sm leading-relaxed">
          A new idea lands on <strong>{boardName}</strong> in the left-most lane.
        </p>
        <p className="m-0 rounded-lg border border-dashed bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          The capture form — and the brainstorm chat that replaces it where AI assist is
          available — arrives with the idea slices. This column is the surface both open into.
        </p>
      </InspectorBody>
    </Inspector>
  );
}
