import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateObject,
  hasAI,
  MODELS,
  buildSystemPrompt,
  renderTranscript,
  turnSchema,
  mockTurn,
} from "@/lib/ai";
import type { ConverseResponse } from "@/lib/types";

// Node.js runtime (Fluid Compute on Vercel) — avoids edge-only limitations.
export const runtime = "nodejs";

const goalEnum = z.enum([
  "book_appointment",
  "qualify_lead",
  "tier1_support",
  "outbound_reminder",
]);

const bodySchema = z.object({
  agent: z.object({
    name: z.string().min(1).max(80),
    goal: goalEnum,
    persona: z.string().min(1).max(4000),
    script: z.string().max(20000).default(""),
    temperature: z.number().min(0).max(1).default(0.4),
    maxTurns: z.number().int().min(1).max(50).default(20),
  }),
  transcript: z
    .array(
      z.object({
        role: z.enum(["agent", "caller"]),
        text: z.string().min(1),
      }),
    )
    .max(200)
    .default([]),
  utterance: z.string().min(1).max(2000),
});

/**
 * POST /api/agent/converse
 *
 * Core value path: given the conversation so far plus the caller's newest
 * utterance, produce the agent's next spoken turn. Uses generateObject so we
 * get a typed { reply, done, outcome } back in a single call. Falls back to
 * deterministic mock replies when no API key is configured.
 */
export async function POST(req: Request): Promise<NextResponse<ConverseResponse | { error: string; details?: unknown }>> {
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

  const { agent, transcript, utterance } = parsed.data;
  const turnCount = transcript.filter((t) => t.role === "agent").length;

  // --- Mock fallback: fully functional demo without any keys. ---
  if (!hasAI()) {
    const turn = mockTurn({ goal: agent.goal, utterance, turnCount });
    const res: ConverseResponse = {
      reply: turn.reply,
      done: turn.done || turnCount + 1 >= agent.maxTurns,
      outcome: turn.outcome,
      mocked: true,
      latencyMs: 0,
    };
    return NextResponse.json(res);
  }

  // --- Real model call through the AI Gateway. ---
  const system = buildSystemPrompt({
    name: agent.name,
    goal: agent.goal,
    persona: agent.persona,
    script: agent.script,
    maxTurns: agent.maxTurns,
  });

  const prompt = [
    `Conversation so far:`,
    renderTranscript(transcript),
    ``,
    `Caller just said: "${utterance}"`,
    ``,
    `Produce your next spoken turn.`,
  ].join("\n");

  const started = Date.now();
  try {
    const { object } = await generateObject({
      // Sonnet keeps per-turn latency inside the voice budget; escalate to
      // frontier only for complex support flows if needed.
      model: MODELS.smart,
      schema: turnSchema,
      system,
      prompt,
      temperature: agent.temperature,
    });

    const res: ConverseResponse = {
      reply: object.reply,
      done: object.done || turnCount + 1 >= agent.maxTurns,
      outcome: object.outcome,
      mocked: false,
      latencyMs: Date.now() - started,
    };
    return NextResponse.json(res);
  } catch (err) {
    // Never drop a live call — degrade to a safe mock turn on model error.
    const turn = mockTurn({ goal: agent.goal, utterance, turnCount });
    const res: ConverseResponse = {
      reply: turn.reply,
      done: turn.done,
      outcome: turn.outcome,
      mocked: true,
      latencyMs: Date.now() - started,
    };
    return NextResponse.json(res, {
      status: 200,
      headers: { "x-fallback-reason": err instanceof Error ? err.name : "unknown" },
    });
  }
}
