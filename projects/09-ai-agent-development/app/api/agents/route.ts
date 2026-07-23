import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  updateAgent,
} from "@/lib/store";
import { VALID_TOOL_IDS } from "@/lib/tools";
import type { AgentDef, ApiError } from "@/lib/types";

// Node.js runtime (Fluid Compute on Vercel).
export const runtime = "nodejs";

const memorySchema = z.object({
  enabled: z.boolean().default(true),
  strategy: z.enum(["buffer", "none"]).default("buffer"),
  maxMessages: z.number().int().min(0).max(200).default(20),
});

const draftSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(""),
  systemPrompt: z.string().min(1).max(20000),
  model: z.enum(["fast", "smart", "frontier"]).default("smart"),
  temperature: z.number().min(0).max(1).default(0.4),
  toolIds: z
    .array(z.enum(VALID_TOOL_IDS as [string, ...string[]]))
    .max(VALID_TOOL_IDS.length)
    .default([]),
  maxSteps: z.number().int().min(1).max(25).default(6),
  memory: memorySchema.default({ enabled: true, strategy: "buffer", maxMessages: 20 }),
});

const updateSchema = draftSchema.partial().extend({ id: z.string().min(1) });

function bad(error: string, status: number, details?: unknown): NextResponse<ApiError> {
  return NextResponse.json({ error, details }, { status });
}

/** GET /api/agents — list all agent definitions for the (demo) org. */
export async function GET(): Promise<NextResponse<{ agents: AgentDef[] } | ApiError>> {
  return NextResponse.json({ agents: listAgents() });
}

/** POST /api/agents — create an agent definition. */
export async function POST(req: Request): Promise<NextResponse<{ agent: AgentDef } | ApiError>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return bad("Invalid JSON body", 400);
  }
  const parsed = draftSchema.safeParse(json);
  if (!parsed.success) return bad("Validation failed", 422, parsed.error.flatten());
  const agent = createAgent(parsed.data);
  return NextResponse.json({ agent }, { status: 201 });
}

/** PUT /api/agents — update an existing agent by id (partial). */
export async function PUT(req: Request): Promise<NextResponse<{ agent: AgentDef } | ApiError>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return bad("Invalid JSON body", 400);
  }
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) return bad("Validation failed", 422, parsed.error.flatten());
  const { id, ...patch } = parsed.data;
  const agent = updateAgent(id, patch);
  if (!agent) return bad("Agent not found", 404);
  return NextResponse.json({ agent });
}

/** DELETE /api/agents?id=… — delete an agent definition. */
export async function DELETE(req: Request): Promise<NextResponse<{ deleted: string } | ApiError>> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("Missing ?id", 400);
  if (!getAgent(id)) return bad("Agent not found", 404);
  deleteAgent(id);
  return NextResponse.json({ deleted: id });
}
