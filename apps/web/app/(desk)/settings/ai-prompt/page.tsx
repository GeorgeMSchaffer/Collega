"use client";

import { Badge } from "@collega/design-system";

import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { useWorkspace } from "@/lib/workspace";

import { SettingsGuard } from "@/app/(desk)/settings/_components/chrome";
import { AiPromptScreen } from "@/app/(desk)/settings/_screens/ai-screens";

export default function AiPromptPage() {
  const { me, stateOverride } = useWorkspace();

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Settings", href: "/settings" }, { label: "AI Prompt" }]}>
        {me?.role === "SiteAdmin" ? <Badge variant="warning">Affects every organization</Badge> : null}
      </DeskTopBar>
      <DeskWork>
        <SettingsGuard role={me?.role} audience="site-admin" subject="the assistant instructions">
          <PageHeader title="AI Prompt">
            The instructions every organization’s assistant runs under, with safety probes and
            version history.
          </PageHeader>
          <AiPromptScreen override={stateOverride} />
        </SettingsGuard>
      </DeskWork>
    </>
  );
}
