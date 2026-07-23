# Technical Spec — AI Consulting (Productized)

## System overview

A Next.js 15 (App Router) application in TypeScript strict mode. The consultant dashboard
(`app/page.tsx`) collects a structured intake and calls a single server route,
`POST /api/audit/generate`, which produces a fully-typed **Audit**. The route splits responsibility
cleanly:

- **The AI supplies judgment** — readiness scoring, opportunity ideas with impact/effort/risk
  ratings, roadmap sequencing, and narrative — via Vercel AI SDK v5 `generateObject` constrained by a
  zod schema.
- **The platform supplies economics** — all dollar figures are computed deterministically in
  `lib/roi.ts` from the client's own intake numbers, then attached to each opportunity and aggregated
  into a portfolio ROI.

When no AI key is present (or the AI call errors), the route returns a deterministic mock audit built
from the same finalization pipeline, so the product is fully functional offline.

## Component breakdown

| Layer | File | Responsibility |
| --- | --- | --- |
| Model access | `lib/ai.ts` | `MODELS` map, `hasAI()`, re-exports `generateObject`/`generateText`. Routes `provider/model` strings via AI Gateway. |
| Domain models | `lib/types.ts` | zod schemas + inferred TS types for Client, Intake, Process, RoiEstimate, Opportunity, Roadmap, Audit, Deliverable, and API payloads. |
| ROI engine | `lib/roi.ts` | Deterministic ROI math, quadrant classification, priority ranking, portfolio aggregation. |
| Audit assembly | `lib/audit.ts` | AI draft schema, system prompt + prompt builder, `finalizeAudit()` (draft → costed Audit), `mockAuditDraft()`. |
| API | `app/api/audit/generate/route.ts` | Validate input, call AI or mock, finalize, return typed JSON. |
| UI shell | `app/page.tsx`, `app/layout.tsx` | Dashboard orchestration, layout. |
| UI components | `components/IntakeForm.tsx`, `AuditReport.tsx`, `OpportunityMatrix.tsx` | Intake capture, report rendering, 2×2 matrix. |

## Data models (typed)

All models are zod schemas in `lib/types.ts`; types are `z.infer`red. Summary:

```ts
// Client — the company being audited
Client = { id; companyName; industry: Industry; size: CompanySize;
           contactName; contactEmail; createdAt }

// Process — a unit of work; the atom the ROI engine costs
Process = { name; description; hoursPerWeek; headcount;
            hourlyCostUsd; repetitiveness: "low"|"medium"|"high" }

// Intake — everything captured about the engagement
Intake = { clientId; goals[]; painPoints[]; techStack[];
           aiMaturity: "none"|"experimenting"|"piloting"|"scaling"|"mature";
           dataReadiness: "poor"|"fair"|"good"|"excellent";
           processes: Process[]; annualBudgetUsd; notes }

// RoiEstimate — computed, never AI-emitted
RoiEstimate = { implementationCostUsd; annualRunCostUsd; annualBenefitUsd;
                annualNetUsd; paybackMonths; firstYearRoi;
                confidence: "low"|"medium"|"high"; narrative }

// Opportunity — one backlog item
Opportunity = { id; title; targetProcess; category: OpportunityCategory;
                description; impact:1-5; effort:1-5; risk:1-5;
                quadrant: "quick-win"|"big-bet"|"fill-in"|"money-pit";
                priority; suggestedApproach; roi: RoiEstimate }

// Roadmap — phased sequencing
RoadmapPhase = { name; order; timeframe; objective;
                 opportunities[]; milestones[]; estimatedCostUsd }
Roadmap = { phases: RoadmapPhase[]; horizon }

// Audit — the top-level deliverable
Audit = { id; clientId; readinessScore; readinessBand;
          dimensions: ReadinessDimension[]; executiveSummary;
          strengths[]; gaps[]; opportunities: Opportunity[];
          roadmap: Roadmap; portfolioRoi: RoiEstimate; createdAt }

// Deliverable — a portal artifact wrapping an audit or sub-report
Deliverable = { id; clientId; auditId;
                type: "readiness-audit"|"opportunity-map"|"usecase-backlog"|
                      "roadmap"|"roi-model"|"proposal";
                title; status: "draft"|"in-review"|"delivered"|"accepted";
                fileUrl?; createdAt; updatedAt }
```

The **AI draft** (`AuditDraftSchema` in `lib/audit.ts`) is a deliberately *narrower* schema than
`Audit`: it omits all `RoiEstimate` fields, `id`s, `quadrant`, `priority`, and per-phase cost. Those
are derived deterministically in `finalizeAudit()`, so a model cannot inject unfounded numbers.

## API surface

### `POST /api/audit/generate`

Request (`GenerateAuditRequestSchema`):

```jsonc
{
  "client": { "companyName": string, "industry": Industry, "size": CompanySize,
              "contactName"?: string, "contactEmail"?: string },
  "intake": { "goals": string[], "painPoints": string[], "techStack": string[],
              "aiMaturity": AiMaturity, "dataReadiness": DataReadiness,
              "annualBudgetUsd": number, "notes": string, "processes": Process[] }
}
```

Response (`GenerateAuditResponseSchema`):

```jsonc
{ "audit": Audit,
  "meta": { "usedAI": boolean, "model": string | null, "generatedAt": ISOString } }
```

Status codes: `200` success (AI or mock); `400` invalid JSON; `422` schema validation failure.
On any AI runtime error the route logs and returns `200` with a mock audit (`meta.usedAI=false`).

**Planned routes (v0.2+):** `POST /api/deliverable/export` (PDF), `POST /api/checkout` (Stripe
package), `POST /api/retainer` (subscription), `GET /api/clients` / `GET /api/audits/:id`
(persistence + portal).

## AI / model usage

- **Primitive:** `generateObject` (structured output) from `ai` v5, model `MODELS.smart`
  (`anthropic/claude-sonnet-5`) routed through the Vercel AI Gateway via a `provider/model` string.
- **System prompt:** `AUDIT_SYSTEM_PROMPT` frames the model as a pragmatic senior AI transformation
  consultant, explicitly instructs it to rate impact/effort/risk on 1–5 and to **not** invent dollar
  figures.
- **User prompt:** `buildAuditPrompt()` renders the client profile, goals, pain points, stack, and a
  per-process line (hours/headcount/cost/repetitiveness) so the model grounds opportunities in real
  processes.
- **Schema:** `AuditDraftSchema` (zod) constrains readiness dimensions (exactly 6), 3–10
  opportunities, and ≥2 roadmap phases.
- **Temperature:** `0.4` — enough variation for useful ideation, low enough for stable structure.
- **ROI narrative:** produced deterministically in `lib/roi.ts` (`buildNarrative`), not by the model.

### ROI math (deterministic)

- Annual labor cost of a process = `hoursPerWeek × 48 weeks × hourlyCostUsd`.
- Achievable saving = `AUTOMATION_FACTOR[category] × REPETITIVENESS_MULT[repetitiveness]`.
- Implementation cost scales by effort (1–5) via `EFFORT_COST_USD`; run cost = 18% of implementation.
- `annualNet = benefit − runCost`; `payback = implementation / net × 12`;
  `firstYearRoi = (net − implementation) / implementation`.
- Confidence derived from data readiness vs. effort.
- `aggregateRoi()` sums the backlog into a portfolio figure; `prioritize()` ranks by a blended
  impact/ROI/effort/risk weight and assigns `priority`.

## Third-party integrations

| Integration | Purpose | Status | Env |
| --- | --- | --- | --- |
| Vercel AI Gateway | LLM access (`generateObject`) | live | `AI_GATEWAY_API_KEY` (or `ANTHROPIC_API_KEY`) |
| Stripe | Fixed-price audit checkout + retainer subscriptions | hooked (v0.3) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Cal.com / Calendly | Discovery + roadmap-readout scheduling | hooked (v0.3) | `CAL_API_KEY`, `NEXT_PUBLIC_SCHEDULING_URL` |
| PDF export service | Branded deliverable/proposal export | hooked (v0.2) | `PDF_EXPORT_API_KEY` |

## Security & privacy (client data handling)

- **Sensitivity.** Intake contains proprietary business data (processes, costs, stack). Treat as
  confidential.
- **Minimization.** Collect only what the ROI model and audit need; free-text `notes` are optional.
- **No secrets in repo.** All keys via `.env.example` → `.env.local`; nothing committed.
- **Isolation (v0.2+).** Per-client row-level isolation in the datastore; consultants only access
  their own clients.
- **In transit / at rest.** HTTPS everywhere; encrypt intake + audits at rest; scoped access to the
  portal.
- **No training on client data.** Gateway calls are inference-only; document a no-retention posture.
- **Input validation.** All request bodies validated with zod before use; unknown fields rejected by
  strict schemas.
- **Output safety.** AI never emits financial figures; deterministic engine bounds the economics.

## Observability

- Structured `console.error` on AI failure with a clear fallback marker
  (`[audit/generate] falling back to mock`).
- `meta.usedAI` and `meta.model` on every response for downstream analytics (AI vs. mock ratio,
  model attribution).
- **Planned:** per-audit event logging (intake size, generation latency, token usage), win-rate and
  retainer-conversion funnels tied to `Deliverable` status transitions.

## Scaling considerations

- **Stateless route** on Node.js Fluid Compute — scales horizontally; one `generateObject` call per
  audit bounds cost/latency.
- **Deterministic ROI** is pure CPU (microseconds) — no external dependency in the hot path.
- **Caching:** audits are idempotent for a given intake; can memoize by an intake hash in v0.2.
- **Persistence (v0.2):** Postgres (Neon) for clients/intakes/audits/deliverables; blob storage for
  exported PDFs.
- **Cost control:** single call, moderate schema; upgrade to `MODELS.frontier` only for enterprise
  audits.

## Testing strategy

- **Unit (pure, high-value):** `lib/roi.ts` — labor math, payback/ROI, quadrant boundaries,
  `prioritize` ordering, `aggregateRoi` sums and confidence selection. Deterministic, no mocks.
- **Contract:** `AuditDraftSchema` / `GenerateAuditResponseSchema` parse round-trips;
  `finalizeAudit()` produces a schema-valid `Audit` from both AI and mock drafts.
- **Route:** `POST /api/audit/generate` returns 422 on bad input, 200 + mock when `!hasAI()`, and
  never throws on simulated AI error.
- **Component:** `IntakeForm` builds a valid payload; `AuditReport`/`OpportunityMatrix` render a
  sample audit without runtime errors.
- **Type-level:** `tsc --noEmit` in CI as the first gate.
