"use client";

import { OwnOrgPage } from "@/app/(desk)/settings/_components/pages";
import { RollupScreen } from "@/app/(desk)/settings/_screens/rollup-screen";
import { STATUSES_ROLLUP } from "@/app/(desk)/settings/_screens/rollup-specs";
import { StatusesScreen } from "@/app/(desk)/settings/_screens/statuses-screen";

export default function StatusesSettingsPage() {
  return (
    <OwnOrgPage
      crumbLabel="Statuses"
      subject="statuses"
      title="Statuses"
      standfirst="The columns your boards group ideas by. Order here is the order on every board."
      siteAdminTitle="All statuses"
      siteAdminStandfirst="Workflow statuses across every organization. Open an organization to change its statuses."
      orgAdmin={(props) => <StatusesScreen {...props} />}
      siteAdmin={(props) => <RollupScreen spec={STATUSES_ROLLUP} override={props.override} />}
    />
  );
}
