# AI Logo & Brand Design Studio

> **Business case.** Founders, small businesses, and freelance designers need a
> credible visual identity on day one but can't justify a $3–10k agency engagement
> or the two-week wait. This studio turns a 30-second brief into a complete brand
> kit — 2–3 logo concepts (real, editable SVG), an accessible color palette, a
> typography pairing, brand voice, and a downloadable brand guide. **Who pays &
> for what:** individuals buy a one-off **brand kit unlock ($39–$59)** to export
> full-resolution assets and the guide; agencies and studios subscribe to an
> **Agency plan ($49–$149/mo)** for unlimited kits, white-label exports, and
> client workspaces. It slots neatly against Looka, Brandmark, Tailor Brands, and
> Canva — but leads with editable vector output and a strict accessibility pass.

## Features

- **Brief → brand kit in one call.** A single `generateObject` request returns
  logo concepts, palette, typography, voice, and usage rules against a strict
  zod schema.
- **Real inline SVG logos.** Concepts render directly in the browser and export
  as vectors — not flattened rasters.
- **Accessible palettes.** Every palette is audited for WCAG 2.1 contrast; the
  UI flags pairings that fall below AA.
- **Typography pairings.** Curated, style-aware heading/body pairs with rationale.
- **Brand voice.** Archetype, tone, tagline, elevator pitch, and do/don't rules.
- **Downloadable brand guide.** One click exports a self-contained HTML guide
  (embedded SVGs + web-font links) ready to hand to a client or dev team.
- **Zero-key demo mode.** With no API key set, a deterministic mock produces a
  genuinely good-looking kit with real SVG so the product is fully demoable.

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # optional — runs in mock mode without keys
pnpm dev                     # http://localhost:3000
```

Set `AI_GATEWAY_API_KEY` (or `ANTHROPIC_API_KEY`) in `.env.local` to switch from
mock output to live AI generation. Everything else works out of the box.

### Try the core path

1. Open the studio, tweak the pre-filled brief (name, industry, values, style).
2. Click **Generate brand kit**.
3. Review logo concepts, palette (with contrast checks), type specimen, and voice.
4. Click **Download brand guide** to export the HTML deliverable.

Or hit the API directly:

```bash
curl -s localhost:3000/api/brand/generate \
  -H 'content-type: application/json' \
  -d '{"name":"Northwind","industry":"climate fintech","values":["trust","momentum"],"style":"modern"}' | jq
```

## Architecture at a glance

- `app/page.tsx` — the studio (client component orchestrating the flow).
- `app/api/brand/generate/route.ts` — the real end-to-end path (`generateObject`
  + zod, deterministic mock fallback).
- `lib/ai.ts` — model catalog, prompts, output schema, SVG sanitizer, mock kit.
- `lib/palette.ts` — color conversion + WCAG contrast + deterministic palettes.
- `lib/guide.ts` — standalone HTML brand-guide exporter.
- `components/` — `BriefForm`, `LogoConcepts`, `PaletteSwatches`, `TypeSpecimen`.

See `docs/` for the full PRD, technical spec, and architecture.

## Roadmap

- Raster mockups via image model (app icon, social avatar, signage, apparel).
- PDF export of the brand guide (server-side render) as a premium deliverable.
- Logo editor: recolor, swap layout, adjust spacing on the returned SVG.
- Live Google Fonts metadata + self-hosted font packaging in exports.
- Trademark/originality pre-check integration and revision history.
- Stripe billing: per-kit unlock + agency subscription with client workspaces.
