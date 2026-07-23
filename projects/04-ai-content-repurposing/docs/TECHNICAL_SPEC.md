# Technical Spec — AI Content Repurposing

## System overview

A Next.js 15 (App Router) application. The browser workspace collects a source asset, a format
selection, and an optional brand voice, then calls a single Node.js API route. That route runs a
two-step AI pipeline — **voice extraction** then **multi-format fan-out generation** — using the
Vercel AI SDK v5 routed through the AI Gateway via `"provider/model"` strings. All I/O is validated
with zod. With no API key present, the pipeline swaps in deterministic mock generators so the whole
product is demoable offline. Domain logic lives in `lib/`; components are thin.

```
app/            routes, layout, workspace page, API route
components/      SourceInput, FormatPicker, OutputCard (client)
lib/             types.ts (schemas), formats.ts (catalog), ai.ts (orchestration)
```

## Component breakdown

### UI (client components)
- **`app/page.tsx`** — workspace. Holds state (source, kind, selected formats, result, loading,
  error), calls `POST /api/repurpose`, renders the output grid. Ships a sample asset for zero-friction demo.
- **`components/SourceInput.tsx`** — textarea + source-kind selector; live word count / read time.
- **`components/FormatPicker.tsx`** — multi-select over the format catalog with select-all/clear.
- **`components/OutputCard.tsx`** — renders one `Output`: segmented list or prose body, hashtags,
  notes, char count vs. limit, over-limit badge, copy button.

### Server
- **`app/api/repurpose/route.ts`** — `POST` (pipeline) + `GET` (capability probe). Node runtime,
  `maxDuration=60`. Validates request, runs the pipeline, validates and returns the result envelope.

### Domain (`lib/`)
- **`lib/types.ts`** — zod schemas + inferred types: `Source`, `BrandVoice`, `Output`, `RepurposeJob`
  (request/result). Single source of truth shared by API and UI.
- **`lib/formats.ts`** — the format catalog: per-format platform, label, char limit, multi-segment
  flag, glyph, and generation instruction; plus `measure()` and `limitFor()` helpers and
  `DEFAULT_FORMATS`.
- **`lib/ai.ts`** — model registry, `hasAI()`, `extractBrandVoice()`, `generateOutputs()` (the
  `generateObject` array fan-out), prompt construction, and mock generators.

## Data models (typed)

All defined as zod schemas in `lib/types.ts`; TypeScript types are inferred (`z.infer`).

```ts
// Source — the long-form asset being repurposed
Source = {
  id: string
  kind: "blog_post" | "youtube_transcript" | "podcast_transcript"
       | "newsletter" | "webinar" | "raw_notes"
  title?: string
  text: string            // full long-form text (min 1)
  url?: string
  wordCount?: number
}

// BrandVoice — reusable voice fingerprint (extracted or supplied)
BrandVoice = {
  id: string; name: string
  summary: string
  tone: ToneTrait[]        // authoritative | friendly | witty | inspirational
                           // | technical | contrarian | empathetic | playful
  vocabulary: string[]     // signature phrases
  avoid: string[]          // off-brand words/phrases
  readingLevel: string     // e.g. "grade 8", "expert"
  emojiUsage: "none" | "sparing" | "liberal"
}

// Output — one generated platform-native asset
Output = {
  format: FormatId         // x_thread | linkedin_post | instagram_caption
                           // | tiktok_script | newsletter_section | quote_graphics
                           // | seo_meta | youtube_description | facebook_post | threads_post
  platform: Platform       // x | linkedin | instagram | tiktok | email | web
                           // | youtube | facebook | threads
  label: string
  body: string             // paste-ready text
  segments?: string[]      // platform units: tweets, beats, quote lines, meta fields
  hashtags: string[]
  charCount: number        // computed server-side
  overLimit: boolean       // charCount/longest-segment vs platform limit
  notes?: string           // hook/angle rationale
}

// RepurposeJob — request + result envelope
RepurposeRequest = {
  source: string           // min 30 chars
  kind?: SourceKind
  title?: string
  url?: string
  formats?: FormatId[]     // 1..20; defaults to DEFAULT_FORMATS
  brandVoice?: Partial<BrandVoice>
}

RepurposeResult = {
  jobId: string
  status: "queued" | "analyzing_voice" | "generating" | "completed" | "failed"
  usedAI: boolean
  model?: string
  brandVoice: BrandVoice
  source: { kind: SourceKind; wordCount: number; title?: string }
  outputs: Output[]
  elapsedMs: number
  createdAt: string        // ISO
}
```

## API surface

### `POST /api/repurpose`
Repurpose a source into the selected formats.

- **Request** (`application/json`): `RepurposeRequest`.
- **Responses:**
  - `200` → `RepurposeResult` (self-validated with `RepurposeResultSchema` before send).
  - `400` → `{ error }` invalid JSON.
  - `422` → `{ error, issues }` zod validation failure (flattened).
  - `500` → `{ error, detail }` generation error.
- **Behavior:** validate → `extractBrandVoice(source, brandVoice)` → `generateOutputs(source, voice,
  formats)` → enrich (char counts, limits, backfill missing formats) → return. Uses mock generators
  when `hasAI()` is false. `usedAI` reflects which path ran.

### `GET /api/repurpose`
Capability probe: `{ ok: true, aiEnabled: boolean, defaultFormats: FormatId[] }`. Lets the UI show
mock vs. live state.

## AI / model usage

Model access via the Vercel AI SDK v5 through the AI Gateway using `"provider/model"` strings
(`lib/ai.ts` `MODELS`): `fast=anthropic/claude-haiku-4-5`, `smart=anthropic/claude-sonnet-5`,
`frontier=anthropic/claude-opus-4-8`.

- **Step 1 — Voice extraction** (`extractBrandVoice`): `generateObject` with a dedicated
  `VoiceExtractionSchema`, `MODELS.fast`, `temperature 0.2`, analyst system prompt. Source truncated
  to ~6k chars. Skipped if the caller supplies a rich `summary`; results are merged with any
  caller-provided overrides.
- **Step 2 — Multi-format generation** (`generateOutputs`): a **single** `generateObject` call with
  **`output: "array"`** where `schema` is the per-element `GeneratedPieceSchema`, so the SDK returns a
  **typed array** — one element per requested format. `MODELS.smart`, `temperature 0.7`. The system
  prompt is built from the brand voice (`buildVoiceSystemPrompt`); the user prompt lists each
  requested format with its native instruction from the catalog and includes the source (truncated to
  ~16k chars). Every AI call sets a system prompt, temperature, and a zod output schema per
  conventions.
- **Post-processing:** results are mapped back to the requested format list; any format the model
  omitted is backfilled with a mock so the response contract always holds. Each element is enriched
  with `platform`, `label`, `charCount`, and `overLimit` via `measure()`.
- **Fallback:** `hasAI()===false` → deterministic per-format mock generators produce realistic,
  structurally correct content (threads with numbered posts, script beats, SEO fields, etc.).

## Third-party integrations

- **Vercel AI Gateway** — model routing/observability (required for live mode).
- **Transcription (roadmap, env reserved):** Deepgram / AssemblyAI to convert audio/video URLs into
  source text before repurposing.
- **Social schedulers (roadmap, env reserved):** Buffer, Typefully, Ayrshare to push approved outputs
  into publishing queues. Output cards are the hand-off surface today (copy).

## Security & privacy

- No secrets in the repo; all keys via `.env.example` → `.env.local`.
- Inputs validated with zod; typed error responses; no reflection of unvalidated input.
- Node runtime; no edge-only APIs. Source length capped before model calls (cost + abuse control).
- Scaffold is stateless — source text is processed transiently and not persisted. Production adds
  per-tenant isolation, retention/deletion controls, and authenticated, rate-limited endpoints.
- Model prompt forbids fabricating facts beyond the source.

## Observability

- API logs generation failures with context (`[repurpose]`).
- `RepurposeResult` carries `elapsedMs`, `usedAI`, `model`, and source `wordCount` for KPI/latency
  tracking. AI Gateway provides token/cost/latency telemetry per call. Production: structured logs +
  per-tenant usage metering (outputs generated) feeding billing and the volume caps.

## Scaling considerations

- Fan-out is a single model call returning an array → predictable latency/cost per job regardless of
  format count (bounded 1–20). Fluid Compute handles concurrent jobs; `maxDuration=60`.
- Fast model for voice keeps the common path cheap; source truncation caps token spend.
- Stateless route scales horizontally. Future queue (durable workflow) for large batches/agency API.
- Format catalog and limits are data (`lib/formats.ts`) — new platforms added without touching the
  pipeline.

## Testing strategy

- **Unit:** `measure()` limit logic (per-segment vs. whole-body), `countWords`, `stripEmpty`, mock
  generators produce schema-valid `Output` for every `FormatId`.
- **Schema/contract:** round-trip `RepurposeRequestSchema` / `RepurposeResultSchema`; assert the API
  returns one output per requested format (including backfill path).
- **Route (integration):** POST with/without API key → 200 shape; malformed JSON → 400; invalid body
  → 422. Mock mode gives deterministic assertions with zero keys.
- **AI (mocked model):** stub `generateObject` (MockLanguageModel) to assert prompt assembly, array
  handling, and enrichment without network calls.
- **E2E (smoke):** load sample → select formats → generate → cards render with counts and copy works.
- **Type:** `tsc --noEmit` in CI (strict).
