"use client";

import { OwnOrgPage, type ScreenProps } from "@/app/(desk)/settings/_components/pages";
import { AiAssistScreen } from "@/app/(desk)/settings/_screens/ai-screens";

/**
 * A scope statement is organization content, so a Site Admin reads it and cannot save it —
 * `PUT /organizations/{id}/ai-assist/settings` is a recorded 403 at that identity. The screen
 * is the same either way; only the Save control changes, which is rule 25 on a surface that
 * is not a table.
 */
function screen(props: ScreenProps) {
  return <AiAssistScreen {...props} />;
}

export default function AiAssistPage() {
  return (
    <OwnOrgPage
      crumbLabel="AI Assist"
      subject="the assistant settings"
      title="AI Assist"
      standfirst="Tell the assistant what your organization wants ideas about, so it can stay on subject."
      siteAdminStandfirst="Read an organization’s assistant scope. Act as one of its members to change it."
      orgAdmin={screen}
      siteAdmin={screen}
    />
  );
}
