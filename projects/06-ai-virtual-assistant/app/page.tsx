import { getDashboardData } from "@/lib/mock-data";
import { AssistantWorkspace } from "@/components/AssistantWorkspace";

/**
 * The assistant dashboard. A Server Component loads today's world (tasks,
 * calendar, inbox) from the store and hands it to the interactive workspace,
 * which owns the command bar, the unified view, and the action-plan / approval
 * panel.
 */
export default function Page() {
  const data = getDashboardData();
  return <AssistantWorkspace data={data} />;
}
