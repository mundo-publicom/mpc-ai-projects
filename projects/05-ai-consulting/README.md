# AI Consulting — Productized AI-Readiness Audits

> **Business case.** Independent AI consultants and boutique agencies sell strategy work that is slow to produce and hard to standardize. This platform productizes it: a client fills in a structured intake (processes, stack, goals, budget), and the system generates a complete **AI-Readiness Audit** — readiness score, opportunity map, an ROI-costed use-case backlog, and a phased implementation roadmap — in minutes instead of weeks. **Who pays:** the consultant/agency (SaaS-style seat/usage) and, through them, SMB clients. **For what:** fixed-price audit packages ($2.5k–$15k) and recurring monthly retainers ($3k–$12k/mo) for implementation and portal access. The tool doubles as the delivery engine and the client-facing portal, so the same artifact that wins the deal also fulfills it.

---

## What it does

1. **Intake** — capture a company's processes (hours, headcount, cost, repetitiveness), tech stack, goals, pain points, AI maturity, data readiness, and budget.
2. **Analyze & generate** — an AI call (`generateObject` + zod) produces the audit's *judgment*: readiness scoring across six dimensions, a concrete backlog of buildable use cases with impact/effort/risk ratings, and a sequenced roadmap.
3. **ROI, computed not guessed** — every dollar figure (labor saved, run cost, payback, first-year ROI, portfolio total) is calculated deterministically in `lib/roi.ts` from the client's own numbers, so the headline economics are defensible.
4. **Deliver** — the report view (readiness gauge, dimension bars, 2×2 opportunity matrix, prioritized backlog table, roadmap timeline) is the deliverable and the client portal.

## Key features

- **Structured audit generation** via Vercel AI SDK v5 `generateObject` with a strict zod schema.
- **Deterministic ROI engine** (`lib/roi.ts`) — transparent assumptions, quadrant classification, priority ranking, portfolio aggregation.
- **Graceful mock fallback** — with no API key, `/api/audit/generate` returns a coherent, client-specific mock audit so the demo runs end-to-end offline.
- **Opportunity matrix** — impact × effort 2×2 with quick-wins/big-bets/fill-ins/deprioritize quadrants.
- **Phased roadmap** with per-phase estimated cost derived from the backlog.
- **Typed end-to-end** — one zod definition validates the API, structures the AI output, and types the UI.

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # optional — runs with mock data if left blank
pnpm dev                     # http://localhost:3000
```

A sample intake is pre-loaded, so you can click **Generate AI-Readiness Audit** immediately.

To generate **live** audits, set `AI_GATEWAY_API_KEY` (Vercel AI Gateway) in `.env.local`. Models are referenced as plain `provider/model` strings (`anthropic/claude-sonnet-5`) — no provider SDK wiring.

### Core endpoint

`POST /api/audit/generate`

```jsonc
{
  "client": { "companyName": "Acme Widgets Co.", "industry": "ecommerce", "size": "51-200" },
  "intake": {
    "goals": ["Reduce support response times"],
    "techStack": ["Shopify", "Zendesk"],
    "aiMaturity": "experimenting",
    "dataReadiness": "fair",
    "annualBudgetUsd": 60000,
    "processes": [
      { "name": "Customer support", "hoursPerWeek": 120, "headcount": 4, "hourlyCostUsd": 45, "repetitiveness": "high" }
    ]
  }
}
```

Returns `{ audit, meta }` — `meta.usedAI` tells you whether it was AI-generated or mock.

## Monetization

| Package | Price | What's included |
| --- | --- | --- |
| **Starter Audit** | $2,500 fixed | Readiness audit + top-5 opportunity map + ROI model |
| **Growth Audit** | $7,500 fixed | Full backlog, roadmap, exec readout, proposal deck |
| **Enterprise Audit** | $15,000 fixed | Multi-department, governance review, board-ready pack |
| **Retainer** | $3k–$12k/mo | Implementation, portal access, quarterly re-audit |

Platform revenue (for the agency running it): per-seat SaaS + usage-based audit credits.

## Roadmap

- **v0.1 (this scaffold)** — intake → AI audit → report view, deterministic ROI, mock fallback.
- **v0.2** — persistence (Postgres), multi-client dashboard, PDF export of deliverables.
- **v0.3** — Stripe checkout for audit packages + retainer subscriptions; scheduling for readouts.
- **v0.4** — client portal auth, deliverable versioning, acceptance sign-off.
- **v0.5** — benchmarking against anonymized cohort data; re-audit deltas over time.

## Project layout

```
app/
  page.tsx                       consultant dashboard (intake → audit report)
  api/audit/generate/route.ts    real audit generation (generateObject + mock fallback)
components/
  IntakeForm.tsx  AuditReport.tsx  OpportunityMatrix.tsx
lib/
  ai.ts     model access + hasAI()
  types.ts  zod domain models (Client, Intake, Audit, Opportunity, RoiEstimate, Roadmap, Deliverable)
  roi.ts    deterministic ROI math
  audit.ts  AI draft schema, prompt, finalize (draft → costed Audit), mock draft
docs/       PRD.md  TECHNICAL_SPEC.md  ARCHITECTURE.md
```
