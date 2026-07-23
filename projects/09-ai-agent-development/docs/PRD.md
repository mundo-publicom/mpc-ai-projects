# PRD — Agent Forge (AI Agent Development Platform)

## Overview

Agent Forge is a framework + low-config platform for building, testing, and deploying custom AI
agents. A developer defines an agent declaratively — system prompt, tools, memory, and model —
composes multi-step workflows, runs them via API, and monitors every run as a step-by-step trace.
It is sold to the people who build agents for a living: individual AI engineers, agencies delivering
agents to clients, and internal product teams shipping agentic features.

The core insight: most teams rebuild the same scaffolding for every agent — a tool-calling loop, a
tool registry, memory, retries, and (usually last and worst) observability. Agent Forge makes that
scaffolding a product. You bring the prompt and the tools; the platform runs the loop and shows you
exactly what happened.

## Problem

Building a *demo* agent takes an afternoon. Shipping a *reliable* one to a paying client takes weeks,
because teams must build and maintain:

1. **A runtime loop** — call model, execute tool calls, feed results back, repeat until done, with a
   sane stop condition and per-tool error handling.
2. **A tool registry** — typed, validated inputs; sandboxed execution; MCP + webhook tools.
3. **Memory** — conversation buffers, per-session state, and context management.
4. **Observability** — the #1 gap. When an agent gives a wrong answer, teams have no trace of which
   tool returned what, how many steps ran, or where tokens went.
5. **Multi-tenant deployment** — running many clients' agents safely from one control plane.

Frameworks (LangGraph, CrewAI) give you code but no managed runtime or UI. Low-code tools (Dify,
Relevance) give you a UI but lock you out of code-level control and portable definitions. Agent Forge
sits in the middle: **code-grade control with a managed runtime, a builder UI, and first-class traces.**

## Target users & personas

- **Ana — AI Developer (primary).** Ships agents inside a product. Wants a typed `AgentDef`, a real
  tool-calling loop she doesn't have to maintain, and a trace she can debug. Lives in the API and CLI;
  uses the UI to inspect runs.
- **Marco — Agency Technical Lead.** Delivers 5–20 client agents a quarter. Needs multi-tenant
  isolation, per-client usage metering for billing, versioned agent definitions, and a shareable run
  viewer to show clients "here's what your agent did."
- **Priya — Product Manager / Product Team.** Owns an agentic feature. Needs to tweak prompts and tool
  toggles without a deploy, run evals against a test set, and watch success-rate dashboards.

## User stories

1. As Ana, I define an agent (prompt + tools + model) and run it against an input in under five
   minutes, seeing every step and tool call.
2. As Ana, I toggle a tool on/off and immediately re-run the *unsaved* draft to compare behavior.
3. As Ana, I call `POST /api/agents/run` from my backend and get back a structured `Run` with steps,
   trace, tokens, and final output.
4. As Marco, I create agents scoped to a client org, and each run is metered so I can bill per run/token.
5. As Marco, I open a failed run and see which tool errored, with its exact input and error message.
6. As Priya, I edit a system prompt in the builder, save a new version, and A/B it against the prior one.
7. As Priya, I connect an MCP server and its tools appear in the tool registry for my agents.
8. As any user, when no model key is configured, the platform still runs a realistic mock loop so I can
   evaluate the product end to end before paying.

## Functional requirements

1. **Agent registry (CRUD).** Create, read, update, delete, and list `AgentDef`s, scoped by org.
2. **Agent definition.** name, description, system prompt, model tier, temperature, enabled tool ids,
   max steps, and memory config.
3. **Tool registry.** A catalog of typed tools (zod input schema + executor). Ships with `calculator`,
   `web_search`, and `http_fetch`. Extensible with MCP tools and webhook (HTTP) tools.
4. **Runtime / execution loop.** Execute an agent against an input using AI SDK tool-calling with a
   `stepCountIs(maxSteps)` stop condition. Instrument each tool call.
5. **Run object.** Every execution returns ordered `Step`s (model turn + tool calls), a `Trace`
   timeline, token usage, latency, model used, status, and final output.
6. **Trace / observability.** A timeline of spans (run start, model steps, tool calls with real
   measured latency, run end) with inputs/outputs per tool.
7. **Inline run.** Run a saved agent by id *or* an unsaved inline draft (fast iteration in the builder).
8. **Memory.** Optional buffer memory: prior turns passed into the loop; configurable max messages.
9. **Builder UI.** Agent editor (prompt/model/temperature/max steps/tools/memory), saved-agents list,
   run panel with input box and step-by-step trace viewer.
10. **Graceful degradation.** With no model key, a deterministic mock loop plans tool calls, executes
    the real (mock) tools, and composes an answer — producing a full, inspectable trace.
11. **Multi-tenancy.** All entities scoped by `orgId`; runs metered per org for usage billing.
12. **Input validation.** All API inputs validated with zod; typed JSON responses.

## Non-functional requirements

- **Reliability:** a model/tool error degrades to a safe result; a run never throws an unhandled error.
- **Latency:** builder run round-trip under ~2s p50 for a 2–3 step agent on the `smart` tier.
- **Portability:** agent definitions are plain JSON; no lock-in to a proprietary graph format.
- **Security:** tenant isolation; tool sandboxing; no secrets in agent definitions or traces.
- **Observability:** 100% of runs produce a persisted trace.
- **Type safety:** TypeScript strict; shared domain types across runtime, API, and UI.

## Success metrics / KPIs

- **Time-to-first-agent (TTFA):** median time from signup to first successful run. Target < 10 min.
- **Run success rate:** share of runs completing without error and within max steps. Target > 95%.
- **Retained agents:** agents run in ≥ 3 distinct weeks after creation (proxy for production use).
- **Runs per active org / week** and **tokens per org** (usage-revenue drivers).
- **Trace open rate on failed runs** (are teams actually debugging with us — activation of the moat).

## Monetization & pricing

Platform SaaS + usage-based, aligned to how agencies and teams actually incur cost.

- **Free / Dev — $0:** 1 seat, up to 3 agents, 500 runs/mo, 7-day trace retention, community support.
- **Team — $99 / mo:** 5 seats, unlimited agents, 10k runs/mo included, 30-day traces, MCP + webhook
  tools, versioning. Overage: **$0.01 / run** + **token pass-through + 15%** on gateway spend.
- **Agency — $399 / mo:** unlimited seats, multi-tenant client orgs, per-client usage export for
  rebilling, 90-day traces, shareable run viewer, priority support. Overage: **$0.008 / run** + token
  pass-through + 12%.
- **Enterprise — custom:** SSO/SAML, private tool sandboxing, VPC / self-hosted runtime, SLA, audit logs.

Who pays for what: teams pay the platform fee for the managed runtime + observability; usage fees scale
with agent activity (runs and tokens), so revenue grows with customers' success.

## Go-to-market

- **Wedge:** "See inside your agent." Lead with observability + a real runtime loop, not another graph DSL.
- **Developer-led:** open-source the `AgentDef` schema and a TS client; free tier for the loop + trace UI.
- **Content:** teardown posts debugging real agent failures using traces; "from prompt to production" guides.
- **Agency channel:** template gallery + per-client metering as the paid hook for agencies rebilling clients.
- **Integrations:** ship MCP + webhook tools day one so existing tools plug in without rewrites.

## Competitive landscape

- **LangGraph** — powerful graph-based orchestration library; code-first, self-managed, steep learning
  curve, observability via separate LangSmith. Forge: managed runtime + built-in traces + simpler model.
- **CrewAI** — multi-agent "crews" framework; opinionated roles, Python-first, limited managed hosting.
  Forge: single + multi-step agents, TS-native, managed runtime, deeper per-run tracing.
- **Vercel AI SDK** — the toolkit we build *on*; gives primitives (`generateText` + tools) but not a
  registry, builder UI, multi-tenant control plane, or trace store. Forge is the platform layer above it.
- **Relevance AI** — low-code agent builder; strong UI, weaker code-level control and portability.
  Forge: code-grade `AgentDef`, API-first, no lock-in.
- **Dify** — open-source LLMOps/app builder; broad but heavyweight; agent runtime is one of many features.
  Forge: focused specifically on agent definition → run → trace with usage-based multi-tenancy for agencies.

## Risks & mitigations

- **"Just an AI SDK wrapper."** → Moat is the managed runtime + trace store + multi-tenant metering +
  builder, not the loop itself. Keep definitions portable to earn trust, monetize the platform.
- **Model/provider volatility.** → Route via AI Gateway with `provider/model` strings; swap models
  without code changes; support failover.
- **Untrusted tool execution.** → Sandbox executors (isolated runtime, no ambient credentials, egress
  allowlists); MCP tools run out-of-process.
- **Trace cost/volume.** → Tiered retention; sample verbose payloads on high-volume plans.
- **Commoditization by frameworks adding hosting.** → Win on observability UX and agency multi-tenancy.

## Out of scope (v1)

- Visual drag-and-drop graph editor (definitions are JSON + form UI in v1).
- Fine-tuning / model training.
- Autonomous long-running background agents (v1 is request/response runs).
- Built-in vector DB / RAG store (integrate external stores via tools).
- Human-in-the-loop approval queues (roadmap).

## Milestones / roadmap

- **M0 (this scaffold):** agent registry CRUD, tool registry, real tool-calling runtime loop with
  mock fallback, run + trace objects, builder UI with step-by-step trace viewer.
- **M1:** persistent Postgres store, agent versioning, run history dashboard, API keys per org.
- **M2:** MCP tool integration, webhook/HTTP tools with auth, sandboxed executors.
- **M3:** multi-step workflows (chained agents), eval suites against test sets, A/B prompt comparison.
- **M4:** agency multi-tenant billing + per-client usage export, shareable run viewer, SSO.
- **M5:** self-hosted runtime, streaming runs, human-in-the-loop steps, alerting on failure spikes.
