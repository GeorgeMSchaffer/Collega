"use client";

import { Button } from "@collega/design-system";
import Link from "next/link";

import { OwnOrgPage } from "@/app/(desk)/settings/_components/pages";
import { RollupScreen } from "@/app/(desk)/settings/_screens/rollup-screen";
import { USERS_ROLLUP } from "@/app/(desk)/settings/_screens/rollup-specs";
import { UsersScreen } from "@/app/(desk)/settings/_screens/users-screen";

export default function UsersSettingsPage() {
  return (
    <OwnOrgPage
      crumbLabel="Users"
      subject="users"
      title="Users"
      standfirst="Who can sign in, and what each of them may do."
      siteAdminTitle="All users"
      siteAdminStandfirst="Every account across every organization. Open a person for their detail and password reset."
      actions={({ role }) =>
        role === "OrgAdmin" ? (
          <Button variant="outline" asChild>
            <Link href="/settings/users/import">Import CSV</Link>
          </Button>
        ) : null
      }
      orgAdmin={(props) => <UsersScreen {...props} basePath="/settings/users" />}
      siteAdmin={(props) => <RollupScreen spec={USERS_ROLLUP} override={props.override} />}
    />
  );
}
