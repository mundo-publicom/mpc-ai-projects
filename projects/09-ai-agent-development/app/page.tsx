"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentEditor } from "@/components/AgentEditor";
import { RunTrace } from "@/components/RunTrace";
import type { AgentDef, AgentDraft, Run } from "@/lib/types";

const DEFAULT_DRAFT: AgentDraft = {
  name: "Research Assistant",
  description: "Searches the web and does arithmetic to answer factual questions.",
  systemPrompt:
    "You are a precise research assistant. Use the web_search tool to gather sources and the calculator tool for any arithmetic. Always cite the source URL you relied on, and never fabricate facts you did not retrieve.",
  model: "smart",
  temperature: 0.3,
  toolIds: ["web_search", "calculator"],
  maxSteps: 6,
  memory: { enabled: true, strategy: "buffer", maxMessages: 20 },
};

function draftFromAgent(a: AgentDef): AgentDraft {
  return {
    name: a.name,
    description: a.description,
    systemPrompt: a.systemPrompt,
    model: a.model,
    temperature: a.temperature,
    toolIds: a.toolIds,
    maxSteps: a.maxSteps,
    memory: a.memory,
  };
}

export default function BuilderPage() {
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgentDraft>(DEFAULT_DRAFT);

  const [input, setInput] = useState("What is (128 * 4) + 17, and where are the AI SDK tool docs?");
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = (await res.json()) as { agents: AgentDef[] };
      setAgents(data.agents);
    } catch {
      /* non-fatal in the demo */
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const patch = (p: Partial<AgentDraft>) => setDraft((d) => ({ ...d, ...p }));

  const selectAgent = (a: AgentDef) => {
    setSelectedId(a.id);
    setDraft(draftFromAgent(a));
    setRun(null);
    setNotice(null);
  };

  const newAgent = () => {
    setSelectedId(null);
    setDraft(DEFAULT_DRAFT);
    setRun(null);
    setNotice(null);
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const res = selectedId
        ? await fetch("/api/agents", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: selectedId, ...draft }),
          })
        : await fetch("/api/agents", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(draft),
          });
      const data = (await res.json()) as { agent?: AgentDef; error?: string };
      if (!res.ok || !data.agent) throw new Error(data.error ?? "Save failed");
      setSelectedId(data.agent.id);
      setNotice(selectedId ? "Agent updated." : "Agent created.");
      await loadAgents();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    await fetch(`/api/agents?id=${encodeURIComponent(selectedId)}`, { method: "DELETE" });
    newAgent();
    await loadAgents();
  };

  const execute = async () => {
    setRunning(true);
    setRunError(null);
    setRun(null);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Run the live draft (saved or not) so edits take effect immediately.
        body: JSON.stringify({ agent: draft, input }),
      });
      const data = (await res.json()) as { run?: Run; error?: string; details?: unknown };
      if (!res.ok || !data.run) throw new Error(data.error ?? "Run failed");
      setRun(data.run);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Agent Forge
            <span className="ml-2 rounded bg-brand-500/15 px-2 py-0.5 align-middle text-xs font-normal text-brand-300">
              build · test · deploy
            </span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Define an agent — system prompt, tools, memory, model — then run it and watch the
            step-by-step tool-calling trace. Ships with a live mock loop so it works with zero keys.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={newAgent}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            + New
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : selectedId ? "Update" : "Save"}
          </button>
          {selectedId && (
            <button
              onClick={remove}
              className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 hover:bg-red-950/50"
            >
              Delete
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Saved agents */}
        <aside className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Saved agents
          </div>
          {agents.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-600">
              No agents yet. Edit the draft and hit Save.
            </div>
          )}
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => selectAgent(a)}
              className={[
                "block w-full rounded-lg border p-3 text-left transition",
                selectedId === a.id
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-slate-800 bg-slate-900 hover:border-slate-700",
              ].join(" ")}
            >
              <div className="truncate text-sm font-medium text-slate-100">{a.name}</div>
              <div className="mt-0.5 truncate text-xs text-slate-500">{a.description}</div>
              <div className="mt-1 flex gap-1 text-[10px] text-slate-500">
                <span className="rounded bg-slate-800 px-1.5 py-0.5">{a.model}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5">{a.toolIds.length} tools</span>
              </div>
            </button>
          ))}
        </aside>

        {/* Editor */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Agent definition</h2>
            {notice && <span className="text-xs text-brand-300">{notice}</span>}
          </div>
          <AgentEditor draft={draft} onChange={patch} />
        </section>

        {/* Run panel */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Run &amp; trace</h2>
          <div className="mb-4 space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-20 w-full resize-y rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="Ask the agent something…"
            />
            <button
              onClick={execute}
              disabled={running || !input.trim()}
              className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {running ? "Running…" : "Run agent"}
            </button>
          </div>
          <RunTrace run={run} loading={running} error={runError} />
        </section>
      </div>

      <footer className="mt-10 border-t border-slate-800 pt-4 text-xs text-slate-600">
        Agent Forge · AI Agent Development Platform · runtime loop via Vercel AI SDK v5 tool-calling,
        routed through the AI Gateway. See <span className="font-mono">docs/</span> for the PRD,
        technical spec, and architecture.
      </footer>
    </main>
  );
}
