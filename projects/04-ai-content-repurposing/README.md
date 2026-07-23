# AI Content Repurposing

> Paste one long-form asset — a blog post, YouTube transcript, or podcast episode — and get **20+ platform-native pieces** back in seconds, all in your brand voice.

## Business case

Creators and marketing teams already produce great long-form content. The bottleneck is
**distribution**: manually rewriting one article into an X thread, a LinkedIn post, an Instagram
caption, a TikTok script, a newsletter section, quote cards, and SEO meta takes hours per asset and
kills consistency. This product collapses that work into a single paste-and-generate step while
preserving the creator's voice.

**Who pays:** solo creators, content marketers, and agencies who publish across many channels.
**For what:** turning one source asset into a full week of channel-native content, on brand, on demand.
**Model:** tiered SaaS priced by **monthly output volume** (assets generated / source pieces processed):

| Tier | Price (mo) | Monthly outputs | For |
| --- | --- | --- | --- |
| Solo | $19 | 300 outputs (~15 sources) | Individual creators |
| Creator Pro | $49 | 1,200 outputs + brand voices | Full-time creators |
| Marketer | $149 | 5,000 outputs + scheduler sync + team seats | In-house marketers |
| Agency | $499+ | 25,000 outputs + multi-brand workspaces + API | Agencies / multi-client |

Overage is metered per 100 outputs; annual plans discount ~20%.

## Features

- **One-paste ingestion** — blog post, YouTube/podcast transcript, newsletter, webinar, or raw notes.
- **Brand voice preservation** — extracts a reusable voice fingerprint (tone, vocabulary, no-go words,
  reading level, emoji policy) from the source, or accepts a saved voice.
- **10 native formats** (extensible): X/Twitter thread, LinkedIn post, Instagram caption,
  TikTok/Reels script, newsletter section, quote graphics, SEO meta, YouTube description,
  Facebook post, Threads post. Select any subset; 20+ pieces come from multi-segment formats
  (threads, scripts, quote sets) expanding into individual units.
- **Platform-aware limits** — every output shows a live char count and flags over-limit content.
- **Copy-ready output cards** — one click copies body + hashtags.
- **Typed, validated pipeline** — `generateObject` returns a typed array of assets; zod validates
  both request and response.
- **Zero-key demo** — runs in graceful **mock mode** with realistic content when no API key is set.

## Quickstart

```bash
pnpm install          # from the monorepo root (workspaces)
cp projects/04-ai-content-repurposing/.env.example \
   projects/04-ai-content-repurposing/.env.local
# add AI_GATEWAY_API_KEY for live generation (optional — mock mode works without it)

pnpm --filter @mmai/ai-content-repurposing dev
# open http://localhost:3000, click "Load sample content", pick formats, Repurpose
```

Type-check: `pnpm --filter @mmai/ai-content-repurposing typecheck`

### Core API

```
POST /api/repurpose
{
  "source": "…long-form text…",
  "kind": "blog_post",
  "formats": ["x_thread", "linkedin_post", "seo_meta"],   // optional
  "brandVoice": { "tone": ["witty"], "avoid": ["synergy"] } // optional
}
→ 200 RepurposeResult { outputs: Output[], brandVoice, usedAI, elapsedMs, … }
```

See `docs/TECHNICAL_SPEC.md` for the full data models and API surface.

## Architecture at a glance

`source → analyze voice → fan-out generate (generateObject array) → measure/validate → review → schedule`

Next.js 15 App Router, TypeScript strict, Tailwind. AI via Vercel AI SDK v5 routed through the
AI Gateway. Full diagram in `docs/ARCHITECTURE.md`.

## Roadmap

- **Now:** paste → multi-format generation, voice extraction, mock fallback, copy cards.
- **Next:** saved brand voices, source ingestion from URL (auto-transcription), inline editing +
  regenerate-single, approval workflow.
- **Then:** scheduler push (Buffer / Typefully / Ayrshare), analytics-based engagement lift tracking,
  A/B hook variants, multi-brand agency workspaces, public API + Zapier.

## Docs

- [`docs/PRD.md`](docs/PRD.md) — product requirements, personas, pricing, GTM, competitors.
- [`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md) — components, data models, API, AI usage.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system diagram, data flow, deployment.
