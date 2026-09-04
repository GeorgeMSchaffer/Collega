"use client";

import { Badge } from "@collega/design-system";

import { OwnOrgPage, type ScreenProps } from "@/app/(desk)/settings/_components/pages";
import { UsageScreen } from "@/app/(desk)/settings/_screens/ai-screens";

function screen(props: ScreenProps) {
  return <UsageScreen {...props} />;
}

export default function ApiUsagePage() {
  return (
    <OwnOrgPage
      crumbLabel="API"
      subject="API usage"
      title="API usage"
      standfirst="Your organization’s AI assist token consumption and estimated cost for today."
      siteAdminStandfirst="AI assist token consumption and estimated cost for today, by organization, against the daily limit."
      actions={() => <Badge variant="outline">Read-only</Badge>}
      orgAdmin={screen}
      siteAdmin={screen}
    />
  );
}
