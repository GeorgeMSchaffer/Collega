"use client";

/**
 * The one organization-scoped screen a Site Admin can change — rule 26, the bootstrap
 * exception. The read-only banner Statuses · org carries is absent here on purpose: a
 * reviewer arriving from that screen will expect one, and its absence is the product rule
 * rather than a missed screen.
 */

import { Button } from "@collega/design-system";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ScopedOrgPage } from "@/app/(desk)/settings/_components/pages";
import { UsersScreen } from "@/app/(desk)/settings/_screens/users-screen";

export default function ScopedUsersPage() {
  const params = useParams<{ orgId: string }>();
  const basePath = `/settings/organizations/${params.orgId}/users`;

  return (
    <ScopedOrgPage
      organizationId={params.orgId}
      crumbLabel="Users"
      subject="users"
      title="Users"
      standfirst={(name) =>
        `${name} · who can sign in to this organization, and what each of them may do.`
      }
      rollup={{ href: "/settings/users", label: "All users" }}
      actions={() => (
        <Button variant="outline" asChild>
          <Link href={`${basePath}/import`}>Import CSV</Link>
        </Button>
      )}
    >
      {(props) => <UsersScreen {...props} basePath={basePath} />}
    </ScopedOrgPage>
  );
}
