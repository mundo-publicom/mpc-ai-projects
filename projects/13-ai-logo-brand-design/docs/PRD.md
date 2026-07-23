# PRD — AI Logo & Brand Design Studio

## Overview

AI Logo & Brand Design Studio turns a short brand brief into a complete,
coherent brand kit: 2–3 logo concepts delivered as real inline SVG, an
accessible color palette with semantic roles, a typography pairing, brand voice
guidance, usage rules, and a downloadable brand guide. It compresses a
multi-week, multi-thousand-dollar agency process into seconds while keeping
output editable (vectors) and accessible (WCAG-checked).

## Problem

- Early-stage founders and small businesses need a usable identity immediately
  (pitch deck, landing page, socials) but can't afford or wait for an agency.
- DIY tools produce generic, raster-locked logos and skip the *system* — palette
  roles, type pairing, voice, and usage rules — that makes a brand look
  intentional.
- Freelancers and small agencies spend unbillable hours on first-draft
  exploration that a tool could accelerate, letting them focus on refinement and
  client relationships.

## Target users & personas

1. **Sofia — startup founder.** Pre-seed, non-designer. Needs a credible
   identity for her deck and MVP this week. Values speed, coherence, and assets
   she can drop into Figma/Next.js.
2. **Marcus — small business owner.** Runs a local coffee roastery. Wants a
   professional logo, colors, and a one-page guide he can hand to a printer and
   a sign maker. Values clarity and "does it look legit."
3. **Priya — freelance designer / small agency.** Uses the tool to generate
   first-round directions fast, then refines the winning SVG. Values editable
   vectors, white-label export, and volume across many clients.

## User stories

- As a founder, I enter my name, industry, values, and style and get several
  distinct logo directions I can compare side by side.
- As a business owner, I can see my palette with real hex codes and know the
  colors are legible for text.
- As any user, I can download a self-contained brand guide to share with a
  developer, printer, or teammate.
- As a designer, I can take the returned SVG into my editor because it's real
  vector markup, not a flattened image.
- As an agency, I can generate unlimited kits and export them white-labeled.
- As any user, I can use the product end to end even before entering an API key
  (mock mode), so I can evaluate it risk-free.

## Functional requirements

1. **Brief intake.** Capture name (required), industry (required), values
   (list), style direction (enum), optional audience and description.
2. **Generation.** A single API call returns 2–3 logo concepts (valid `<svg>`),
   a palette (4–6 colors with roles), a typography pairing, brand voice, and
   usage rules, validated against a strict zod schema.
3. **Distinct concepts.** Concepts must span different logo types (e.g.
   combination mark, lettermark, icon-led), not variations of one idea.
4. **SVG safety.** All returned SVG is sanitized (no scripts, event handlers, or
   remote references) before rendering.
5. **Palette accessibility.** Each palette is audited for WCAG 2.1 contrast; the
   UI surfaces failing pairings.
6. **Rendering.** The studio renders logos (inline SVG), palette swatches, a
   type specimen, brand voice, and usage rules.
7. **Export.** One-click download of a self-contained HTML brand guide with
   embedded SVGs and web-font references.
8. **Mock fallback.** With no API key, a deterministic mock produces a
   high-quality kit with real inline SVG and a generated palette.
9. **Graceful degradation.** A model/parse error falls back to the mock kit
   rather than failing the request.

## Non-functional requirements

- **Performance:** typical generation < 15s on the smart model; mock is instant.
- **Reliability:** the generate endpoint never returns a hard 5xx for a valid
  brief — it degrades to mock output.
- **Type safety:** TypeScript `strict`; all API I/O validated with zod.
- **Accessibility:** palette contrast checking built into the core flow.
- **Portability:** Node.js runtime, no edge-only APIs; deployable on Vercel.
- **Privacy:** briefs are not persisted server-side in the scaffold; no secrets
  committed.

## Success metrics / KPIs

- **Kits delivered** (activation): briefs that reach a rendered kit.
- **Conversion:** free kit → paid unlock; visitor → agency subscription.
- **Revision rate:** average regenerations per delivered kit (proxy for
  first-draft quality; lower is better, target < 2.5).
- **Export rate:** delivered kits that download a brand guide.
- **Time-to-first-kit:** median seconds from landing to first rendered kit.
- **Retention (agency):** monthly active workspaces / kits per subscriber.

## Monetization & pricing

- **Free / demo:** unlimited generation, watermarked preview, no full export.
- **Brand kit unlock — $39–$59 one-off:** removes watermark, unlocks
  full-resolution SVG/asset + brand-guide export for one brand.
- **Agency — $49–$149/mo:** unlimited kits, white-label export, client
  workspaces, priority model tier, brand history.
- **Add-ons (roadmap):** raster mockup packs, PDF brand book, trademark
  pre-check.

Rationale: individuals have low willingness for recurring spend on a one-time
need (per-kit fits), while agencies generate many kits and value white-label +
speed (subscription fits).

## Go-to-market

- **SEO / content:** "free logo maker", "brand kit generator", industry-specific
  landing pages ("logo for coffee shops").
- **Product-led:** full mock demo with zero signup; paywall only at export.
- **Design communities & marketplaces:** distribution to freelancers via
  templates and referral.
- **Integrations:** "export to Figma / Next.js theme" as a wedge for developers.
- **Partnerships:** website builders and incorporation services bundling a kit.

## Competitive landscape

- **Looka / Brandmark / Tailor Brands:** strong onboarding and breadth, but
  outputs are often raster-locked and formulaic; upsell-heavy. *Our edge:*
  editable SVG, accessibility pass, developer-friendly export.
- **Canva:** huge distribution and templates, weaker at generating a *system*
  from a brief. *Our edge:* opinionated, coherent kit incl. voice + usage rules.
- **Fiverr / freelancers:** bespoke but slow and expensive. *Our edge:* speed
  and price for first-draft, and a tool freelancers can adopt themselves.

## Risks & mitigations

- **Trademark / originality.** AI output may resemble existing marks. *Mitigate:*
  disclaimer in-app and in the exported guide, encourage trademark search,
  roadmap originality pre-check; concepts are starting points, not legal clearance.
- **Generic output.** *Mitigate:* distinct-concept constraint, style-aware
  prompting, temperature tuning, curated type pairings.
- **Unsafe SVG injection.** *Mitigate:* sanitize before render; strip scripts,
  handlers, remote refs.
- **Inaccessible color choices.** *Mitigate:* built-in WCAG audit surfaced in UI.
- **Model cost/latency.** *Mitigate:* smart-tier default, mock fallback, caching
  (roadmap).
- **Brand-safety / offensive output.** *Mitigate:* system prompt constraints,
  moderation pass (roadmap).

## Out of scope (v1)

- Full logo vector editor (recolor/layout tweaks) — roadmap.
- Server-side PDF rendering and self-hosted font packaging — roadmap.
- Payments/billing and auth — roadmap (framing defined here).
- Raster mockup generation via image models — optional/roadmap.
- Team collaboration / real-time multi-user editing.

## Milestones / roadmap

1. **v1 (this scaffold):** brief → kit (SVG + palette + type + voice + rules),
   accessibility audit, HTML guide export, mock fallback.
2. **v1.1:** raster mockups (image model), PDF export.
3. **v1.2:** in-browser SVG editor (recolor, layout, spacing).
4. **v1.3:** auth + Stripe (per-kit unlock, agency subscription, workspaces).
5. **v1.4:** trademark/originality pre-check, revision history, Figma export.
