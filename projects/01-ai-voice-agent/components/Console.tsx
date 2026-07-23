"use client";

import { useState } from "react";
import { AgentConfigForm, DEFAULT_AGENT, type AgentDraft } from "./AgentConfigForm";
import { CallSimulator } from "./CallSimulator";

/**
 * Client island that holds the shared agent draft so edits in the config form
 * immediately drive the call simulator. Keying the simulator on the goal
 * resets an in-flight simulation when the objective changes.
 */
export function Console() {
  const [agent, setAgent] = useState<AgentDraft>(DEFAULT_AGENT);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="mb-4 text-lg font-semibold">Agent configuration</h2>
        <AgentConfigForm value={agent} onChange={setAgent} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="mb-4 text-lg font-semibold">Test drive</h2>
        <CallSimulator key={agent.goal} agent={agent} />
      </section>
    </div>
  );
}
