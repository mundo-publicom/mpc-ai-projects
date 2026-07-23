# Technical Spec — AI Lead Generation

## System overview

A Next.js (App Router) application with a thin client dashboard and Node.js API routes that
orchestrate the lead pipeline: **ICP → discovery → enrichment → scoring → outreach → export**.
Domain logic lives entirely in `lib/`; routes are thin controllers that validate input, call the
domain layer, and return typed JSON. AI is accessed through the Vercel AI SDK via `"provider/model"`
strings routed through the AI Gateway. The whole system degrades to a deterministic path when no AI
key is present, so it is always demoable.

```
app/
  layout.tsx                     Root layout
  page.tsx                       Dashboard (client): ICP form + leads table + export
  globals.css
  api/leads/generate/route.ts    POST — enrich + score + write outreach
  api/leads/export/route.ts      POST — CSV download
components/
  IcpForm.tsx                    Client — ICP capture
  LeadsTable.tsx                 Client — scored leads + export button
lib/
  types.ts                       Zod schemas + inferred types (single source of truth)
  ai.ts                          Model registry + hasAI() + AI SDK re-exports
  scoring.ts                     Deterministic scorer, band logic, reconcile, prioritize
  mock.ts                        Seed data + mock enrichment (zero-key path)
  leads.ts                       Orchestration: AI generateObject + fallback
  csv.ts                         RFC-4180 CSV serialization
```

## Component breakdown

- **Dashboard (`app/page.tsx`)** — client component holding UI state (leads, meta, loading, error).
  Calls the two API routes via `fetch`; triggers CSV download from a Blob.
- **`IcpForm`** — captures free-text ICP + structured fields (industries, sizes, regions, titles,
  signals, value prop, exclusions) and sample size; emits a typed `Icp`.
- **`LeadsTable`** — renders prioritized leads with score band pills, company/contact, why-a-fit,
  and suggested opener; hosts the export button.
- **`lib/leads.ts`** — the orchestrator. Builds candidates, chooses AI vs. deterministic path,
  reconciles AI scores with rule-based scores, prioritizes, and reports credits + fallback status.
- **`lib/scoring.ts`** — transparent, testable rule-based scorer used both as fallback and as a
  clamp on AI output.
- **`lib/mock.ts`** — fictional company seeds + mock enrichment sources for the zero-key path.
- **`lib/csv.ts`** — pure serialization, no framework deps.

## Data models (typed)

All models are defined once as zod schemas in `lib/types.ts` and inferred into TypeScript types, so
the same definition validates API I/O, structures AI output, and types the UI.

### ICP

```ts
type CompanySize = "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1001-5000" | "5000+";

interface Icp {
  description: string;          // free-text; AI can parse into the fields below
  industries: string[];
  companySizes: CompanySize[];
  regions: string[];
  targetTitles: string[];       // buying-committee roles
  buyingSignals: string[];      // e.g. "hiring SDRs", "uses HubSpot"
  valueProposition: string;     // what we sell — personalizes outreach
  exclusions: string[];         // hard disqualifiers
}
```

### EnrichmentSource

```ts
type EnrichmentProvider =
  | "apollo" | "clearbit" | "hunter" | "peopledatalabs"
  | "linkedin" | "builtwith" | "mock";

interface EnrichmentSource {
  provider: EnrichmentProvider;
  confidence: number;   // 0-1 match confidence
  fields: string[];     // which fields this source contributed (provenance)
  fetchedAt: string;    // ISO timestamp
}
```

### Score

```ts
type ScoreBand = "hot" | "warm" | "cool" | "cold";

interface Score {
  value: number;        // 0-100 overall fit
  band: ScoreBand;
  breakdown: {
    industryFit: number;    // 0-100
    sizeFit: number;
    titleFit: number;
    signalStrength: number;
  };
  reasoning: string;    // one-line human explanation
}
```

### Lead

```ts
interface LeadCompany {
  name: string; domain: string; industry: string;
  size: CompanySize; region: string; description: string;
}
interface LeadContact {
  fullName: string; title: string; email: string;
  emailStatus: "verified" | "guessed" | "unknown";
  linkedinUrl?: string;
}
interface Lead {
  id: string;
  company: LeadCompany;
  contact: LeadContact;
  score: Score;
  whyAFit: string;
  suggestedOpener: string;      // AI-written first touch
  sources: EnrichmentSource[];  // provenance for compliance
  createdAt: string;
}
```

### Campaign

```ts
type CampaignStatus = "draft" | "generating" | "ready" | "exported" | "archived";

interface Campaign {
  id: string; name: string;
  icp: Icp; status: CampaignStatus;
  leads: Lead[];
  creditsUsed: number;
  createdAt: string; updatedAt: string;
}
```

`Campaign` is modeled for the persistence milestone (M2); the MVP scaffold operates on a single
in-flight list and does not yet persist campaigns.

## API surface

### `POST /api/leads/generate`

Enrich + score + write outreach for sample leads.

Request:
```jsonc
{
  "icp": { /* Icp */ },
  "count": 8            // 1-25, default 8
}
```

Response `200`:
```jsonc
{
  "leads": [ /* Lead[], sorted by score desc */ ],
  "meta": {
    "usedAI": true,
    "model": "anthropic/claude-sonnet-5",  // null on fallback
    "creditsUsed": 8,
    "generatedAt": "2026-07-23T12:00:00.000Z"
  }
}
```

Errors: `400` invalid JSON, `422` schema validation failure (returns `zod` flattened issues),
`500` unexpected.

### `POST /api/leads/export`

Request:
```jsonc
{ "leads": [ /* Lead[] */ ], "format": "csv" }
```

Response `200`: `text/csv` attachment (`Content-Disposition: attachment; filename="leads-YYYY-MM-DD.csv"`).
Errors: `400`, `422` as above.

Both routes run on `runtime = "nodejs"` and are `dynamic = "force-dynamic"`.

## AI / model usage

- **Access pattern.** `lib/ai.ts` exposes a `MODELS` registry (`fast` → `claude-haiku-4-5`,
  `smart` → `claude-sonnet-5`, `frontier` → `claude-opus-4-8`) and `hasAI()`. All calls use plain
  `"provider/model"` strings through the AI Gateway; no provider SDK.
- **Lead scoring + outreach (`generateObject`).** In `lib/leads.ts`, a single `generateObject` call
  on `MODELS.smart` (`anthropic/claude-sonnet-5`) with `temperature: 0.4` fills a zod schema:

  ```ts
  const AiLeadEnrichmentSchema = z.object({
    results: z.array(z.object({
      id: z.string(),
      score: ScoreSchema,                 // reuses the domain Score schema
      whyAFit: z.string(),
      suggestedOpener: z.string(),
    })),
  });
  ```

  The system prompt constrains the model to (1) score fit honestly with sub-scores, (2) explain the
  fit, (3) write a ≤40-word personalized opener — and forbids inventing contact facts or false
  claims. The model receives the ICP and candidate company/title context only; it never authors
  emails/names.
- **ICP parsing (roadmap-ready).** The same `generateObject` pattern normalizes free-text ICP into
  the structured `Icp` schema when fields are left blank.
- **Guardrails.** AI scores are reconciled with the deterministic scorer (`reconcileScore`:
  60% AI / 40% rule-based, re-banded) so a hallucinated score can't override an obvious poor fit.
  Any model error is caught and the request degrades to the deterministic path — it never 500s on a
  model hiccup.

## Third-party integrations

- **Enrichment (M1):** Apollo, Clearbit, Hunter (email verification), People Data Labs, BuiltWith
  (tech stack signals). Abstracted behind the `EnrichmentSource` provenance model and a pluggable
  provider interface; a waterfall tries providers by cost/confidence. Keys in `.env`.
- **CRM (M3):** HubSpot (private-app token) and Salesforce (OAuth) one-way push; field mapping from
  `Lead` to CRM objects.
- **Senders (M4):** Instantly / Smartlead to hand off list + openers for compliant sending.
- **AI Gateway:** Vercel AI Gateway for model routing, keyed by `AI_GATEWAY_API_KEY`.

## Security & privacy

- **No secrets in repo.** All keys via `.env.example` → `.env.local`.
- **Input validation.** Every route validates with zod before touching domain logic.
- **Data provenance.** Each `Lead` carries `sources[]` recording which provider supplied which
  fields and when — the basis for GDPR/CCPA data-subject access and erasure responses.
- **Lawful basis.** B2B contact processing under legitimate interest; DPAs with enrichment vendors
  (operational requirement, not code).
- **CAN-SPAM / GDPR sending.** The product drafts but does not send; unsubscribe, sender identity,
  and physical-address requirements are enforced in the downstream sending tool. In-app guidance
  documents this boundary.
- **Least data.** The scoring model receives only ICP + company/title context, not full PII.

## Observability

- Structured `console` logs (JSON-friendly) on each generation: `usedAI`, `model`, `creditsUsed`,
  and fallback reason on AI failure. Ready to route to Vercel logs / an APM.
- Response `meta` echoes engine + credits so the client and any caller can audit each request.
- Roadmap: per-request trace IDs, enrichment vendor latency/error metrics, credit-ledger events.

## Scaling considerations

- **Stateless routes** on Node.js Fluid Compute scale horizontally; no in-memory session state.
- **Batching.** One `generateObject` call scores the whole candidate batch, minimizing model
  round-trips and cost.
- **Caching.** Enrichment results are cache-candidates keyed by domain/email (M1) to cut COGS and
  latency; deterministic scorer is pure and trivially cacheable.
- **Backpressure.** `count` capped at 25/request in the sample tier; bulk jobs move to a queue in
  M2.
- **Cost control.** `MODELS.fast` available for high-volume/low-stakes scoring; `smart` default for
  quality copy.

## Testing strategy

- **Unit — scoring (`lib/scoring.ts`).** Pure functions: `computeScore`, `bandFor`, `reconcileScore`,
  `prioritize`. Table-driven tests over ICP/lead fixtures, including exclusion penalties and
  boundary bands (39/40/59/60/79/80).
- **Unit — CSV (`lib/csv.ts`).** Escaping of commas, quotes, and newlines; header/row alignment.
- **Contract — API routes.** Valid payload → typed response shape; malformed JSON → 400; schema
  violation → 422 with issues; force AI error → deterministic fallback with `usedAI:false`.
- **Integration — orchestration (`lib/leads.ts`).** With `hasAI()` false, deterministic leads;
  with a mocked `generateObject`, AI scores reconciled and ids matched back to candidates.
- **Type-level.** `tsc --noEmit` in CI; zod schemas are the single source of truth so drift fails
  the build.
- **E2E (roadmap).** Playwright: fill ICP → generate → export CSV; assert download contents.
