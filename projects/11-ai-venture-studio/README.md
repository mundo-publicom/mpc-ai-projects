# AI Venture Studio

> **Business case.** A venture studio productizes the riskiest, slowest part of
> building a company: figuring out whether an idea is worth building at all.
> Aspiring founders, corporate intrapreneurs, and the studio's own operators pay
> for **fixed-fee validation sprints** — a single idea goes in, and a complete,
> defensible validation report comes out (market/TAM with assumptions,
> competitor scan, customer segments, a Lean Canvas, an MVP feature spec, and
> landing-page copy). The studio then compounds: ideas that clear the bar get
> spun out into real ventures, and the studio keeps **equity or a revenue-share**
> in each. Sprint fees fund the machine; the equity portfolio is the upside.

The whole app is demoable with **zero configuration** — without an AI key it
serves deterministic, idea-aware mock reports so the end-to-end flow works
offline. Add `AI_GATEWAY_API_KEY` to generate real, idea-specific validations.

---

## What it does

The pipeline turns one idea into a full validation report in a single pass:

1. **Idea intake** — capture the venture name, description, and optional
   market/business-model hints.
2. **AI validation sprint** — one structured `generateObject` call produces
   every section against a strict zod schema.
3. **Validation report view** — score gauge + verdict, TAM/SAM/SOM with
   assumptions, a competitor table, customer segments, the Lean Canvas grid, an
   MVP checklist (MoSCoW + effort), a risk register, and landing-page copy.
4. **Studio pipeline** — validated ventures accumulate in a sidebar so an
   operator can run the studio across many ideas.

## Features

- One-call, multi-section structured generation (`generateObject` + zod).
- Nine-block **Lean Canvas** rendered in its canonical grid layout.
- MVP spec with MoSCoW priorities, engineer-day estimates, and user stories.
- Honest, discriminating **viability score** mapped to a pursue/investigate/
  pivot/pass recommendation.
- Graceful **mock fallback** — full demo with no keys; never fails a sprint even
  if the model errors.
- TypeScript strict, Tailwind, App Router, Node.js runtime.

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # optional: add AI_GATEWAY_API_KEY for real reports
pnpm dev                     # http://localhost:3000
```

Then open the dashboard, load an example idea (or write your own), and run a
validation sprint. With no key set you'll see mock output; with a key you'll get
a real, idea-specific report.

### Core API

```
POST /api/validate
Content-Type: application/json

{ "title": "ShiftMate", "description": "AI scheduling copilot for restaurants…",
  "market": "Independent restaurants, US", "businessModel": "Per-location SaaS" }
```

Returns a typed `ValidationReport` (see `lib/types.ts`).

## Configuration

| Variable             | Required | Purpose                                             |
| -------------------- | -------- | --------------------------------------------------- |
| `AI_GATEWAY_API_KEY` | No\*     | Vercel AI Gateway key for real model calls.         |
| `ANTHROPIC_API_KEY`  | No\*     | Alternative direct provider key.                    |
| `MARKET_DATA_API_KEY`| No       | Future: TAM/market-size enrichment.                 |
| `ANALYTICS_WRITE_KEY`| No       | Future: funnel + sprint-throughput analytics.       |

\* Either AI key enables real generation; absent both, the app serves mocks.

## Monetization

- **Validation sprint** — flat fee per idea (self-serve tier and an assisted
  "operator-reviewed" tier).
- **Studio equity / revenue-share** — spun-out ventures grant the studio equity
  or a revenue-share, turning the sprint funnel into a portfolio.

See [`docs/PRD.md`](docs/PRD.md) for pricing detail and GTM.

## Roadmap

- Persist ventures and reports (DB) with multi-user studio workspaces.
- Live market-data integration for grounded TAM sizing.
- Section-level regeneration and human-in-the-loop editing.
- Auto-generate a deployable landing page + waitlist per venture.
- Cohort analytics: venture survival rate, sprint throughput dashboards.

## Docs

- [`docs/PRD.md`](docs/PRD.md) — product requirements.
- [`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md) — components, data models, API, AI usage.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system diagram, data flow, deployment.
