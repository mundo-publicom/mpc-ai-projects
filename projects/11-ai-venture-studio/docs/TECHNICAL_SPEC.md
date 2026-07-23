# Technical Spec — AI Venture Studio

## System overview

A Next.js (App Router) application with a single core backend route that runs an
AI validation sprint. The client dashboard captures an idea and renders the
returned report. All domain logic, types, and AI orchestration live in `lib/`;
components are presentational. Model calls route through the Vercel AI Gateway
via `"provider/model"` strings using the AI SDK v5 `generateObject` primitive
against a zod schema. When no AI key is present, the route serves a
deterministic, idea-seeded mock report so the whole product is demoable offline.

```
app/
  layout.tsx                 root layout + metadata
  page.tsx                   "use client" studio dashboard
  globals.css                Tailwind entry + base styles
  api/validate/route.ts      POST — core validation sprint (real + mock)
components/
  IdeaForm.tsx               idea intake (client)
  ValidationReport.tsx       full report view: gauge, TAM, table, MVP, risks
  LeanCanvasGrid.tsx         nine-block Lean Canvas grid
lib/
  ai.ts                      model catalog, zod schema, prompts, mock, assembler
  types.ts                   domain types (single source of truth)
  canvas.ts                  Lean Canvas layout + render helpers
```

## Component breakdown

- **`app/page.tsx` (client).** Orchestrates intake → `fetch("/api/validate")` →
  report render. Maintains local state: `loading`, `error`, current `report`,
  and a session `history` (venture pipeline). No server state in v1.
- **`components/IdeaForm.tsx` (client).** Controlled form with validation
  (title required, description ≥ 20 chars), example loaders, and a submit that
  emits a typed `ValidateRequest`.
- **`components/ValidationReport.tsx` (server-capable).** Pure presentational
  render of a `ValidationReport`: SVG score gauge, TAM/SAM/SOM cards, competitor
  table, segment cards, Lean Canvas, MVP checklist, risk register, landing copy.
- **`components/LeanCanvasGrid.tsx`.** Renders `LeanCanvas` via
  `toRenderableCanvas` on a 5×3 CSS grid; scrolls horizontally on narrow screens.
- **`lib/ai.ts`.** `MODELS`, `hasAI()`, the `validationSchema` (zod), the system
  prompt, `buildValidationPrompt`, `mockValidation`, and `assembleReport`.
- **`lib/types.ts`.** All domain types.
- **`lib/canvas.ts`.** Canonical Lean Canvas block layout + flatten helpers.

## Data models (typed)

Defined in `lib/types.ts`. Key models:

```ts
interface Idea {
  id: string; title: string; description: string;
  market?: string; businessModel?: string;
  stage?: VentureStage; createdAt: string;
}

interface MarketSizeEstimate { valueUsd: number; display: string; basis: string; }
interface MarketAnalysis {
  tam: MarketSizeEstimate; sam: MarketSizeEstimate; som: MarketSizeEstimate;
  cagr: number; assumptions: string[]; tailwinds: string[]; summary: string;
}

interface Competitor {
  name: string; type: "direct" | "indirect" | "substitute";
  description: string; strengths: string[]; weaknesses: string[];
  pricePosition: "low" | "mid" | "premium" | "unknown";
}

interface CustomerSegment {
  name: string; painLevel: "low" | "medium" | "high" | "acute";
  description: string; willingnessToPay: string;
}

interface LeanCanvas {
  problem: string[]; customerSegments: string[]; uniqueValueProposition: string;
  solution: string[]; channels: string[]; revenueStreams: string[];
  costStructure: string[]; keyMetrics: string[]; unfairAdvantage: string;
}

interface MvpFeature {
  name: string; description: string;
  priority: "must" | "should" | "could" | "wont";
  effortDays: number; userStory: string;
}
interface MvpSpec {
  goal: string; riskiestAssumption: string; features: MvpFeature[];
  successMetrics: string[]; buildEstimateWeeks: number;
}

interface Risk {
  category: "market" | "technical" | "financial" | "regulatory" | "team" | "competitive";
  description: string; severity: "low" | "medium" | "high"; mitigation: string;
}

interface ValidationReport {
  ideaId: string; ideaTitle: string; score: number; verdict: string;
  recommendation: "pursue" | "investigate" | "pivot" | "pass";
  market: MarketAnalysis; competitors: Competitor[]; segments: CustomerSegment[];
  canvas: LeanCanvas; mvp: MvpSpec; risks: Risk[]; landing: LandingCopy;
  mocked: boolean; latencyMs: number; generatedAt: string;
}
```

The zod `validationSchema` in `lib/ai.ts` mirrors the AI-generated core of
`ValidationReport` (everything except `ideaId`/`ideaTitle`/`mocked`/`latencyMs`/
`generatedAt`, which `assembleReport` attaches server-side).

## API surface

### `POST /api/validate`

Runtime: `nodejs`. `maxDuration = 60`.

Request body (zod-validated):

```ts
{
  title: string;          // 1..120
  description: string;    // 20..6000
  market?: string;        // ..400
  businessModel?: string; // ..400
}
```

Responses:

- `200` → `ValidationReport` (JSON). `x-fallback-reason` header present when a
  model error caused a mock fallback.
- `400` → `{ error: "Invalid JSON body" }`.
- `422` → `{ error: "Validation failed", details }` (zod `flatten()`).

Flow: parse → zod-validate → if `!hasAI()` return mock report → else
`generateObject({ model: MODELS.frontier, schema: validationSchema, system,
prompt, temperature: 0.6 })` → `assembleReport` → return; on throw, mock
fallback with header.

## AI / model usage

- **SDK:** Vercel AI SDK v5, `generateObject` for typed structured output.
- **Gateway routing:** `"provider/model"` strings, no provider SDK. Catalog:
  `fast: anthropic/claude-haiku-4-5`, `smart: anthropic/claude-sonnet-5`,
  `frontier: anthropic/claude-opus-4-8`.
- **Multi-section structured generation:** a single call yields all sections —
  market, competitors, segments, Lean Canvas, MVP scope, risks, landing copy —
  each constrained by the composed zod schema (min/max array sizes, enums,
  numeric ranges) so output is well-formed and directly renderable. This keeps
  the sections mutually consistent (one reasoning pass) and simplifies the
  contract vs. orchestrating one call per section.
- **Prompting:** a skeptical, quantitative analyst system prompt with an
  explicit scoring rubric; per-idea user prompt built by `buildValidationPrompt`.
  Temperature 0.6 balances creativity and consistency.
- **Model choice:** frontier by default for the depth of a multi-section report;
  swap to `MODELS.smart` to trade quality for cost/latency.
- **Fallback:** `mockValidation` seeds numbers from a hash of the idea text so
  mock reports are plausible and stable across reloads.

## Third-party integrations

- **Vercel AI Gateway** (required for real generation) — model access + usage.
- **Market-data provider** (roadmap, `MARKET_DATA_API_KEY`) — ground TAM/SAM/SOM
  in real category-spend data instead of model estimates.
- **Product analytics** (roadmap, `ANALYTICS_WRITE_KEY`) — funnel events
  (idea_submitted, report_viewed, sprint_completed) feeding the KPI dashboards.
- **Persistence** (roadmap) — Vercel Postgres/Blob for ventures + reports.

## Security & privacy

- No secrets in the repo; keys via `.env.local` only.
- All request input validated and length-bounded with zod (DoS/abuse guard).
- Node.js runtime; no client-side model keys — all model calls are server-side.
- Idea text is user IP: v1 keeps nothing server-side beyond the request; a
  persistence layer (roadmap) must add per-workspace access control and a
  retention/delete policy.
- Errors never leak provider internals to the client beyond an error name in a
  response header.

## Observability

- `latencyMs` recorded per report; `mocked` flag distinguishes real vs. mock.
- `x-fallback-reason` header exposes model-error fallbacks for monitoring.
- Roadmap: structured logs + analytics events for KPI tracking (ideas validated,
  sprint throughput), and model-cost tracking via the AI Gateway dashboard.

## Scaling considerations

- Stateless route → scales horizontally on Vercel Fluid Compute.
- Single generation call bounds cost/latency per sprint; `maxDuration` caps
  runaway calls.
- Roadmap: cache reports for common/duplicate idea spaces; queue + async result
  for the operator-reviewed tier; rate-limit per workspace.

## Testing strategy

- **Unit:** `mockValidation` determinism (same input → same output), `money`
  formatting, `toRenderableCanvas` layout mapping, scoring→recommendation map.
- **Schema:** `validationSchema.parse` accepts a known-good object and rejects
  malformed ones (missing sections, out-of-range score).
- **Route (integration):** `POST /api/validate` — happy path (mock mode returns
  a valid `ValidationReport`), 400 on bad JSON, 422 on invalid body, and
  fallback-on-error behavior with the `x-fallback-reason` header.
- **Component:** `ValidationReport` renders every section for a sample report;
  `LeanCanvasGrid` renders all nine blocks.
- **E2E (roadmap):** Playwright — submit an example idea, assert the report view
  renders score, TAM, competitor table, canvas, and MVP checklist.
