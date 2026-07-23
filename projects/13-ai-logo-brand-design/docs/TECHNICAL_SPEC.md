# Technical Spec — AI Logo & Brand Design Studio

## System overview

A Next.js 15 (App Router) application. The studio page (`app/page.tsx`, client
component) collects a brief and calls one Node.js API route
(`app/api/brand/generate/route.ts`). That route validates the brief with zod,
then either (a) calls the Vercel AI Gateway via the AI SDK's `generateObject`
bound to a strict output schema, or (b) — when no API key is present or a call
fails — returns a deterministic mock brand kit. Domain logic (prompts, schema,
palette math, SVG sanitizing, mock generation, guide export) lives in `lib/`.

## Component breakdown

| Layer | File | Responsibility |
| --- | --- | --- |
| UI (studio) | `app/page.tsx` | Orchestrates brief → fetch → render; export trigger |
| UI | `components/BriefForm.tsx` | Brief inputs, style picker, validation |
| UI | `components/LogoConcepts.tsx` | Renders sanitized SVG concepts on palette bg |
| UI | `components/PaletteSwatches.tsx` | Swatches + WCAG audit summary |
| UI | `components/TypeSpecimen.tsx` | Heading/body cards + live specimen |
| API | `app/api/brand/generate/route.ts` | Validate, generate (AI or mock), respond |
| Domain | `lib/ai.ts` | Model catalog, prompts, zod output schema, SVG sanitizer, mock kit + SVG generators |
| Domain | `lib/palette.ts` | hex/RGB/HSL conversion, WCAG contrast, palette generation |
| Domain | `lib/guide.ts` | Standalone HTML brand-guide builder |
| Domain | `lib/types.ts` | Shared typed data models |

## Data models (typed)

```ts
type BrandStyle = "modern" | "minimal" | "bold" | "playful" | "elegant" | "classic";

interface Brief {
  name: string;
  industry: string;
  values: string[];
  style: BrandStyle;
  description?: string;
  audience?: string;
}

type ColorRole = "primary" | "secondary" | "accent" | "neutral" | "background";
interface PaletteColor { role: ColorRole; hex: string; name: string; }
interface Palette { name: string; colors: PaletteColor[]; }

type FontCategory = "serif" | "sans-serif" | "display" | "monospace";
interface FontSpec { family: string; weights: number[]; category: FontCategory; fallback: string; }
interface TypePairing { heading: FontSpec; body: FontSpec; rationale: string; }

type LogoStyle = "wordmark" | "lettermark" | "combination" | "icon" | "emblem";
interface LogoConcept { id: string; name: string; style: LogoStyle; svg: string; rationale: string; }

interface BrandVoice {
  archetype: string; tone: string[]; tagline: string; elevatorPitch: string;
  dos: string[]; donts: string[]; sampleHeadline: string; sampleBody: string;
}

interface BrandKit {
  brief: Brief;
  concepts: LogoConcept[];
  palette: Palette;
  typography: TypePairing;
  voice: BrandVoice;
  usageRules: string[];
  mocked: boolean;
  latencyMs: number;
}
```

## API surface

### `POST /api/brand/generate`

Request body (validated by zod, `briefSchema`):

```jsonc
{
  "name": "Northwind",             // required, 1–60 chars
  "industry": "climate fintech",   // required, 1–80 chars
  "values": ["trust", "momentum"], // optional, ≤8 items
  "style": "modern",               // one of BrandStyle
  "audience": "founders",          // optional
  "description": "…"               // optional, ≤2000 chars
}
```

Responses:

- `200 { kit: BrandKit }` — success (AI or mock). Header `x-fallback-reason` is
  set when a model error forced the mock path.
- `400 { error }` — invalid JSON.
- `422 { error, details }` — brief failed validation (`details` is a zod
  flattened error).

The route sets `runtime = "nodejs"` and `maxDuration = 60`.

## AI / model usage

- **SDK:** Vercel AI SDK v5, `generateObject`, routed through the AI Gateway
  using plain `"provider/model"` strings. No provider SDK wired directly.
- **Model catalog** (`lib/ai.ts`): `fast` = `anthropic/claude-haiku-4-5`,
  `smart` = `anthropic/claude-sonnet-5` (default for generation), `frontier` =
  `anthropic/claude-opus-4-8`.
- **Structured output:** `brandKitSchema` (zod) constrains concepts (2–3), each
  with a self-contained `<svg>` string; palette (4–6 role-tagged hex colors,
  regex-validated); typography pairing; brand voice; and usage rules.
- **Prompting:** `buildSystemPrompt()` encodes SVG safety/geometry rules,
  palette rules, and a "distinct directions" constraint. `buildUserPrompt(brief)`
  injects the brief. `temperature: 0.8` for creative variety.
- **Determinism / fallback:** `hasAI()` gates the live path. `mockBrandKit()`
  produces real inline SVG (three parametric generators keyed to the palette)
  plus a hue-seeded palette and curated type pairing — deterministic per brief.
- **Optional raster path (roadmap):** convert a chosen SVG concept to hi-res
  mockups via an image model (keys reserved in `.env.example`).

## Third-party integrations

- **Vercel AI Gateway** — model access (required for live mode).
- **Google Fonts** — typography families referenced by name; the exported guide
  links the web fonts. (Live metadata API is roadmap.)
- **Image generation (roadmap)** — OpenAI/fal/Replicate for raster mockups.
- **Stripe (roadmap)** — per-kit unlock + agency subscription.

## Security & privacy

- **SVG sanitization** (`sanitizeSvg`): strips `<script>`, `on*` handlers,
  remote `href`/`xlink:href`, and `javascript:`, and clamps to the outermost
  `<svg>…</svg>` before `dangerouslySetInnerHTML`.
- **Input validation:** all request bodies validated with zod; sizes bounded.
- **Secrets:** only via env (`AI_GATEWAY_API_KEY` / `ANTHROPIC_API_KEY`); none
  committed. `.env.local` is gitignored.
- **No persistence:** the scaffold does not store briefs or kits server-side.
- **Hardening (prod):** add a mature SVG sanitizer (e.g. DOMPurify with SVG
  profile) and rate limiting on the generate route.

## Observability

- Per-request `latencyMs` returned in the payload and shown in the UI.
- `mocked` flag distinguishes AI vs. fallback output.
- `x-fallback-reason` response header records model-error degradations.
- Roadmap: structured logs + metrics (generation count, fallback rate, latency
  percentiles), and quality signals (regeneration/export rates).

## Scaling considerations

- Stateless route → horizontally scalable on Vercel Fluid Compute.
- Cost/latency controlled by default `smart` tier; escalate to `frontier` only
  for premium tiers.
- Cache identical briefs (roadmap) to cut cost and latency.
- Mock path carries load spikes and demo traffic at zero model cost.

## Testing strategy

- **Unit:** `lib/palette.ts` (conversion round-trips, contrast ratios vs. known
  values, WCAG thresholds), `sanitizeSvg` (strips scripts/handlers/remote refs),
  `mockBrandKit` determinism.
- **Schema:** validate that `brandKitSchema` rejects malformed hex/SVG and that
  mock output satisfies the domain types.
- **API:** brief validation (422 paths), mock 200 path, forced-error fallback.
- **E2E (roadmap):** brief → render → export happy path via Playwright.
