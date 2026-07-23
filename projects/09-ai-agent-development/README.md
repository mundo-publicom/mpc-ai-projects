# Agent Forge — AI Agent Development Platform

> **Business case.** Every team building AI agents rebuilds the same plumbing: a tool-calling loop, a
> tool registry, memory, and — always last, always worst — observability. Agent Forge turns that
> plumbing into a product. **Who pays:** AI developers, agencies delivering agents to clients, and
> product teams shipping agentic features. **For what:** a managed runtime that runs the loop, a
> builder to define agents (prompt · tools · memory · model), and first-class run traces to debug
> them. **Pricing:** platform SaaS ($99 Team / $399 Agency / mo) **plus usage** — ~$0.01 per agent run
> and token pass-through on gateway spend — so revenue scales with customers' agent activity. The
> wedge is *"see inside your agent"*: a real runtime with a trace on every run, not another graph DSL.

## What it does

- **Define an agent declaratively** — system prompt, model tier, temperature, enabled tools, memory,
  and a max-steps loop cap — as a portable JSON `AgentDef`.
- **Run it** through a real AI SDK v5 tool-calling loop (`generateText` + tools + `stepCountIs`),
  routed through the Vercel AI Gateway.
- **See everything** — every run returns ordered steps (model turns + tool calls), a trace timeline
  with real per-tool latency, token usage, and the final answer.
- **Iterate fast** — run an *unsaved* draft straight from the builder; toggle a tool and re-run.
- **Zero-key demo** — with no model key, a deterministic mock loop plans tool calls, runs the real
  (mock) tools, and composes an answer, so the full product — trace included — works offline.

## Features

- Agent registry with full CRUD (`/api/agents`), org-scoped for multi-tenancy.
- Tool registry with typed, zod-validated, instrumented tools: **calculator** (real safe arithmetic —
  no `eval`), **web_search** (mock corpus), **http_fetch** (mock, no network). MCP + webhook tools on
  the roadmap.
- Runtime loop (`lib/runtime.ts`) with graceful degradation and per-tool error containment.
- Trace/observability objects (`Run`, `Step`, `Trace`) rendered as a timeline + step cards.
- Builder dashboard: `AgentEditor`, `ToolPicker`, `RunTrace`, and a saved-agents list.

## Tech

Next.js 15 (App Router) · TypeScript strict · Tailwind · Vercel AI SDK v5 (tool-calling) via AI
Gateway · zod validation. Node.js runtime (Fluid Compute).

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # optional — omit to run the mock loop with zero keys
pnpm dev                     # http://localhost:3000
```

Then in the builder: pick the seeded **Research Assistant** (or edit the draft), type a request such
as `What is (128 * 4) + 17, and where are the AI SDK tool docs?`, and hit **Run agent**. You'll see
the calculator and web_search tool calls, their inputs/outputs, the trace timeline, and the final
answer. Add `AI_GATEWAY_API_KEY` to `.env.local` to swap the mock loop for a live model.

### API

```bash
# Create an agent
curl -X POST localhost:3000/api/agents -H 'content-type: application/json' -d '{
  "name": "Research Assistant",
  "systemPrompt": "You are a precise research assistant. Use web_search and calculator; cite sources.",
  "model": "smart", "temperature": 0.3,
  "toolIds": ["web_search", "calculator"], "maxSteps": 6,
  "memory": { "enabled": true, "strategy": "buffer", "maxMessages": 20 }
}'

# Run an agent (inline draft or by agentId) and get the full trace
curl -X POST localhost:3000/api/agents/run -H 'content-type: application/json' -d '{
  "agent": { "name": "R", "systemPrompt": "Use tools to answer.", "model": "smart",
             "temperature": 0.3, "toolIds": ["calculator","web_search"], "maxSteps": 6,
             "memory": { "enabled": false, "strategy": "none", "maxMessages": 0 } },
  "input": "What is (128 * 4) + 17, and where are the AI SDK tool docs?"
}'
```

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | for live runs | Routes `provider/model` calls through the Vercel AI Gateway. Absent → mock loop. |
| `ANTHROPIC_API_KEY` | optional | Alternative "AI available" signal; prefer the gateway key. |

## Project layout

```
app/
  page.tsx                 builder dashboard (editor + run/trace panel)
  api/agents/route.ts      agent registry CRUD
  api/agents/run/route.ts  execute an agent → Run + trace
components/                AgentEditor · ToolPicker · RunTrace
lib/
  types.ts                 AgentDef · Tool · Run · Step · Trace · Memory + TOOL_CATALOG
  ai.ts                    MODELS, hasAI(), AI SDK re-exports
  tools.ts                 tool registry + instrumented executors
  runtime.ts               the agent loop (live + mock) → Run
  store.ts                 in-memory agents + runs (swap for Postgres)
docs/                      PRD · TECHNICAL_SPEC · ARCHITECTURE
```

## Roadmap

- **M1:** Postgres store, agent versioning, run-history dashboard, per-org API keys.
- **M2:** MCP tool integration; webhook/HTTP tools with auth; sandboxed executors.
- **M3:** multi-step workflows (chained agents); eval suites; A/B prompt comparison.
- **M4:** agency multi-tenant billing + per-client usage export; shareable run viewer; SSO.
- **M5:** self-hosted runtime; streaming runs; human-in-the-loop steps; failure alerting.

See [`docs/PRD.md`](docs/PRD.md), [`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md), and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full product and technical detail.
