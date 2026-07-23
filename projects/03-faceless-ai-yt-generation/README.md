# Faceless AI YouTube Generation

> **Business case.** Faceless channel operators, content agencies, and marketers pay a
> **monthly subscription** for studio access and buy **per-video render credits** on top.
> The product collapses a multi-tool, multi-hour workflow (scripting, voiceover, B-roll,
> captions, thumbnail, editing) into a single "topic in → finished video out" pipeline, so a
> one-person operation can run several faceless channels at scale. Revenue = seats × plan
> price + credit consumption; gross margin is protected by pricing credits above provider cost.

A pipeline that turns a topic/niche into a full faceless video:
**script → scene breakdown → B-roll/image prompts → AI voiceover → captions → thumbnail concept → assembly job.**

---

## Features

- **Structured script generation** — topic + niche → title, 3-second hook, ordered scenes
  (narration, model-ready visual prompt, on-screen caption, B-roll treatment, duration), CTA,
  SEO description, tags, and a thumbnail concept. Powered by AI SDK v5 `generateObject` + zod.
- **Storyboard preview** — scene-by-scene cards, thumbnail mock, and SEO metadata before you
  spend a single render credit.
- **Job pipeline** — enqueue a render and watch per-stage status advance across
  `script → voiceover → visuals → captions → thumbnail → assembly → publish`.
- **Credit economics built in** — every stage has a credit cost; jobs show estimated vs.
  consumed credits so billing is transparent.
- **Graceful mock mode** — with zero API keys the whole flow runs on realistic mock data.
- **Integration-ready** — typed seams for ElevenLabs (TTS), an image model (B-roll),
  ffmpeg/Shotstack (assembly), and the YouTube Data API (publish).

## Quickstart

```bash
pnpm install          # from the monorepo root
cp projects/03-faceless-ai-yt-generation/.env.example \
   projects/03-faceless-ai-yt-generation/.env.local   # optional — mock mode needs no keys
pnpm --filter @mmai/faceless-ai-yt-generation dev
```

Open http://localhost:3000, enter a topic (e.g. *"Why the Roman concrete recipe was lost for
1500 years"*), and generate a storyboard. Click **Enqueue render** to push a job through the
simulated pipeline. Set `AI_GATEWAY_API_KEY` in `.env.local` to switch from mock to live
script generation.

### Core endpoints

| Method | Route                      | Purpose                                              |
| ------ | -------------------------- | ---------------------------------------------------- |
| `POST` | `/api/generate/script`     | Topic → structured storyboard (`generateObject`).    |
| `GET`  | `/api/generate/script`     | AI-capability probe for the UI.                      |
| `POST` | `/api/jobs`                | Enqueue a video render job (accepts a preview script).|
| `GET`  | `/api/jobs`                | List jobs with live per-stage pipeline status.       |

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the Mermaid pipeline diagram and job
lifecycle, [`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md) for data models and integrations,
and [`docs/PRD.md`](docs/PRD.md) for personas, pricing, and go-to-market.

## Roadmap

- **v0 (this scaffold):** script/storyboard generation, job queue with simulated stages, mock
  fallback, credit accounting.
- **v1:** real ElevenLabs voiceover + image-model B-roll, ffmpeg assembly worker, blob storage.
- **v2:** YouTube OAuth publishing, scheduled auto-uploads, multi-channel workspaces.
- **v3:** A/B thumbnail + title testing, retention analytics feedback loop, voice cloning,
  team seats and agency billing.
