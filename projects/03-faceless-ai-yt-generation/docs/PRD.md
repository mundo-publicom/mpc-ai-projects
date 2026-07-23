# PRD — Faceless AI YouTube Generation

## 1. Overview

Faceless AI YouTube Generation is a studio + pipeline that converts a single topic (or a niche
seed) into a complete, publish-ready faceless video: a structured script, a scene-by-scene
storyboard with model-ready visual prompts, AI voiceover, force-aligned captions, a thumbnail
concept, and a render/assembly job that outputs the final file — optionally auto-published to
YouTube. The product targets operators who run *faceless* channels (no on-camera host: B-roll,
AI imagery, and motion graphics driven by narration) and want to produce at volume.

The core promise: **topic in → finished video out**, with a transparent per-video cost and the
throughput to run many channels from one seat.

## 2. Problem

Producing a single faceless video today means stitching together 5–8 tools (LLM for scripting,
a TTS app, a stock/image generator, a caption tool, a thumbnail editor, and a video editor),
plus manual hand-offs between each. That is 1–3 hours per video and a brittle, un-repeatable
process. Scaling to multiple channels multiplies the pain linearly. Creators also face
uncertainty on: (a) per-video cost, (b) YouTube policy compliance for AI/synthetic content, and
(c) copyright exposure from stock/music. There is no single system that owns the whole pipeline,
tracks cost per video, and enforces compliance guardrails.

## 3. Target users & personas

- **Faceless creator (solo operator).** Runs 1–3 channels (history, finance, motivation,
  true-crime, etc.). Values speed, low cost/video, and consistent voice/branding. Price
  sensitive; wants predictable credits. KPI they care about: videos/week and cost/video.
- **Content agency.** Produces videos for many client channels. Needs multi-workspace
  separation, team seats, per-client billing/credit pools, brand voice profiles, and reliable
  throughput. KPI: videos/day across accounts and margin per video.
- **Marketer / brand.** Uses faceless explainer/short content for top-of-funnel reach and SEO.
  Needs on-brand tone, product CTAs, and repurposing (one topic → long-form + shorts). KPI:
  watch-time proxy and cost-per-thousand-views.

## 4. User stories

1. As a faceless creator, I enter a topic and niche and get a full storyboard in under a minute
   so I can judge it before spending render credits.
2. As a creator, I can preview scene cards (narration + visual prompt + on-screen text) and
   tweak the target length/format (long-form vs. short) before rendering.
3. As a creator, I enqueue a render and watch each pipeline stage (voiceover, visuals, captions,
   thumbnail, assembly, publish) progress with a clear status.
4. As an agency, I organize jobs into projects/workspaces with their own default voice profile
   and credit pool.
5. As an agency, I see estimated vs. consumed credits per job so I can bill clients accurately.
6. As a marketer, I generate a long-form video and derive vertical shorts from the same script.
7. As any user, I get an AI-content disclosure and copyright checklist applied automatically
   before publishing to YouTube.
8. As any user, when I have no API keys configured, the studio still demonstrates the full flow
   on mock data.

## 5. Functional requirements

1. **FR-1 Script generation.** Given `{topic, niche, format, aspectRatio, targetLengthSec}`,
   produce a validated `Script` (title, hook, ordered `Scene[]`, CTA, SEO description, tags,
   thumbnail concept) using `generateObject` + a zod schema. Scene count is sized to the target
   length.
2. **FR-2 Storyboard preview.** Render scene cards, thumbnail mock, and SEO metadata client-side
   before any paid stage runs.
3. **FR-3 Job creation.** Enqueue a `VideoJob` from a topic or a pre-generated script; initialize
   the ordered stage list and reserve an estimated credit amount.
4. **FR-4 Pipeline stages.** Track `script → voiceover → visuals → captions → thumbnail →
   assembly → publish`, each with `pending|running|done|failed|skipped` and progress.
5. **FR-5 Voiceover.** Synthesize narration per scene via a TTS provider (ElevenLabs default),
   selecting a `VoiceProfile`; store audio assets and their credit cost.
6. **FR-6 Visuals.** Generate a B-roll image (or fetch stock/motion graphic) per scene from its
   visual prompt; store image assets.
7. **FR-7 Captions.** Force-align kinetic captions to the voiceover track.
8. **FR-8 Thumbnail.** Render the thumbnail concept (visual + overlay text) into an image asset.
9. **FR-9 Assembly.** Composite audio + visuals + captions into a final video via ffmpeg or a
   cloud render provider; store the final asset.
10. **FR-10 Publish.** Optionally upload to YouTube (default unlisted) via the Data API with an
    AI-content disclosure flag and generated title/description/tags.
11. **FR-11 Credit accounting.** Compute estimated and consumed credits per stage and per job.
12. **FR-12 Job listing.** List jobs with live per-stage status and rollup summary.
13. **FR-13 Mock fallback.** Every AI/media call degrades to realistic mock output when its key
    is absent, so the demo runs with zero secrets.
14. **FR-14 Input validation.** All API inputs validated with zod; typed JSON responses.

## 6. Non-functional requirements

- **Performance.** Script generation p95 < 15s. Storyboard preview is synchronous; heavy stages
  run async in a job queue.
- **Reliability.** Stages are idempotent and independently retryable; a failed stage does not
  lose completed upstream assets.
- **Scalability.** Horizontal worker fan-out; hundreds of concurrent jobs across workspaces.
- **Cost control.** Per-stage credit metering; hard caps and pre-flight estimates prevent
  runaway spend.
- **Security & privacy.** No secrets in the repo; per-workspace data isolation; least-privilege
  provider keys.
- **Compliance.** Automated AI-disclosure tagging and a copyright checklist gate before publish.
- **Observability.** Structured logs and metrics per stage; cost attribution per provider.

## 7. Success metrics / KPIs

- **Throughput:** videos generated per day (per user and platform-wide).
- **Cost/video:** average provider spend + credits consumed per finished video (target margin
  ≥ 60% on credits).
- **Time-to-first-storyboard:** median seconds from topic submit to preview (< 15s).
- **Render success rate:** % of enqueued jobs reaching `completed` without manual intervention
  (target > 97%).
- **Watch-time proxy:** average predicted retention score of generated scripts (hook strength,
  scene pacing) and, once published, actual average-view-duration pulled from YouTube Analytics.
- **Activation:** % of new accounts that publish ≥ 1 video in week one.
- **Revenue:** MRR + credit-pack revenue; credits consumed per active workspace.

## 8. Monetization & pricing

Two-part model: **subscription (access + included credits) + metered render credits**.

| Plan       | Price/mo | Included credits | Seats | Target                         |
| ---------- | -------- | ---------------- | ----- | ------------------------------ |
| Creator    | $29      | 1,500            | 1     | Solo faceless creator          |
| Studio     | $99      | 6,000            | 3     | Power creators / small teams   |
| Agency     | $399     | 30,000           | 10    | Agencies, multi-channel ops    |
| Enterprise | Custom   | Custom pool      | 25+   | High-volume / white-label      |

- **Credit model.** ~1 credit ≈ $0.01 of provider cost, sold at a margin. A typical 3-minute
  long-form video ≈ 90–140 credits (script 5, voiceover ~0.2/sec, visuals ~4/scene, captions 2,
  thumbnail 6, assembly ~0.5/sec, publish 1). Overage credit packs: $10 / 1,000.
- **Add-ons.** Voice cloning, priority render queue, A/B thumbnail testing.

## 9. Go-to-market

- **Wedge:** "Make a faceless video from a topic in one click" demo (works in mock mode) →
  free trial with starter credits.
- **Channels:** YouTube tutorials on faceless-channel building, creator communities/Discords,
  affiliate/referral credits, agency partnerships and white-label.
- **Content-led growth:** the tool dogfoods itself to produce its own marketing shorts.
- **Land-and-expand:** solo creators upgrade to Studio as channel count grows; agencies land on
  Agency/Enterprise for seats + credit pools.

## 10. Competitive landscape

- **InVideo AI** — prompt-to-video with editing chat; broad but generic, less faceless-channel
  workflow depth and cost transparency.
- **Pictory** — script/blog-to-video and repurposing; strong for text→video, weaker on
  end-to-end faceless generation and voice/brand control at scale.
- **Revid.ai** — faceless/shorts focused with scheduling; overlaps directly; we differentiate on
  structured storyboard control, credit transparency, and agency multi-workspace.
- **Autoshorts.ai** — automated faceless channels on autopilot; strong scheduling, less
  per-video creative control and storyboard editing.
- **Differentiators:** transparent per-video credit economics, editable structured storyboard
  before spend, typed pipeline with independent retryable stages, agency workspaces, and
  built-in AI-disclosure/copyright compliance.

## 11. Risks & mitigations

- **YouTube policy — AI/synthetic content & "inauthentic/repetitious" content.** YouTube requires
  disclosure of altered/synthetic realistic content and demonetizes mass-produced, low-effort
  content. *Mitigation:* auto-set the "altered content" disclosure flag on upload, encourage
  original narration/angle per video, quality thresholds, and per-channel variety.
- **AI-content disclosure obligations.** *Mitigation:* disclosure is applied by default at
  publish; users cannot silently disable it for realistic synthetic media.
- **Copyright (music, stock, likeness).** *Mitigation:* prefer generated or licensed assets,
  license-tracking on every `Asset`, block known-infringing sources, and a pre-publish checklist.
- **Provider cost volatility / margin erosion.** *Mitigation:* credits priced above cost with
  headroom; multi-provider routing via the AI Gateway; per-stage caps.
- **Model quality / hallucinated facts.** *Mitigation:* system prompt forbids fabricated
  statistics, human review step, and a "sources" field for factual niches.
- **Platform dependency (YouTube API quota/terms).** *Mitigation:* export-to-file always
  available; publishing is optional; respect quota with backoff.
- **Content moderation / brand safety.** *Mitigation:* niche allow-list, prompt safety filters,
  and workspace-level content policies.

## 12. Out of scope (v0)

- Real-time collaborative editing of storyboards.
- A full non-linear video editor timeline UI.
- Music composition / licensing marketplace.
- Analytics dashboards beyond the KPIs above.
- Payment/billing implementation (pricing is specified; Stripe integration is v2+).
- Multi-language dubbing (single-language voiceover in v0/v1).

## 13. Milestones / roadmap

- **M0 — Scaffold (this repo):** script/storyboard generation, job queue with simulated stages,
  credit accounting, mock fallback, studio dashboard.
- **M1 — Real media:** ElevenLabs voiceover, image-model B-roll, ffmpeg assembly, blob storage.
- **M2 — Publishing & workspaces:** YouTube OAuth upload with disclosure, projects/workspaces,
  scheduled uploads.
- **M3 — Growth & optimization:** A/B thumbnail + title testing, retention-analytics feedback,
  voice cloning, agency seats + billing (Stripe).
