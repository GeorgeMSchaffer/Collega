"use client";

import { OwnOrgPage } from "@/app/(desk)/settings/_components/pages";
import { IdeaTypesScreen } from "@/app/(desk)/settings/_screens/idea-types-screen";
import { RollupScreen } from "@/app/(desk)/settings/_screens/rollup-screen";
import { IDEA_TYPES_ROLLUP } from "@/app/(desk)/settings/_screens/rollup-specs";

export default function IdeaTypesSettingsPage() {
  return (
    <OwnOrgPage
      crumbLabel="Idea types"
      subject="idea types"
      title="Idea types"
      standfirst="Every idea is exactly one type, chosen at creation. A type carries its own selection of the organization’s fields, so an idea shows only the fields that matter to it."
      siteAdminTitle="All idea types"
      siteAdminStandfirst="Idea types across every organization. Open an organization to change its types."
      orgAdmin={(props) => <IdeaTypesScreen {...props} />}
      siteAdmin={(props) => <RollupScreen spec={IDEA_TYPES_ROLLUP} override={props.override} />}
    />
  );
}
