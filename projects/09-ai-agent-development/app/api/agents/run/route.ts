import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/lib/runtime";
import { getAgent, saveRun, DEMO_ORG_ID } from "@/lib/store";
import { hasAI } from "@/lib/ai";
import { VALID_TOOL_IDS } from "@/lib/tools";
import type { AgentDef, ApiError, Run } from "@/lib/types";

// Node.js runtime (Fluid Compute on Vercel) — the agent loop + tool execution
// need full Node APIs and longer wall-clock budgets than the edge allows.
export const runtime = "nodejs";
export const maxDuration = 60;

const memorySchema = z.object({
  enabled: z.boolean().default(true),
  strategy: z.enum(["buffer", "none"]).default("buffer"),
  maxMessages: z.number().int().min(0).max(200).default(20),
});

const inlineAgentSchema = z.object({
  name: z.string().min(1).max(80).default("Untitled Agent"),
  description: z.string().max(500).default(""),
  systemPrompt: z.string().min(1).max(20000),
  model: z.enum(["fast", "smart", "frontier"]).default("smart"),
  temperature: z.number().min(0).max(1).default(0.4),
  toolIds: z.array(z.enum(VALID_TOOL_IDS as [string, ...string[]])).default([]),
  maxSteps: z.number().int().min(1).max(25).default(6),
  memory: memorySchema.default({ enabled: true, strategy: "buffer", maxMessages: 20 }),
});

const historySchema = z
  .array(
    z.object({
      role: z.enum(["system", "user", "assistant", "tool"]),
      content: z.string(),
      ts: z.string().optional(),
    }),
  )
  .max(200)
  .default([]);

const bodySchema = z
  .object({
    agentId: z.string().min(1).optional(),
    agent: inlineAgentSchema.optional(),
    input: z.string().min(1).max(8000),
    history: historySchema,
  })
  .refine((b) => b.agentId || b.agent, {
    message: "Provide either agentId (saved agent) or agent (inline draft).",
  });

/**
 * POST /api/agents/run
 *
 * Core value path: execute an agent and return the full Run — ordered steps,
 * the trace timeline, token usage, and the final answer. Accepts either a saved
 * agentId or an inline draft (so the builder can run unsaved edits). Falls back
 * to a deterministic mock loop when no model key is configured.
 */
export async function POST(
  req: Request,
): Promise<NextResponse<{ run: Run; hasAI: boolean } | ApiError>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { agentId, agent: inline, input, history } = parsed.data;

  // Resolve the agent definition: saved > inline.
  let agent: AgentDef | undefined;
  if (agentId) {
    agent = getAgent(agentId);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  } else if (inline) {
    const now = new Date().toISOString();
    agent = {
      id: "agent_inline",
      orgId: DEMO_ORG_ID,
      ...inline,
      createdAt: now,
      updatedAt: now,
    };
  }
  if (!agent) return NextResponse.json({ error: "No agent resolved" }, { status: 400 });

  try {
    const run = await runAgent(agent, input, history);
    saveRun(run);
    return NextResponse.json({ run, hasAI: hasAI() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Run failed" },
      { status: 500 },
    );
  }
}
