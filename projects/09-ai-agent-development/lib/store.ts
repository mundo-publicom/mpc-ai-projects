/**
 * In-memory persistence for agent definitions and runs.
 *
 * This is a stand-in for the Postgres-backed registry described in
 * docs/TECHNICAL_SPEC.md. It lives at module scope so it survives across
 * requests within a single server process (dev + Fluid Compute warm instances).
 * Data is NOT durable across cold starts — swap for a real DB in production.
 *
 * Everything is scoped by orgId to model multi-tenancy; the demo uses a single
 * fixed org so the dashboard has data to show on first load.
 */
import type { AgentDef, AgentDraft, Run } from "./types";

export const DEMO_ORG_ID = "org_demo";

const agents = new Map<string, AgentDef>();
const runs = new Map<string, Run>();

let idSeq = 0;
function newAgentId(): string {
  idSeq += 1;
  return `agent_${Date.now().toString(36)}_${idSeq}`;
}

function seed(): void {
  if (agents.size > 0) return;
  const now = new Date("2026-07-23T00:00:00.000Z").toISOString();
  const research: AgentDef = {
    id: "agent_demo_research",
    orgId: DEMO_ORG_ID,
    name: "Research Assistant",
    description: "Searches the web and does arithmetic to answer factual questions.",
    systemPrompt:
      "You are a precise research assistant. Use the web_search tool to gather sources and the calculator tool for any arithmetic. Always cite the source URL you relied on, and never fabricate facts you did not retrieve.",
    model: "smart",
    temperature: 0.3,
    toolIds: ["web_search", "calculator"],
    maxSteps: 6,
    memory: { enabled: true, strategy: "buffer", maxMessages: 20 },
    createdAt: now,
    updatedAt: now,
  };
  agents.set(research.id, research);
}
seed();

/* ------------------------------------------------------------------ */
/* Agents                                                              */
/* ------------------------------------------------------------------ */

export function listAgents(orgId: string = DEMO_ORG_ID): AgentDef[] {
  return [...agents.values()]
    .filter((a) => a.orgId === orgId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getAgent(id: string, orgId: string = DEMO_ORG_ID): AgentDef | undefined {
  const a = agents.get(id);
  return a && a.orgId === orgId ? a : undefined;
}

export function createAgent(draft: AgentDraft, orgId: string = DEMO_ORG_ID): AgentDef {
  const now = new Date().toISOString();
  const agent: AgentDef = {
    id: newAgentId(),
    orgId,
    ...draft,
    createdAt: now,
    updatedAt: now,
  };
  agents.set(agent.id, agent);
  return agent;
}

export function updateAgent(
  id: string,
  patch: Partial<AgentDraft>,
  orgId: string = DEMO_ORG_ID,
): AgentDef | undefined {
  const existing = getAgent(id, orgId);
  if (!existing) return undefined;
  const updated: AgentDef = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  agents.set(id, updated);
  return updated;
}

export function deleteAgent(id: string, orgId: string = DEMO_ORG_ID): boolean {
  const existing = getAgent(id, orgId);
  if (!existing) return false;
  return agents.delete(id);
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export function saveRun(run: Run): void {
  runs.set(run.id, run);
}

export function listRuns(orgId: string = DEMO_ORG_ID, agentId?: string): Run[] {
  return [...runs.values()]
    .filter((r) => r.orgId === orgId && (!agentId || r.agentId === agentId))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
