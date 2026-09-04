"use client";

import { Button, Empty, EmptyDescription, EmptyTitle } from "@collega/design-system";
import Link from "next/link";

import { OwnOrgPage, type ScreenProps } from "@/app/(desk)/settings/_components/pages";
import { ImportScreen } from "@/app/(desk)/settings/_screens/import-screen";

const USERS = [{ label: "Users", href: "/settings/users" }];

/**
 * Import is user administration, so it is the bootstrap exception — a Site Admin may run it,
 * against any organization. What they cannot do is run it *here*: this route imports into the
 * viewer's own organization and a Site Admin has none, so it sends them to pick one rather
 * than offering a file chooser with nowhere to put the rows.
 */
export default function ImportUsersPage() {
  return (
    <OwnOrgPage
      crumbLabel="Import"
      extraCrumbs={USERS}
      subject="the user import"
      orgAdmin={(props: ScreenProps) => <ImportScreen {...props} title="Import users" />}
      siteAdmin={() => (
        <Empty>
          <EmptyTitle>Import needs an organization</EmptyTitle>
          <EmptyDescription>
            A Site Admin may import users into any organization — that is the bootstrap
            exception — but this route imports into your own, and you belong to none. Open the
            organization you mean and import from there.
          </EmptyDescription>
          <div className="mt-4">
            <Button variant="outline" asChild>
              <Link href="/settings/organizations">Pick an organization</Link>
            </Button>
          </div>
        </Empty>
      )}
    />
  );
}
