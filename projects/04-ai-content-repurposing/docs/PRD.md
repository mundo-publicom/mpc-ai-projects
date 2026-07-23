# PRD — AI Content Repurposing

## Overview

AI Content Repurposing turns a single long-form asset (blog post, YouTube transcript, podcast
episode, newsletter, webinar) into 20+ platform-native content pieces — X/Twitter threads, LinkedIn
posts, Instagram captions, TikTok/Reels scripts, newsletter sections, quote-graphic text, SEO meta,
and more — while preserving the creator's brand voice. It is delivered as a tiered SaaS priced by
monthly output volume.

## Problem

Creators and marketing teams invest heavily in long-form content but under-distribute it. The manual
work of adapting one asset for each channel is:

- **Slow** — a competent marketer needs 2–4 hours to hand-rewrite one article into a full channel set.
- **Inconsistent** — output quality and cadence degrade under time pressure; channels go dark.
- **Voice-lossy** — junior staff, freelancers, or generic AI tools flatten the brand's distinct voice.
- **Not native** — most teams resize the same paragraph instead of writing for each platform's norms,
  so engagement suffers.

The result: great source content reaches a fraction of its potential audience. Distribution, not
creation, is the constraint.

## Target users & personas

1. **Solo creator ("Maya")** — a full-time creator/educator who publishes a weekly YouTube video and
   newsletter. Time-poor, no team. Wants to be everywhere without hiring. Values speed and that the
   output "sounds like me." Price-sensitive.
2. **Content marketer ("Devon")** — owns content at a 40-person B2B SaaS. Publishes a blog + webinars,
   must feed LinkedIn, X, and email. Cares about on-brand consistency, approval control, and
   scheduling integration. Buys tools with a company card up to a few hundred dollars/month.
3. **Agency lead ("Priya")** — runs content for 15 clients. Needs multiple brand voices, multi-client
   workspaces, per-client volume, white-label-ish output, and an API/bulk workflow. Highest willingness
   to pay; needs seats and governance.

## User stories

- As **Maya**, I paste my podcast transcript, click a few formats, and get a thread, IG caption, and
  newsletter blurb in my voice within a minute, so I can post today.
- As **Maya**, I load the sample and try the tool with no signup/key friction before I commit.
- As **Devon**, I save our approved brand voice once so every generation stays on-brand.
- As **Devon**, I select exactly the formats our channels use and copy each into our scheduler.
- As **Devon**, I see a live character count and an over-limit warning before I publish.
- As **Priya**, I keep a separate brand voice per client and switch between them per job.
- As **Priya**, I call the API to repurpose a batch of client articles nightly.
- As any user, I regenerate a single format I don't like without re-running the whole set (roadmap).

## Functional requirements

1. **FR-1 Ingestion** — accept pasted long-form text with a selectable source kind (blog, YouTube
   transcript, podcast, newsletter, webinar, raw notes). Minimum ~30 characters to proceed.
2. **FR-2 Voice extraction** — when no brand voice is supplied, extract a voice fingerprint
   (summary, tone traits, signature vocabulary, avoid-list, reading level, emoji policy) from the
   source before generation.
3. **FR-3 Voice override** — accept a partial/complete brand voice from the caller; supplied fields
   override extracted ones.
4. **FR-4 Format selection** — expose the format catalog; let the user select any subset (1–20) or
   select-all / clear. Provide a sensible default pack.
5. **FR-5 Multi-format generation** — produce exactly one native asset per selected format in a single
   fan-out call returning a typed array. Every asset stands alone and respects platform conventions.
6. **FR-6 Multi-segment expansion** — thread/script/quote/meta formats return structured segments
   (individual tweets, script beats, quote lines, meta fields), yielding 20+ discrete pieces overall.
7. **FR-7 Measurement** — compute character count per output and flag `overLimit` against
   platform limits (per-segment for multi-part formats).
8. **FR-8 Copy** — one-click copy of each output's body (plus hashtags when present).
9. **FR-9 Validation** — validate every request and response with zod; return typed errors (422 on
   invalid input) and a self-validated result envelope.
10. **FR-10 Graceful fallback** — when no API key is present, return deterministic, realistic mock
    content for every format so the product is fully demoable with zero configuration.
11. **FR-11 Reporting fields** — return source word count and generation wall-clock time to power the
    "time saved" KPI.
12. **FR-12 Scheduler export (roadmap)** — push approved outputs to Buffer/Typefully/Ayrshare.

## Non-functional requirements

- **Performance** — a 7-format job completes in < 20s p50 on live models; API `maxDuration` 60s.
- **Reliability** — if the model omits a requested format, the server backfills it so the response
  always contains one entry per requested format.
- **Type safety** — TypeScript strict; shared inferred types from zod schemas across API and UI.
- **Portability** — Node.js runtime (Fluid Compute); no edge-only APIs; model access via
  `"provider/model"` strings through the Vercel AI Gateway.
- **Accessibility** — keyboard-operable controls, sufficient contrast, labeled inputs.
- **Privacy** — source text is processed transiently for generation; no long-term storage in the
  scaffold. Production adds per-tenant isolation and retention controls.
- **Cost control** — voice extraction uses a fast/cheap model; generation uses a mid model; token
  budgets cap source length sent to the model.

## Success metrics / KPIs

- **Assets per source** — average discrete pieces produced per source asset (target ≥ 20).
- **Time saved** — estimated manual minutes replaced per job (baseline 120–240 min → < 1 min);
  measured via `elapsedMs` + assets count against a manual-time benchmark.
- **Engagement lift** — median engagement of repurposed posts vs. the account's prior baseline
  (target +15–30% on adopted channels), tracked once scheduler/analytics integrations ship.
- **Activation** — % of new users who complete a first generation (target ≥ 60%).
- **Retention** — 4-week retained creators (target ≥ 40%); volume utilization vs. tier cap.
- **Voice acceptance** — % of outputs used without heavy edits (proxy for voice quality).

## Monetization & pricing

Tiered SaaS by **monthly output volume** (see README for the table): Solo $19 (300 outputs),
Creator Pro $49 (1,200 + saved voices), Marketer $149 (5,000 + scheduler + seats), Agency $499+
(25,000 + multi-brand + API). Metered overage per 100 outputs; ~20% annual discount. Expansion
revenue via seats, extra brand voices, and API volume. Free trial: limited outputs, watermark-free.

## Go-to-market

- **Wedge:** solo creators via a zero-friction, no-key demo (sample content) shared on X/LinkedIn —
  the product itself is the marketing (repurpose our own launch post live).
- **Content-led growth:** publish repurposing playbooks; every output can carry an optional
  "made with" attribution on free tier.
- **Integrations as distribution:** Buffer/Typefully/Ayrshare marketplaces; a public API + Zapier for
  agencies.
- **Sales-assist for agencies:** multi-brand workspaces and volume pricing pitched directly.
- **Lifecycle:** onboarding that saves a brand voice in the first session (activation lever).

## Competitive landscape

- **Repurpose.io** — strong at mechanical video/audio redistribution and auto-posting across
  networks; weaker at true copy rewriting and brand voice. We differentiate on voice-preserving,
  copy-native generation across text formats, not just clip routing.
- **Opus Clip** — best-in-class at turning long video into short clips. Complementary: we own the
  written surface (threads, posts, captions, SEO) rather than video cutting.
- **Castmagic** — podcast/meeting-focused content generation from audio. We are source-agnostic
  (blog, video, podcast, notes) and format-broad with explicit platform-native limits and voice control.
- **Taplio** — LinkedIn-centric scheduling + AI. We are multi-platform and repurposing-first, and can
  feed tools like Taplio via scheduler export.

**Our edge:** (1) voice fingerprint reused across every format, (2) genuinely platform-native output
with live limit checks, (3) source-agnostic ingestion, (4) volume-based pricing aligned to value,
(5) API + multi-brand for agencies.

## Risks & mitigations

- **Voice fidelity doubts** — mitigate with explicit fingerprint the user can see/edit, and
  regenerate-single (roadmap). Show the extracted voice in the UI for trust.
- **Generic/AI-flat output** — per-format instructions enforce native structure; temperature tuned;
  hook-first rules; roadmap A/B hook variants.
- **Model cost at scale** — cheap model for voice, mid model for generation, source truncation, and
  volume-based pricing that passes cost through.
- **Platform limit drift** — limits centralized in `lib/formats.ts` for one-line updates.
- **Hallucinated facts** — system prompt forbids inventing facts; outputs are drawn from source.
- **Commoditization** — defend with saved voices, integrations, agency workflows, and data on
  engagement lift.

## Out of scope (v1)

- Auto-publishing/scheduling (export is roadmap; v1 is copy-to-clipboard).
- Video/image rendering (we output quote-graphic *text*, not rendered graphics).
- Built-in audio/video transcription (env hooks reserved; v1 accepts pasted transcripts).
- Persistent multi-user accounts, billing enforcement, and team RBAC (scaffold is stateless).
- Analytics dashboards for engagement lift (depends on scheduler integration).

## Milestones / roadmap

- **M0 (this scaffold):** paste ingestion, voice extraction, 10 formats, fan-out generation,
  measurement + over-limit flags, copy cards, mock fallback, typed/validated API.
- **M1:** saved brand voices, regenerate-single, inline edit, URL ingestion + auto-transcription.
- **M2:** scheduler export (Buffer/Typefully/Ayrshare), approval workflow, volume metering + billing.
- **M3:** multi-brand agency workspaces, seats/RBAC, public API + Zapier, A/B hook variants.
- **M4:** engagement-lift analytics, recommendation of best formats per source, autopilot mode.
