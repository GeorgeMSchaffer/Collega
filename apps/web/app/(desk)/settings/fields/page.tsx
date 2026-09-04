"use client";

import { OwnOrgPage } from "@/app/(desk)/settings/_components/pages";
import { FieldsScreen } from "@/app/(desk)/settings/_screens/fields-screen";
import { RollupScreen } from "@/app/(desk)/settings/_screens/rollup-screen";
import { FIELDS_ROLLUP } from "@/app/(desk)/settings/_screens/rollup-specs";

export default function FieldsSettingsPage() {
  return (
    <OwnOrgPage
      crumbLabel="Fields"
      subject="fields"
      title="Fields"
      standfirst="The organization’s catalogue of custom fields. Defining one here makes it available to idea types; nothing appears on an idea until a type picks it up."
      siteAdminTitle="All fields"
      siteAdminStandfirst="User-defined fields across every organization. Open an organization to change its fields."
      orgAdmin={(props) => <FieldsScreen {...props} />}
      siteAdmin={(props) => <RollupScreen spec={FIELDS_ROLLUP} override={props.override} />}
    />
  );
}
