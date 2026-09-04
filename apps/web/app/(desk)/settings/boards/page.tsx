"use client";

/**
 * `/settings/boards`.
 *
 * The one own-organization settings route with **no Site Admin story**: board administration
 * is scoped to one organization and a Site Admin belongs to none, so there is nothing here
 * for them to list. Comp P proposes replacing the Blazor original's *"Your account isn't
 * associated with an organization"* — accurate, but it reads as a fault rather than a scoping
 * rule — with the panel below, which says what the rule is and offers both onward routes.
 */

import { Button, Empty, EmptyDescription, EmptyTitle } from "@collega/design-system";
import Link from "next/link";

import { OwnOrgPage } from "@/app/(desk)/settings/_components/pages";
import { BoardsScreen } from "@/app/(desk)/settings/_screens/boards-screen";

export default function BoardsSettingsPage() {
  return (
    <OwnOrgPage
      crumbLabel="Boards"
      subject="boards"
      title="Boards"
      standfirst="The boards your organization tracks ideas on. Each one picks its own swimlanes from the shared set of statuses."
      siteAdminStandfirst="There is no cross-organization board view."
      actions={({ role }) =>
        role === "OrgAdmin" ? (
          <Button asChild>
            <Link href="/settings/boards/new">New board</Link>
          </Button>
        ) : null
      }
      orgAdmin={(props) => <BoardsScreen {...props} basePath="/settings/boards" />}
      siteAdmin={() => (
        <Empty data-testid="settings-boards-no-site-admin-story">
          <EmptyTitle>This route has no Site Admin story</EmptyTitle>
          <EmptyDescription>
            Board administration is scoped to one organization, and a Site Admin belongs to
            none, so this route has no organization to list. The Settings hub sends a Site
            Admin to the workspace boards list rather than here.
          </EmptyDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/boards">Go to the boards list</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/settings/organizations">Pick an organization</Link>
            </Button>
          </div>
        </Empty>
      )}
    />
  );
}
