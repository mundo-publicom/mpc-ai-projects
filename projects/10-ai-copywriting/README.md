# AI Copywriting Studio

> **Business case.** Performance marketers, ecommerce owners, and agency copywriters spend
> hours producing on-brand copy variants and manually A/B guessing which will convert. This
> studio turns a **brand-voice profile + a one-screen brief** into multiple scored copy
> variants across every channel that matters — Google/Meta ads, cold & nurture email, landing
> sections, product descriptions, and headlines — each structured on a proven framework
> (AIDA, PAS, FAB, BAB, 4 Ps) and graded by a critique pass that flags brand-safety and
> plagiarism risk. **Who pays:** solo marketers and DTC founders on self-serve plans; agencies
> on seat + volume plans. **For what:** credits consumed per generation. **Model:** credit-based
> SaaS — buy a monthly credit bundle, top up as you scale.

## Features

- **Brand-voice profiles** — tone, audience, reading level, do/don't rules, power words, and a
  hard **forbidden-words blocklist** enforced by the brand-safety check.
- **Seven copy types** — Google RSA ads, Meta ads, cold email, nurture email, landing sections,
  product descriptions, and standalone headlines. Each carries format guidance.
- **Multiple variants per run** — N drafts, each built around a *different* framework so you
  explore distinct persuasion structures instead of rewordings.
- **Two-pass AI** — a creative pass (`generateObject`, higher temperature) generates drafts,
  then a **critique/scoring pass** grades clarity, persuasion, brand fit, brevity, and CTA
  strength on a 0-100 scale with actionable suggestions.
- **Deterministic guardrails** — every variant is also scored by a transparent heuristic. AI
  scores are blended with it, and any heuristic brand-safety failure overrides an over-generous
  AI pass. Plagiarism risk is estimated from slogan/cliché proximity.
- **Copy-ready output** — variant cards with score badges, framework tags, sub-score breakdown,
  critique, safety flags, and one-click copy.
- **Runs with zero keys** — a built-in mock engine produces real, brand-aware copy and real
  scores so the whole flow is demoable offline.

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # optional — add AI_GATEWAY_API_KEY for live generation
pnpm dev                     # http://localhost:3000
```

Without a key the studio runs on the deterministic mock engine. Add `AI_GATEWAY_API_KEY` to
`.env.local` to route real generations through the Vercel AI Gateway
(`anthropic/claude-sonnet-5`).

### API

```bash
curl -s http://localhost:3000/api/copy/generate \
  -H 'content-type: application/json' \
  -d '{
    "brandVoice": { "name": "Acme", "tone": ["confident"], "forbiddenWords": ["cheap"] },
    "brief": { "product": "AI inventory forecasting", "keyBenefits": ["never run out of stock"], "cta": "Start free" },
    "copyType": "meta_ad",
    "count": 3
  }' | jq
```

Returns `{ variants: Variant[], meta: {...} }` — each variant has typed `content`, a
`framework` tag, and a full `critique` (scores, rationale, suggestions, brand-safety,
plagiarism risk).

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the system diagram and data flow,
[`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md) for data models and the API surface, and
[`docs/PRD.md`](docs/PRD.md) for personas, KPIs, pricing, and roadmap.

```
brand voice + brief ──▶ generate N drafts (generateObject) ──▶ critique/score pass
                                                                      │
                                          heuristic scorer + safety ◀─┘
                                                                      ▼
                                              ranked, copy-ready variant cards → export
```

## Roadmap

- **Now:** studio, seven copy types, five frameworks, two-pass generation, heuristic guardrails.
- **Next:** persisted brand-voice profiles & brief templates, credit ledger + Stripe billing,
  CSV/asset export, real plagiarism API, per-variant regeneration and inline editing.
- **Later:** ad-platform push (Google Ads RSA, Meta Marketing API), ESP sync (SendGrid,
  Customer.io, Klaviyo), performance feedback loop (import CTR/CVR to fine-tune scoring),
  multi-language, team workspaces and approvals.

## Tech

Next.js 15 (App Router) · TypeScript strict · Tailwind · Vercel AI SDK v5 (`generateObject`)
routed through the AI Gateway · zod-validated I/O · Node.js runtime.
