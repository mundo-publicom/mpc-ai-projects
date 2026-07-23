# Technical Spec — AI Copywriting Studio

## System overview

A Next.js 15 (App Router) application. The browser renders a client-side **studio** that collects
a brand-voice profile, a brief, a copy type, and a variant count, then POSTs them to a single
Node.js API route. That route runs a **two-pass AI pipeline** — generate drafts, then critique and
score them — reconciles the AI scores against a deterministic heuristic layer, and returns ranked,
typed variants. When no API key is present (or a model call fails), the same route serves fully
formed mock variants so the product is always demoable.

All AI calls route through the **Vercel AI Gateway** via plain `"provider/model"` strings using the
Vercel AI SDK v5 (`generateObject`). No provider SDK is wired directly.

## Component breakdown

| Layer | Path | Responsibility |
| --- | --- | --- |
| Studio UI | `app/page.tsx` | Client component: form state, calls the API, renders results. |
| Brand voice form | `components/BrandVoiceForm.tsx` | Controlled inputs for the `BrandVoice` model. |
| Brief form | `components/BriefForm.tsx` | Controlled inputs for the `Brief` model. |
| Variant card | `components/VariantCard.tsx` | Renders one `Variant`: content, scores, framework tag, safety, copy button. |
| API route | `app/api/copy/generate/route.ts` | Core value path: validate → generate → critique → reconcile → rank. |
| Model layer | `lib/ai.ts` | `MODELS`, `hasAI()`, prompt builders, `generateObject` re-export. |
| Domain types | `lib/types.ts` | zod schemas + inferred types for every model and payload. |
| Frameworks | `lib/frameworks.ts` | AIDA/PAS/FAB/BAB/4Ps definitions, rotation, prompt rendering. |
| Mock + heuristics | `lib/mock.ts` | Deterministic generation, heuristic critique, AI/heuristic reconciliation. |

**Separation of concerns:** all domain logic lives in `lib/`; components hold only UI state; the
route orchestrates but delegates generation/scoring to `lib/`.

## Data models (typed)

Defined in `lib/types.ts` (zod → inferred TS). Summary:

```ts
type CopyType =
  | "google_ad" | "meta_ad" | "cold_email" | "nurture_email"
  | "landing_section" | "product_description" | "headline";

interface BrandVoice {
  name: string;
  tone: string[];
  audience: string;
  readingLevel: "simple" | "conversational" | "professional" | "expert";
  doList: string[];
  avoidList: string[];
  powerWords: string[];
  forbiddenWords: string[];   // hard brand-safety blocklist
  sample: string;             // on-brand writing sample
}

interface Brief {
  product: string;
  audience: string;
  goal: "awareness" | "clicks" | "leads" | "sales" | "signups" | "retention";
  keyBenefits: string[];
  proofPoints: string[];
  cta: string;
  keywords: string[];
  constraints: string;
}

type FrameworkId = "AIDA" | "PAS" | "FAB" | "BAB" | "4Ps";

interface CopyContent {          // flat so one schema covers every copy type
  headline: string;
  subheadline?: string;
  body: string;
  cta?: string;
  altHeadlines?: string[];       // RSA extras (google_ad)
  altDescriptions?: string[];
}

interface Critique {
  overallScore: number;          // 0-100
  breakdown: { clarity; persuasion; brandFit; brevity; ctaStrength };  // each 0-100
  framework: FrameworkId;
  rationale: string;
  suggestions: string[];
  brandSafety: { passed: boolean; flags: string[] };
  plagiarismRisk: "low" | "medium" | "high";
}

interface Variant {
  id: string;
  copyType: CopyType;
  framework: FrameworkId;
  content: CopyContent;
  critique: Critique;
}
```

The generation pass uses a **lean** schema (`DraftSchema = { framework, content }`) so the model
returns exactly the creative payload; `id` and `critique` are attached server-side. The critique
pass uses `CritiqueListSchema = { critiques: Critique[] }`.

## API surface

### `POST /api/copy/generate`

**Request** (`GenerateCopyRequestSchema`):

```jsonc
{
  "brandVoice": { /* BrandVoice */ },
  "brief": { /* Brief */ },
  "copyType": "meta_ad",
  "count": 3            // 1..8, default 3
}
```

**Response 200** (`GenerateCopyResponseSchema`):

```jsonc
{
  "variants": [ /* Variant[], sorted by overallScore desc */ ],
  "meta": {
    "usedAI": true,
    "model": "anthropic/claude-sonnet-5",   // null in mock mode
    "creditsUsed": 6,                        // 2 per variant
    "copyType": "meta_ad",
    "generatedAt": "2026-07-23T..."
  }
}
```

**Errors:** `400` invalid JSON; `422` zod validation failure (`{ error, details }`). Model or
gateway failures never surface as errors — the route degrades to mock variants and sets an
`x-fallback-reason` response header.

## AI / model usage

- **Model access:** `lib/ai.ts` exposes `MODELS = { fast: anthropic/claude-haiku-4-5, smart:
  anthropic/claude-sonnet-5, frontier: anthropic/claude-opus-4-8 }`. Default is `smart`.
- **Pass 1 — generation.** `generateObject({ model: smart, schema: DraftListSchema, system, prompt,
  temperature: 0.8 })`. The system prompt embeds the rendered brand voice and assigns one framework
  per draft (via `frameworkRotation(copyType, count)`), instructing the model to hit each
  framework's beats, respect all do/don't and forbidden-word rules, and avoid fabricated claims.
- **Pass 2 — critique/scoring.** `generateObject({ model: smart, schema: CritiqueListSchema, system,
  prompt, temperature: 0.2 })`. Lower temperature for consistent grading. The prompt lists the
  drafts; the system prompt tells the model to score honestly, judge framework execution, and run a
  brand-safety + plagiarism assessment.
- **Reconciliation.** Every draft is *also* scored by `heuristicCritique` (deterministic). AI and
  heuristic critiques are blended in `reconcileCritique` (60/40 on the headline score); a heuristic
  brand-safety failure overrides an AI pass and caps the score; plagiarism risk takes the higher of
  the two. This guarantees safety checks never depend solely on the model.
- **Fallbacks (layered):** no key → mock; empty generation → mock; critique-pass failure → keep the
  real drafts, score them heuristically; any thrown error → mock. The request always returns 200.

## Third-party integrations

- **Vercel AI Gateway** (live): model routing + usage/cost tracking via `AI_GATEWAY_API_KEY`.
- **Ad platforms** (roadmap, env placeholders): Google Ads API (push variants as RSA assets), Meta
  Marketing API (create ad creative). Mapping uses `CopyContent.altHeadlines/altDescriptions`.
- **ESPs** (roadmap): SendGrid / Customer.io / Klaviyo to sync email variants into sequences.
- **Billing** (roadmap): Stripe for credit purchase; a credit ledger meters `meta.creditsUsed`.
- **Plagiarism** (roadmap): real trademark/plagiarism API replacing the cliché heuristic.

## Security & privacy

- No secrets in the repo. Keys via `.env.example` → `.env.local`; server-only (never shipped to
  the client).
- Route validates all input with zod (`422` on failure) and caps `count` server-side.
- Brand voice and briefs are treated as customer data: no training on user content; per-workspace
  isolation and retention controls on the roadmap.
- Brand-safety enforcement is deterministic and server-side so it cannot be bypassed by prompt
  manipulation.
- Node.js runtime only; no edge-only APIs.

## Observability

- `meta` block returns `usedAI`, `model`, `creditsUsed`, and `generatedAt` for per-request
  analytics (acceptance rate, credits/user, AI vs. mock ratio).
- `x-fallback-reason` header records why a fallback fired (`empty-generation`, error name) for
  alerting on model degradation.
- AI Gateway provides token/cost/latency dashboards per model.
- Roadmap: structured request logs, score distribution monitoring, and copy-acceptance events.

## Scaling considerations

- Stateless route → horizontal scale on Vercel Fluid Compute.
- Two `generateObject` calls per request; drafts are batched in one call (not N calls) to bound
  latency and cost. Critique batched likewise.
- Model tiering (Haiku for cheap/high-volume, Sonnet default, Opus for premium) lets cost track
  the plan.
- Heuristic layer is O(n) over variant text — negligible.
- Roadmap: cache identical (brand voice + brief + type) requests; queue very large batches.

## Testing strategy

- **Unit:** `lib/frameworks.ts` rotation determinism; `lib/mock.ts` heuristic scoring, brand-safety
  detection (forbidden word → `passed: false`, score capped), brevity scoring per copy type,
  `reconcileCritique` blending and override rules.
- **Schema:** zod parse round-trips for every model; reject malformed request bodies.
- **Route (integration):** mock mode returns `count` variants sorted by score with `usedAI:false`;
  AI mode mocked to assert reconciliation and ranking; malformed model output falls back to
  heuristic critique.
- **E2E:** studio load → generate (mock) → variant cards render with scores, framework tags, safety
  flags, and working copy button.
- **Type:** `pnpm typecheck` (tsc strict, `--noEmit`) in CI.
