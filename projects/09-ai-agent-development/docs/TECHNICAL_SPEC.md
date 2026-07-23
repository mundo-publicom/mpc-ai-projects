# Technical Spec — Agent Forge

## System overview

Agent Forge is a Next.js (App Router) application. The value path is a server-side **agent runtime**
that drives an AI SDK tool-calling loop and emits a fully-instrumented `Run` (steps + trace + usage).
Around it sit an **agent registry** (CRUD), a **tool registry**, an in-memory **store** (swap for
Postgres in production), and a **builder UI** that runs agents and renders their traces.

```
Browser (builder)  ──HTTP──▶  /api/agents        (registry CRUD)
                              /api/agents/run     (execute → Run + trace)
                                        │
                                        ▼
                              lib/runtime.ts  ──▶  lib/ai.ts (AI SDK → AI Gateway)
                                        │                └─ generateText + stopWhen(stepCountIs)
                                        ├──▶  lib/tools.ts (tool registry + executors)
                                        └──▶  lib/store.ts (agents + runs, in-memory)
```

Everything runs on the Node.js runtime (Fluid Compute on Vercel) — the loop and tool executors need
full Node APIs and longer wall-clock budgets than the edge allows.

## Component breakdown

### 1. Agent registry (`lib/store.ts`, `app/api/agents/route.ts`)
CRUD for `AgentDef`, scoped by `orgId`. In-memory `Map` seeded with a demo agent; the module-scope
store survives across requests in a warm process. Production swaps this for Postgres behind the same
functions (`listAgents`, `getAgent`, `createAgent`, `updateAgent`, `deleteAgent`).

### 2. Tool registry (`lib/tools.ts`)
- **Client-safe metadata** (`TOOL_CATALOG` in `lib/types.ts`) — powers the UI tool picker without
  pulling the AI SDK into the browser bundle.
- **Executable definitions** — built server-side via `buildToolSet(enabledIds, sink)`, each a
  `tool({ description, inputSchema, execute })`. Executors are instrumented: they measure latency,
  emit a `ToolSpan` to the trace sink, and catch errors into `{ error }` so a failing tool never
  crashes the loop.
- **Shipped tools:** `calculator` (real, safe recursive-descent arithmetic — no `eval`), `web_search`
  (deterministic mock corpus), `http_fetch` (deterministic mock, no network). Extension points: MCP
  tools and webhook/HTTP tools (roadmap M2).

### 3. Runtime / execution loop (`lib/runtime.ts`)
`runAgent(agent, input, history) → Run`. Two paths behind one signature:
- **Live:** `generateText({ model, system, prompt, tools, temperature, stopWhen: stepCountIs(maxSteps) })`.
  The SDK runs the model⇄tool loop; we map `result.steps` into domain `Step`s and correlate measured
  tool spans for accurate latency.
- **Mock (`!hasAI()`):** a deterministic planner inspects the input, selects enabled tools (URL →
  `http_fetch`, arithmetic → `calculator`, question/keywords → `web_search`), runs the **real** mock
  executors, and composes an answer. Produces the same `Run` shape and a complete trace.

Both paths build a `Trace`: `run_start`, one `model_step` per iteration, a `tool_call` span per tool
(real measured duration), and `run_end`. Non-tool time is distributed across model steps so the
timeline sums to total latency.

### 4. Memory store (`lib/types.ts` `Memory`, runtime `history` param)
v1 buffer memory: prior `MemoryEntry[]` are rendered into the prompt (last N per `memory.maxMessages`).
Interface is designed so a persistent per-session store (Redis/Postgres) drops in later.

### 5. Trace / observability (`Trace`, `TraceEvent` in `lib/types.ts`)
Every run persists a trace of ordered spans with inputs, outputs, ok/error, and latency. This is the
product's moat — the object the builder's trace viewer renders and the failed-run debugging flow uses.

### 6. Deploy layer
Agents are portable JSON `AgentDef`s. "Deploy" = making a saved agent runnable via `POST
/api/agents/run` (by `agentId`) with org-scoped API keys (roadmap M1) and per-org usage metering.

## Data models (typed)

All canonical shapes live in `lib/types.ts` (dependency-light, client-safe).

```ts
type ModelTier = "fast" | "smart" | "frontier";

interface AgentDef {
  id: string; orgId: string;
  name: string; description: string;
  systemPrompt: string;
  model: ModelTier; temperature: number;
  toolIds: string[];            // ids from TOOL_CATALOG
  maxSteps: number;             // model⇄tool loop cap
  memory: MemoryConfig;
  createdAt: string; updatedAt: string;
}

interface MemoryConfig { enabled: boolean; strategy: "buffer" | "none"; maxMessages: number; }

interface ToolMeta { id: string; name: string; description: string; category: "math"|"web"|"http"; inputHint: string; }

interface ToolInvocation {
  toolCallId: string; toolName: string;
  input: unknown; output?: unknown;
  ok: boolean; latencyMs: number; error?: string;
}

interface Step {
  index: number;
  kind: "model" | "final";
  text: string;
  toolCalls: ToolInvocation[];
  finishReason: string;         // "tool-calls" | "stop" | "length" | ...
}

interface TraceEvent {
  id: string;
  type: "run_start" | "model_step" | "tool_call" | "run_end";
  label: string; tStartMs: number; durationMs: number;
  data?: Record<string, unknown>;
}
interface Trace { runId: string; events: TraceEvent[]; }

interface TokenUsage { inputTokens: number; outputTokens: number; totalTokens: number; }

interface Run {
  id: string; agentId: string; orgId: string;
  input: string;
  status: "running" | "completed" | "failed";
  output: string;
  steps: Step[]; trace: Trace; usage: TokenUsage;
  mocked: boolean; model: string;
  startedAt: string; endedAt: string; latencyMs: number;
  error?: string;
}

interface Memory { agentId: string; sessionId: string; entries: MemoryEntry[]; }
interface MemoryEntry { role: "system"|"user"|"assistant"|"tool"; content: string; ts: string; }
```

## API surface

All routes: Node.js runtime, typed JSON, zod-validated inputs, `orgId` scoping (demo org in v1).

### `GET /api/agents`
List agent definitions. → `{ agents: AgentDef[] }`

### `POST /api/agents`
Create an agent. Body = `AgentDraft` (name, description, systemPrompt, model, temperature, toolIds,
maxSteps, memory). → `201 { agent: AgentDef }` · `422 { error, details }` on validation failure.

### `PUT /api/agents`
Update by id. Body = `{ id, ...Partial<AgentDraft> }`. → `{ agent }` · `404` if missing.

### `DELETE /api/agents?id=…`
Delete by id. → `{ deleted: id }` · `404` if missing.

### `POST /api/agents/run`
Execute an agent. Body:
```jsonc
{
  "agentId": "agent_...",      // run a saved agent, OR
  "agent": { /* AgentDraft */ }, // run an inline (unsaved) draft
  "input": "user request",
  "history": [ { "role": "user", "content": "..." } ]  // optional buffer memory
}
```
→ `{ run: Run, hasAI: boolean }`. Requires exactly one of `agentId` / `agent`. Validation → `422`;
missing agent → `404`; unexpected failure → `500` (runtime itself degrades rather than throwing).

## AI / model usage

- **Access pattern:** Vercel AI SDK v5 routed through the AI Gateway using `provider/model` strings.
  Tiers in `lib/ai.ts`: `fast` = `anthropic/claude-haiku-4-5`, `smart` = `anthropic/claude-sonnet-5`,
  `frontier` = `anthropic/claude-opus-4-8`. No provider SDK wired directly.
- **Tool-calling agent loop:** `generateText` with a `tools` set and `stopWhen: stepCountIs(maxSteps)`.
  The model plans, emits tool calls, receives typed results, and iterates until it produces a final
  answer or hits the step cap. Tool inputs are validated by each tool's zod `inputSchema`.
- **Structured planning:** tools carry zod schemas so arguments are structured and validated; the mock
  planner mirrors this by deriving structured tool inputs from the raw request.
- **Every call** sets a system prompt and temperature (from the `AgentDef`). Structured-output flows
  that need `generateObject` (e.g. eval scoring) will set an explicit zod schema (roadmap M3).

## Third-party integrations

- **Vercel AI Gateway** — model routing, spend caps, failover (`AI_GATEWAY_API_KEY`).
- **MCP tools (roadmap M2)** — connect an MCP server; its tools register into the tool registry and
  run out-of-process.
- **Webhook / HTTP tools (roadmap M2)** — user-defined tools that POST to an authenticated endpoint;
  the real counterpart to the shipped `http_fetch` mock.
- **Postgres (roadmap M1)** — durable agent registry + run/trace store behind the same store interface.

## Security & privacy

- **Multi-tenancy:** every entity carries `orgId`; store lookups enforce it. Runs are metered per org.
- **Sandboxing:** tool executors run without ambient credentials; the shipped `calculator` uses a
  restricted parser (no `eval`/`Function`); production HTTP/MCP tools run out-of-process behind egress
  allowlists. Untrusted/generated code should run in an isolated microVM (e.g. Vercel Sandbox).
- **Secrets:** model keys via env only (`AI_GATEWAY_API_KEY`); never stored in agent definitions or
  traces. Agent JSON is portable and secret-free.
- **Input validation:** all bodies zod-validated; sizes capped (prompt ≤ 20k chars, input ≤ 8k, steps
  ≤ 25) to bound cost and abuse.
- **Failure containment:** tool errors are caught into `{ error }`; the runtime returns a `failed` Run
  rather than throwing, so one bad tool cannot crash a tenant's request.

## Observability

- **Traces:** 100% of runs emit a `Trace` (spans with input/output/latency/ok). Rendered as a timeline
  + per-step tool cards in the builder; the debugging surface for failed runs.
- **Metrics (derived from runs):** run success rate, steps per run, tool error rate, latency
  percentiles, tokens per org — feeding the KPIs in the PRD.
- **Correlation:** each run has a stable `runId`; trace event ids are namespaced by it.

## Scaling considerations

- **Stateless routes:** the loop is stateless per request; scale horizontally on Fluid Compute.
- **Store:** in-memory in v1 → Postgres (agents/runs) + object storage or a trace backend for
  high-volume trace payloads, with tiered retention and payload sampling.
- **Cost control:** model tier per agent, `maxSteps` cap, token metering per org, gateway spend caps.
- **Long runs:** `maxDuration = 60s` on the run route; streaming + durable workflow execution for
  longer agents is roadmap M5.

## Testing strategy

- **Unit:** `evalArithmetic` (precedence, parens, error cases), `mockWebSearch` ranking,
  `extractExpression`, usage estimation, and the SDK-step → `Step` mapper.
- **Runtime:** mock-path `runAgent` asserts steps/trace/usage shape and deterministic outputs; live
  path tested against a stubbed model.
- **API/contract:** zod schema acceptance/rejection; CRUD lifecycle; run route with `agentId` vs inline
  draft; 404/422 paths.
- **E2E:** builder loads seeded agent, edits a tool toggle, runs, and renders a trace with ≥ 1 tool call
  — the primary value path — verified with zero keys via the mock loop.
