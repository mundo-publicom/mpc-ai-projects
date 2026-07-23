/**
 * POST /api/assistant — the assistant's brain.
 *
 * Two modes, selected by the request body:
 *
 *   PLAN   (no `approvals`): takes a natural-language command, runs the AI SDK
 *          tool-calling loop (generateText + tools + stopWhen), and returns an
 *          ActionPlan. Read steps have already executed; write steps come back
 *          `awaiting_approval`.
 *
 *   COMMIT (`approvals` present): takes approval decisions for a plan returned
 *          earlier and executes (or rejects) the gated write steps for real.
 *
 * When no AI key is configured (`!hasAI()`), PLAN falls back to a deterministic
 * mock planner so the demo runs end-to-end with zero keys.
 */

import { NextResponse } from "next/server";
import { generateText, stepCountIs, type ToolSet } from "ai";
import { z } from "zod";
import {
  hasAI,
  PLANNER_MODEL,
  PLANNER_SYSTEM_PROMPT,
} from "@/lib/ai";
import { assistantTools, commitToolCall, TOOL_META } from "@/lib/tools";
import { store, DEMO_USER } from "@/lib/mock-data";
import type {
  ActionPlan,
  AssistantResponse,
  ToolCall,
  ToolName,
} from "@/lib/types";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/* Input validation                                                    */
/* ------------------------------------------------------------------ */

const RequestSchema = z.object({
  command: z.string().min(1, "command is required").max(2000),
  planId: z.string().optional(),
  approvals: z
    .array(z.object({ toolCallId: z.string(), approved: z.boolean() }))
    .optional(),
});

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

/** Whether a write step should be auto-executed given the user's autonomy. */
function requiresApproval(toolName: ToolName): boolean {
  const meta = TOOL_META[toolName];
  if (meta.effect === "read") return false;
  const autonomy = DEMO_USER.preferences.autonomy;
  if (autonomy === "autopilot") {
    // Low-risk writes run automatically; irreversible sends still gate.
    return toolName === "send_email" || toolName === "send_slack";
  }
  return meta.requiresApproval; // "suggest" and "approve_writes" both gate writes
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { command, planId, approvals } = parsed.data;

  // ---- COMMIT MODE ------------------------------------------------
  if (approvals && approvals.length > 0) {
    const plan = planId ? store.getPlan(planId) : undefined;
    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found or expired. Re-issue the command." },
        { status: 404 },
      );
    }
    const started = Date.now();
    const decisions = new Map(approvals.map((a) => [a.toolCallId, a.approved]));

    for (const step of plan.steps) {
      if (step.status !== "awaiting_approval") continue;
      const approved = decisions.get(step.id);
      if (approved === undefined) continue;
      if (!approved) {
        step.status = "rejected";
        continue;
      }
      step.status = "running";
      step.startedAt = new Date().toISOString();
      const result = commitToolCall(step);
      step.finishedAt = new Date().toISOString();
      step.status = result.ok ? "succeeded" : "failed";
      step.output = result.data ?? result.detail;
      if (!result.ok) step.error = result.detail;
    }

    finalizePlanStatus(plan);
    plan.latencyMs += Date.now() - started;
    plan.reply = summarizeCommit(plan);
    store.savePlan(plan);
    return NextResponse.json({ plan } satisfies AssistantResponse);
  }

  // ---- PLAN MODE --------------------------------------------------
  const plan = hasAI()
    ? await planWithAI(command)
    : mockPlan(command);

  store.savePlan(plan);
  return NextResponse.json({ plan } satisfies AssistantResponse);
}

/* ------------------------------------------------------------------ */
/* AI planner (real tool-calling loop)                                 */
/* ------------------------------------------------------------------ */

async function planWithAI(command: string): Promise<ActionPlan> {
  const started = Date.now();
  const planId = uid("plan");

  try {
    const { text, steps } = await generateText({
      model: PLANNER_MODEL,
      system: PLANNER_SYSTEM_PROMPT,
      tools: assistantTools as ToolSet,
      // Allow the model to read context, then propose writes, over several turns.
      stopWhen: stepCountIs(8),
      temperature: 0.3,
      prompt: [
        `User (${DEMO_USER.name}, tone: ${DEMO_USER.preferences.writingTone}, tz: ${DEMO_USER.preferences.timezone}) says:`,
        command,
      ].join("\n"),
    });

    // Flatten every tool call the model made across all steps into ToolCalls.
    // The AI SDK exposes these as discriminated unions; we read them through a
    // narrow structural type since we only need id/name/input/output.
    type RawCall = { toolCallId: string; toolName: string; input: unknown };
    type RawResult = { toolCallId: string; output: unknown };
    type RawStep = { toolCalls: RawCall[]; toolResults: RawResult[] };
    const rawSteps = steps as unknown as RawStep[];
    const rawCalls = rawSteps.flatMap((s) => s.toolCalls);
    const rawResults = rawSteps.flatMap((s) => s.toolResults);
    const resultByCallId = new Map(rawResults.map((r) => [r.toolCallId, r.output]));

    const toolCalls: ToolCall[] = rawCalls.map((c, i) => {
      const toolName = c.toolName as ToolName;
      const meta = TOOL_META[toolName];
      const gated = requiresApproval(toolName);
      const output = resultByCallId.get(c.toolCallId);
      return {
        id: uid("call"),
        step: i + 1,
        toolName,
        effect: meta.effect,
        requiresApproval: gated,
        input: c.input as Record<string, unknown>,
        status: meta.effect === "read" ? "succeeded" : gated ? "awaiting_approval" : "succeeded",
        output,
        summary: describeCall(toolName, c.input as Record<string, unknown>),
      };
    });

    // Any write step that was NOT gated (autopilot) executes now.
    for (const step of toolCalls) {
      if (step.status === "succeeded" && step.effect === "write") {
        const res = commitToolCall(step);
        step.output = res.data ?? res.detail;
        step.status = res.ok ? "succeeded" : "failed";
        if (!res.ok) step.error = res.detail;
      }
    }

    const plan: ActionPlan = {
      id: planId,
      userId: DEMO_USER.id,
      command,
      intent: text.split("\n")[0]?.slice(0, 160) || "Handle the request.",
      status: "planning",
      steps: toolCalls,
      reply: text || "Here is my plan.",
      mocked: false,
      latencyMs: Date.now() - started,
      createdAt: new Date().toISOString(),
    };
    finalizePlanStatus(plan);
    return plan;
  } catch (err) {
    // Never fail the demo hard on a transient model error — degrade to mock.
    const plan = mockPlan(command);
    plan.reply = `AI call failed (${(err as Error).message}); showing a mock plan.`;
    return plan;
  }
}

/* ------------------------------------------------------------------ */
/* Mock planner (no API key)                                           */
/* ------------------------------------------------------------------ */

/**
 * Deterministic keyword planner. Not "AI", but it exercises the exact same
 * ActionPlan / ToolCall shapes and HITL approval flow the real planner uses, so
 * the dashboard is fully interactive with zero keys.
 */
function mockPlan(command: string): ActionPlan {
  const started = Date.now();
  const c = command.toLowerCase();
  const steps: ToolCall[] = [];
  const push = (toolName: ToolName, input: Record<string, unknown>, output?: unknown) => {
    const meta = TOOL_META[toolName];
    const gated = requiresApproval(toolName);
    steps.push({
      id: uid("call"),
      step: steps.length + 1,
      toolName,
      effect: meta.effect,
      requiresApproval: gated,
      input,
      status: meta.effect === "read" ? "succeeded" : gated ? "awaiting_approval" : "succeeded",
      output,
      summary: describeCall(toolName, input),
    });
  };

  const wantsInbox = /inbox|email|triage|reply|respond|unread/.test(c);
  const wantsCalendar = /calendar|schedule|meeting|slot|book|3pm|sync/.test(c);
  const wantsTask = /task|todo|remind|follow up|follow-up/.test(c);
  const wantsResearch = /research|look up|find out|competitor|background/.test(c);

  if (wantsInbox || (!wantsCalendar && !wantsTask && !wantsResearch)) {
    push("search_email", { unreadOnly: true }, { hits: store.getThreads().length });
    push("draft_reply", {
      threadId: "thr_1",
      body: "Hi Jordan — attaching the Q3 update and revenue figures now. Let me know if the partners need anything else before tomorrow. Best, Alex",
    });
  }
  if (wantsCalendar) {
    push("list_calendar", {}, { events: store.getEvents().length });
    push("find_meeting_slot", { durationMin: 30, daysAhead: 7 });
    push("create_event", {
      title: "Globex expansion chat",
      startAt: new Date(Date.now() + 86_400_000).toISOString(),
      endAt: new Date(Date.now() + 86_400_000 + 1_800_000).toISOString(),
      attendees: ["dana@globex.com"],
    });
  }
  if (wantsResearch) {
    push("web_research", { query: command }, {
      summary: "Mock briefing: 3 key points ready.",
    });
  }
  if (wantsTask) {
    push("create_task", { title: `Follow up: ${command}`, priority: "medium" });
  }

  const plan: ActionPlan = {
    id: uid("plan"),
    userId: DEMO_USER.id,
    command,
    intent: "Mock plan derived from keywords in your command.",
    status: "planning",
    steps,
    reply:
      "Mock mode (no AI key). I drafted a plan and staged the write actions for your approval. Set AI_GATEWAY_API_KEY to use the real planner.",
    mocked: true,
    latencyMs: Date.now() - started,
    createdAt: new Date().toISOString(),
  };
  finalizePlanStatus(plan);
  return plan;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function finalizePlanStatus(plan: ActionPlan): void {
  const anyPending = plan.steps.some((s) => s.status === "awaiting_approval");
  const anyFailed = plan.steps.some((s) => s.status === "failed");
  const anyDone = plan.steps.some((s) => s.status === "succeeded");
  if (anyPending) plan.status = "awaiting_approval";
  else if (anyFailed && anyDone) plan.status = "partially_completed";
  else if (anyFailed) plan.status = "failed";
  else plan.status = "completed";
}

function summarizeCommit(plan: ActionPlan): string {
  const done = plan.steps.filter((s) => s.status === "succeeded").length;
  const rejected = plan.steps.filter((s) => s.status === "rejected").length;
  const failed = plan.steps.filter((s) => s.status === "failed").length;
  const parts = [`Executed ${done} step${done === 1 ? "" : "s"}.`];
  if (rejected) parts.push(`Skipped ${rejected} you declined.`);
  if (failed) parts.push(`${failed} failed.`);
  return parts.join(" ");
}

function describeCall(toolName: ToolName, input: Record<string, unknown>): string {
  switch (toolName) {
    case "search_email":
      return `Search inbox${input.query ? ` for “${input.query}”` : " (unread)"}`;
    case "draft_reply":
      return `Draft a reply on thread ${String(input.threadId ?? "")}`;
    case "send_email":
      return `Send email to ${(input.to as string[] | undefined)?.join(", ") ?? "recipient"}`;
    case "list_calendar":
      return "Read today's calendar";
    case "create_event":
      return `Schedule “${String(input.title ?? "event")}”`;
    case "find_meeting_slot":
      return "Find open meeting slots";
    case "create_task":
      return `Add task “${String(input.title ?? "")}”`;
    case "list_tasks":
      return "Read task list";
    case "complete_task":
      return `Complete task ${String(input.taskId ?? "")}`;
    case "web_research":
      return `Research “${String(input.query ?? "")}”`;
    case "send_slack":
      return `Send Slack to ${String(input.channel ?? "")}`;
    default:
      return toolName;
  }
}
