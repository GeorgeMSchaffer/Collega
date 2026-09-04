import { redirect } from "next/navigation";

/** Compatibility redirect, `SPEC/20-feature-client-ui.md`: `/workflows` → `/boards`. */
export default function WorkflowsPage(): never {
  redirect("/boards");
}
