/**
 * Domain types for the AI Agent Development Platform.
 *
 * These mirror the persisted data models in docs/TECHNICAL_SPEC.md. Zod schemas
 * that validate API inputs live next to the routes; the canonical TypeScript
 * shapes live here so the runtime, API, and UI all speak the same language.
 *
 * This module is intentionally dependency-light (no `ai`/server imports) so it
 * can be imported from client components as well as server code.
 */

/* ------------------------------------------------------------------ */
/* Models                                                              */
/* ------------------------------------------------------------------ */

/** Logical model tiers. Resolved to "provider/model" gateway strings in ai.ts. */
export type ModelTier = "fast" | "smart" | "frontier";

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

export type ToolCategory = "math" | "web" | "http";

/**
 * Client-safe tool metadata. The executable definition (zod input schema +
 * execute fn) is built server-side in lib/tools.ts from this catalog, so the UI
 * can render the tool picker without pulling the AI SDK into the browser bundle.
 */
export interface ToolMeta {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  /** Human-readable summary of the tool's input, shown in the picker. */
  inputHint: string;
}

/** The tools shipped with the platform's default registry. */
export const TOOL_CATALOG: ToolMeta[] = [
  {
    id: "calculator",
    name: "Calculator",
    description: "Evaluate an arithmetic expression (+ - * / and parentheses).",
    category: "math",
    inputHint: "{ expression: string }",
  },
  {
    id: "web_search",
    name: "Web Search (mock)",
    description: "Search the web and return ranked result snippets.",
    category: "web",
    inputHint: "{ query: string, limit?: number }",
  },
  {
    id: "http_fetch",
    name: "HTTP Fetch (mock)",
    description: "Fetch a URL and return status + JSON/text body.",
    category: "http",
    inputHint: "{ url: string, method?: 'GET' | 'POST' }",
  },
];

/* ------------------------------------------------------------------ */
/* Agent definition                                                    */
/* ------------------------------------------------------------------ */

export interface MemoryConfig {
  enabled: boolean;
  /** "buffer" keeps the last N messages; "none" runs stateless per call. */
  strategy: "buffer" | "none";
  maxMessages: number;
}

/**
 * The declarative definition of an agent. This is the unit users create, save,
 * version, and deploy. The runtime turns it into an executable tool-calling loop.
 */
export interface AgentDef {
  id: string;
  orgId: string;
  name: string;
  description: string;
  /** The agent's system prompt — its role, objective, and guardrails. */
  systemPrompt: string;
  model: ModelTier;
  /** Sampling temperature, 0–1. */
  temperature: number;
  /** IDs (from TOOL_CATALOG) the agent is allowed to call. */
  toolIds: string[];
  /** Hard cap on model<->tool iterations before the loop stops. */
  maxSteps: number;
  memory: MemoryConfig;
  createdAt: string;
  updatedAt: string;
}

/** The subset a user edits in the builder; server fills ids/timestamps/org. */
export interface AgentDraft {
  name: string;
  description: string;
  systemPrompt: string;
  model: ModelTier;
  temperature: number;
  toolIds: string[];
  maxSteps: number;
  memory: MemoryConfig;
}

/* ------------------------------------------------------------------ */
/* Memory                                                              */
/* ------------------------------------------------------------------ */

export type MemoryRole = "system" | "user" | "assistant" | "tool";

export interface MemoryEntry {
  role: MemoryRole;
  content: string;
  ts: string;
}

export interface Memory {
  agentId: string;
  sessionId: string;
  entries: MemoryEntry[];
}

/* ------------------------------------------------------------------ */
/* Run / Step / Trace                                                  */
/* ------------------------------------------------------------------ */

export type RunStatus = "running" | "completed" | "failed";

/** A single tool call made within a step, with its measured result. */
export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  ok: boolean;
  /** Wall-clock execution time of the tool's execute() in ms (measured). */
  latencyMs: number;
  error?: string;
}

/** One iteration of the agent loop: a model turn plus any tools it invoked. */
export interface Step {
  index: number;
  /** "model" = an intermediate reasoning/tool-calling turn; "final" = answer. */
  kind: "model" | "final";
  /** Assistant text produced on this step (may be empty on tool-only steps). */
  text: string;
  toolCalls: ToolInvocation[];
  /** Why the model stopped this step: "tool-calls" | "stop" | "length" | … */
  finishReason: string;
}

export type TraceEventType = "run_start" | "model_step" | "tool_call" | "run_end";

/** A single span on the observability timeline for a run. */
export interface TraceEvent {
  id: string;
  type: TraceEventType;
  label: string;
  /** Offset from run start, ms. */
  tStartMs: number;
  durationMs: number;
  data?: Record<string, unknown>;
}

export interface Trace {
  runId: string;
  events: TraceEvent[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** The full record of one agent execution — the primary observability object. */
export interface Run {
  id: string;
  agentId: string;
  orgId: string;
  input: string;
  status: RunStatus;
  /** Final assistant answer. */
  output: string;
  steps: Step[];
  trace: Trace;
  usage: TokenUsage;
  /** True when produced by the deterministic mock loop (no API key). */
  mocked: boolean;
  model: string;
  startedAt: string;
  endedAt: string;
  latencyMs: number;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* API contracts                                                       */
/* ------------------------------------------------------------------ */

export interface RunRequest {
  /** Run a saved agent by id … */
  agentId?: string;
  /** … or run an inline (possibly unsaved) draft straight from the builder. */
  agent?: AgentDraft;
  input: string;
  /** Optional prior turns for buffer memory. */
  history?: MemoryEntry[];
}

export interface ApiError {
  error: string;
  details?: unknown;
}
