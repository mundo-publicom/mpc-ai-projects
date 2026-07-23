/**
 * Agent runtime — the execution loop.
 *
 * runAgent() takes an AgentDef + a user input and drives a tool-calling loop to
 * completion, returning a fully-populated Run: ordered Steps, a Trace timeline,
 * token usage, and the final answer.
 *
 *  - When a model key is present (hasAI()), it uses the AI SDK's `generateText`
 *    with the agent's tool set and a `stepCountIs(maxSteps)` stop condition.
 *    Tool executors are instrumented so real per-tool latency lands in the trace.
 *  - When no key is present, a deterministic MOCK loop plans tool calls from the
 *    input, runs the real (mock) executors, and composes an answer — so the
 *    entire product, trace included, is demoable with zero configuration.
 */
import { generateText, stepCountIs, resolveModel, hasAI } from "./ai";
import {
  buildToolSet,
  evalArithmetic,
  mockWebSearch,
  mockHttpFetch,
  type ToolSpan,
} from "./tools";
import type {
  AgentDef,
  MemoryEntry,
  Run,
  Step,
  ToolInvocation,
  TokenUsage,
  Trace,
  TraceEvent,
} from "./types";

let runCounter = 0;
function newRunId(): string {
  runCounter += 1;
  return `run_${Date.now().toString(36)}_${runCounter}`;
}

function renderHistory(history: MemoryEntry[]): string {
  if (!history.length) return "";
  const lines = history
    .filter((h) => h.role === "user" || h.role === "assistant")
    .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`);
  return `Conversation so far:\n${lines.join("\n")}\n\n`;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export async function runAgent(
  agent: AgentDef,
  input: string,
  history: MemoryEntry[] = [],
): Promise<Run> {
  const runId = newRunId();
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const model = resolveModel(agent.model);

  if (!hasAI()) {
    return runMock(agent, input, { runId, startedAtMs, startedAt, model });
  }

  const spans: ToolSpan[] = [];
  const tools = buildToolSet(agent.toolIds, (span) => spans.push(span));
  const prompt = `${renderHistory(history)}User request:\n${input}`;

  try {
    const result = await generateText({
      model,
      system: agent.systemPrompt,
      prompt,
      temperature: agent.temperature,
      tools,
      stopWhen: stepCountIs(agent.maxSteps),
    });

    const steps = mapSdkSteps(result.steps, spans);
    const endedAtMs = Date.now();
    const usage = normalizeUsage(result.usage);
    const trace = buildTrace(runId, steps, spans, endedAtMs - startedAtMs);

    return {
      id: runId,
      agentId: agent.id,
      orgId: agent.orgId,
      input,
      status: "completed",
      output: result.text || lastText(steps),
      steps,
      trace,
      usage,
      mocked: false,
      model,
      startedAt,
      endedAt: new Date(endedAtMs).toISOString(),
      latencyMs: endedAtMs - startedAtMs,
    };
  } catch (err) {
    const endedAtMs = Date.now();
    const steps = mapSdkSteps([], spans);
    return {
      id: runId,
      agentId: agent.id,
      orgId: agent.orgId,
      input,
      status: "failed",
      output: "",
      steps,
      trace: buildTrace(runId, steps, spans, endedAtMs - startedAtMs),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      mocked: false,
      model,
      startedAt,
      endedAt: new Date(endedAtMs).toISOString(),
      latencyMs: endedAtMs - startedAtMs,
      error: err instanceof Error ? err.message : "Agent run failed",
    };
  }
}

/* ------------------------------------------------------------------ */
/* SDK step -> domain Step mapping                                     */
/* ------------------------------------------------------------------ */

interface SdkToolCall {
  toolCallId: string;
  toolName: string;
  input?: unknown;
}
interface SdkToolResult {
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
}
interface SdkStep {
  text?: string;
  toolCalls?: SdkToolCall[];
  toolResults?: SdkToolResult[];
  finishReason?: string;
}

function mapSdkSteps(rawSteps: unknown, spans: ToolSpan[]): Step[] {
  const steps = (rawSteps as SdkStep[] | undefined) ?? [];
  // Queue measured spans per tool name so we can attribute latency in order.
  const spanQueue = new Map<string, ToolSpan[]>();
  for (const s of spans) {
    const q = spanQueue.get(s.toolName) ?? [];
    q.push(s);
    spanQueue.set(s.toolName, q);
  }
  const takeSpan = (toolName: string): ToolSpan | undefined =>
    spanQueue.get(toolName)?.shift();

  return steps.map((step, index) => {
    const calls = step.toolCalls ?? [];
    const results = step.toolResults ?? [];
    const resultById = new Map(results.map((r) => [r.toolCallId, r]));

    const toolCalls: ToolInvocation[] = calls.map((call) => {
      const res = resultById.get(call.toolCallId);
      const span = takeSpan(call.toolName);
      const output = res?.output;
      const ok = span ? span.ok : !isErrorOutput(output);
      return {
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        input: call.input ?? res?.input,
        output,
        ok,
        latencyMs: span?.latencyMs ?? 0,
        error: span?.error ?? (isErrorOutput(output) ? String((output as { error: unknown }).error) : undefined),
      };
    });

    const isLast = index === steps.length - 1;
    return {
      index,
      kind: isLast && toolCalls.length === 0 ? "final" : "model",
      text: step.text ?? "",
      toolCalls,
      finishReason: step.finishReason ?? "stop",
    };
  });
}

function isErrorOutput(output: unknown): output is { error: unknown } {
  return typeof output === "object" && output !== null && "error" in output;
}

function lastText(steps: Step[]): string {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].text) return steps[i].text;
  }
  return "";
}

interface RawUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}
function normalizeUsage(raw: unknown): TokenUsage {
  const u = (raw as RawUsage | undefined) ?? {};
  const inputTokens = u.inputTokens ?? u.promptTokens ?? 0;
  const outputTokens = u.outputTokens ?? u.completionTokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: u.totalTokens ?? inputTokens + outputTokens,
  };
}

/* ------------------------------------------------------------------ */
/* Trace construction                                                  */
/* ------------------------------------------------------------------ */

function buildTrace(
  runId: string,
  steps: Step[],
  spans: ToolSpan[],
  totalMs: number,
): Trace {
  const events: TraceEvent[] = [];
  let seq = 0;
  const id = () => `ev_${runId}_${seq++}`;

  events.push({
    id: id(),
    type: "run_start",
    label: "Run started",
    tStartMs: 0,
    durationMs: 0,
  });

  const toolTotal = spans.reduce((n, s) => n + s.latencyMs, 0);
  const modelStepCount = Math.max(steps.length, 1);
  // Distribute non-tool time across model steps for a plausible timeline.
  const perModelMs = Math.max(0, Math.round((totalMs - toolTotal) / modelStepCount));

  let cursor = 0;
  for (const step of steps) {
    events.push({
      id: id(),
      type: "model_step",
      label: `Model step ${step.index + 1}${step.kind === "final" ? " (final)" : ""}`,
      tStartMs: cursor,
      durationMs: perModelMs,
      data: {
        finishReason: step.finishReason,
        toolCalls: step.toolCalls.map((t) => t.toolName),
        hasText: Boolean(step.text),
      },
    });
    cursor += perModelMs;

    for (const call of step.toolCalls) {
      events.push({
        id: id(),
        type: "tool_call",
        label: `Tool: ${call.toolName}${call.ok ? "" : " (error)"}`,
        tStartMs: cursor,
        durationMs: call.latencyMs,
        data: { input: call.input, ok: call.ok, error: call.error },
      });
      cursor += call.latencyMs;
    }
  }

  events.push({
    id: id(),
    type: "run_end",
    label: "Run finished",
    tStartMs: Math.max(cursor, totalMs),
    durationMs: 0,
  });

  return { runId, events };
}

/* ------------------------------------------------------------------ */
/* Mock loop (no API key) — deterministic, still exercises real tools  */
/* ------------------------------------------------------------------ */

interface RunCtx {
  runId: string;
  startedAtMs: number;
  startedAt: string;
  model: string;
}

function extractExpression(input: string): string | null {
  const matches = input.match(/[0-9][0-9+\-*/().\s]*[0-9)]/g);
  if (!matches) return null;
  // Pick the longest math-looking chunk that actually contains an operator.
  const withOp = matches.filter((m) => /[+\-*/]/.test(m)).sort((a, b) => b.length - a.length);
  return withOp[0]?.trim() ?? null;
}

function runMock(agent: AgentDef, input: string, ctx: RunCtx): Run {
  const spans: ToolSpan[] = [];
  const enabled = new Set(agent.toolIds);
  const steps: Step[] = [];
  const summaries: string[] = [];

  const planCalls: ToolInvocation[] = [];
  let sc = 0;
  const nextId = () => `tc_mock_${ctx.runId}_${sc++}`;

  const runTool = (
    toolName: string,
    inputArgs: unknown,
    fn: () => unknown,
  ): ToolInvocation => {
    const start = Date.now();
    let output: unknown;
    let ok = true;
    let error: string | undefined;
    try {
      output = fn();
    } catch (e) {
      ok = false;
      error = e instanceof Error ? e.message : "Tool failed";
      output = { error };
    }
    // Mock tools are instant; synthesize a small, realistic latency.
    const latencyMs = Math.max(1, Date.now() - start) + 6 + Math.floor(Math.random() * 12);
    const inv: ToolInvocation = {
      toolCallId: nextId(),
      toolName,
      input: inputArgs,
      output,
      ok,
      latencyMs,
      error,
    };
    spans.push({ ...inv });
    return inv;
  };

  // --- Planning: choose tools from the input, honoring what's enabled. ---
  if (enabled.has("http_fetch")) {
    const url = input.match(/https?:\/\/\S+/)?.[0];
    if (url) {
      const inv = runTool("http_fetch", { url: url.replace(/[).,]+$/, ""), method: "GET" }, () =>
        mockHttpFetch(url.replace(/[).,]+$/, ""), "GET"),
      );
      planCalls.push(inv);
      const body = (inv.output as { status?: number })?.status;
      summaries.push(`fetched ${url} (HTTP ${body ?? "?"})`);
    }
  }
  if (enabled.has("calculator")) {
    const expr = extractExpression(input);
    if (expr) {
      const inv = runTool("calculator", { expression: expr }, () => ({
        expression: expr,
        result: evalArithmetic(expr),
      }));
      planCalls.push(inv);
      const r = (inv.output as { result?: number })?.result;
      if (inv.ok) summaries.push(`computed ${expr} = ${r}`);
    }
  }
  if (enabled.has("web_search")) {
    const wantsSearch = /\b(search|find|look up|lookup|latest|who|what|when|where|why|how|docs?|documentation|news)\b/i.test(
      input,
    );
    if (wantsSearch || (planCalls.length === 0 && enabled.size > 0)) {
      const query = input.slice(0, 200);
      const inv = runTool("web_search", { query, limit: 3 }, () => ({
        query,
        results: mockWebSearch(query, 3),
      }));
      planCalls.push(inv);
      const top = (inv.output as { results?: { title: string }[] })?.results?.[0]?.title;
      if (top) summaries.push(`searched the web (top hit: "${top}")`);
    }
  }

  // --- Step 0: the planning / tool-calling model turn. ---
  if (planCalls.length > 0) {
    steps.push({
      index: 0,
      kind: "model",
      text: `Planning: I'll use ${planCalls.map((c) => c.toolName).join(", ")} to answer this.`,
      toolCalls: planCalls,
      finishReason: "tool-calls",
    });
  }

  // --- Final step: compose an answer from tool outputs (or answer directly). ---
  const finalText = composeAnswer(agent, input, planCalls, summaries);
  steps.push({
    index: steps.length,
    kind: "final",
    text: finalText,
    toolCalls: [],
    finishReason: "stop",
  });

  const endedAtMs = Date.now();
  const latencyMs = Math.max(endedAtMs - ctx.startedAtMs, spans.reduce((n, s) => n + s.latencyMs, 0) + 20);
  const trace = buildTrace(ctx.runId, steps, spans, latencyMs);
  const usage = estimateUsage(agent, input, finalText, planCalls);

  return {
    id: ctx.runId,
    agentId: agent.id,
    orgId: agent.orgId,
    input,
    status: "completed",
    output: finalText,
    steps,
    trace,
    usage,
    mocked: true,
    model: ctx.model,
    startedAt: ctx.startedAt,
    endedAt: new Date(endedAtMs).toISOString(),
    latencyMs,
  };
}

function composeAnswer(
  agent: AgentDef,
  input: string,
  calls: ToolInvocation[],
  summaries: string[],
): string {
  if (calls.length === 0) {
    return [
      `[mock] ${agent.name} received: "${input.slice(0, 160)}".`,
      `No tools were triggered for this input, so here is a direct answer based on the system prompt.`,
      `Add a model key (AI_GATEWAY_API_KEY) to run the real tool-calling loop.`,
    ].join(" ");
  }
  const calc = calls.find((c) => c.toolName === "calculator" && c.ok);
  const parts: string[] = [`[mock] Here's what I did: ${summaries.join("; ")}.`];
  if (calc) {
    const r = (calc.output as { result?: number }).result;
    parts.push(`The calculation result is ${r}.`);
  }
  const search = calls.find((c) => c.toolName === "web_search");
  if (search) {
    const top = (search.output as { results?: { title: string; url: string }[] }).results?.[0];
    if (top) parts.push(`Most relevant source: ${top.title} (${top.url}).`);
  }
  parts.push(`Provide AI_GATEWAY_API_KEY to replace these deterministic outputs with a live model.`);
  return parts.join(" ");
}

function estimateUsage(
  agent: AgentDef,
  input: string,
  output: string,
  calls: ToolInvocation[],
): TokenUsage {
  // ~4 chars/token rough estimate so the mock trace shows plausible numbers.
  const toChars = (v: unknown) => JSON.stringify(v ?? "").length;
  const inputChars =
    agent.systemPrompt.length + input.length + calls.reduce((n, c) => n + toChars(c.output), 0);
  const inputTokens = Math.ceil(inputChars / 4);
  const outputTokens = Math.ceil((output.length + calls.reduce((n, c) => n + toChars(c.input), 0)) / 4);
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}
