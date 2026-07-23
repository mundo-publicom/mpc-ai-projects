# Technical Spec — Faceless AI YouTube Generation

## 1. System overview

A Next.js (App Router) studio front-end plus a set of Node.js API routes that drive an async
generation pipeline. A topic is turned into a structured `Script` synchronously (fast LLM call),
then a `VideoJob` fans out across independent, retryable stages executed by background workers:
voiceover (TTS), visuals (image/video model), captions (forced alignment), thumbnail, assembly
(ffmpeg / cloud render), and publish (YouTube Data API). Generated media is stored as `Asset`s in
blob storage; job state lives in a database with a queue coordinating workers. Every AI/media
call degrades to mock output when its provider key is absent.

In the scaffold, script generation is a **real** `generateObject` call and the job store is
in-memory with a wall-clock-driven stage simulator; the media stages expose typed seams
(`synthesizeVoiceover`, `generateVisuals`, …) ready for real provider wiring.

## 2. Component breakdown

- **Studio UI (`app/page.tsx`, `components/`).** `TopicForm` (topic/niche/format/aspect input),
  `Storyboard` (scene cards + thumbnail + SEO), `JobList` (polls job status). Client components
  where interactivity is required; everything else is server-first.
- **Script generator (`lib/pipeline.ts::generateScript`).** `generateObject` with the shared
  `ScriptSchema`; mock fallback via `mockScript`. Owns scene-count sizing and the system prompt.
- **TTS / voiceover worker (`synthesizeVoiceover`).** Per-scene narration → audio assets via
  ElevenLabs; selects a `VoiceProfile`.
- **Image / video worker (`generateVisuals`).** Per-scene visual prompt → image asset via an
  image model; supports stock-video / motion-graphic treatments.
- **Captions worker.** Force-aligns kinetic captions to the concatenated voiceover track (e.g.
  whisper-based alignment) and emits a caption asset (ASS/SRT + styling).
- **Thumbnail worker.** Renders the thumbnail concept (background visual + overlay text) to an
  image asset.
- **Render / assembly worker.** Composites audio + visuals + captions into the final video using
  ffmpeg (self-hosted) or Shotstack (cloud); emits the `final` asset.
- **Publisher.** Uploads the final asset to YouTube via the Data API v3 with the AI-content
  disclosure flag, title, description, and tags.
- **Job store & queue (`lib/store.ts`).** Persists jobs and coordinates stage execution. Scaffold
  = in-memory singleton + time-based simulator; production = Postgres + Redis queue.

## 3. Data models (typed)

All schemas live in `lib/types.ts` (zod + inferred TS). Summary:

```ts
// Project — a channel/workspace grouping many jobs.
interface Project {
  id: string; name: string; niche: Niche;
  defaultVoiceProfileId: string; aspectRatio: "16:9" | "9:16" | "1:1";
  createdAt: string;
}

// Scene — one beat of the video (zod: SceneSchema).
interface Scene {
  index: number;              // 1-based ordinal
  title: string;              // label (not spoken)
  narration: string;          // spoken voiceover line(s)
  visualPrompt: string;       // model-ready image/video prompt
  onScreenText: string;       // short kinetic caption
  broll: "ai-image" | "stock-video" | "motion-graphic" | "screen-capture";
  durationSec: number;        // estimated spoken duration
}

// Script — full storyboard (zod: ScriptSchema).
interface Script {
  title: string; hook: string; scenes: Scene[];
  callToAction: string; description: string; tags: string[];
  thumbnailConcept: { visual: string; overlayText: string };
}

// VoiceProfile — TTS voice selection.
interface VoiceProfile {
  id: string; name: string; providerVoiceId: string;
  provider: "elevenlabs" | "openai" | "mock";
  language: string; stability: number; style: string;
}

// Asset — a produced media artifact, cost-attributed.
interface Asset {
  id: string; kind: "voiceover"|"image"|"video"|"captions"|"thumbnail"|"final";
  sceneIndex?: number; url?: string; mimeType?: string; bytes?: number;
  provider?: string; creditCost?: number;
}

// StageStatus — per-stage pipeline state.
interface StageStatus {
  stage: PipelineStage;               // script|voiceover|visuals|captions|thumbnail|assembly|publish
  state: "pending"|"running"|"done"|"failed"|"skipped";
  progress: number;                   // 0..100
  message?: string; startedAt?: string; finishedAt?: string;
}

// VideoJob — the unit of work.
interface VideoJob {
  id: string; projectId: string; topic: string; niche: Niche;
  aspectRatio: AspectRatio; format: "long-form"|"short";
  status: "queued"|"processing"|"completed"|"failed"|"canceled";
  stages: StageStatus[]; script?: Script; voiceProfileId?: string;
  assets: Asset[]; estimatedCredits: number; consumedCredits: number;
  youtubeVideoId?: string; createdAt: string; updatedAt: string;
}
```

## 4. API surface (routes + payloads)

### `POST /api/generate/script`
Request (`GenerateScriptRequestSchema`):
```json
{ "topic": "string(3..300)", "niche": "education|finance|motivation|tech|history|health|entertainment|true-crime",
  "targetLengthSec": 30-1200, "aspectRatio": "16:9|9:16|1:1", "format": "long-form|short" }
```
Response `200`:
```json
{ "script": Script,
  "meta": { "usedAI": bool, "mock": bool, "sceneCount": n,
            "estimatedDurationSec": n, "estimatedCredits": n } }
```
Errors: `400` invalid JSON, `422` zod validation (`{error, issues}`), `500` generation failure.

### `GET /api/generate/script`
Capability probe → `{ "aiEnabled": bool }`.

### `POST /api/jobs`
Request (`CreateJobRequestSchema`): topic/niche/aspectRatio/format/targetLengthSec, optional
`projectId`, `voiceProfileId`, and an optional pre-generated `script` (so the studio enqueues
exactly what it previewed). Response `201`: `{ job: VideoJob }`. Errors `400/422/500`.

### `GET /api/jobs`
Response `200`: `{ jobs: VideoJob[], summary: { total, completed, processing, creditsConsumed } }`
with live per-stage status.

### Planned (v1+)
`GET /api/jobs/:id` (detail), `POST /api/jobs/:id/retry` (retry failed stage),
`POST /api/jobs/:id/cancel`, `GET /api/youtube/callback` (OAuth), `POST /api/projects`,
`GET/POST /api/voices` (voice profiles).

## 5. AI / model usage

- **Script (structured generation).** `generateObject({ model: MODELS.smart, schema: ScriptSchema,
  temperature: 0.8, system, prompt })` — routed through the Vercel AI Gateway via a
  `"anthropic/claude-sonnet-5"` string. The zod schema is the single source of truth for the
  scene structure (title, narration, visualPrompt, onScreenText, broll, durationSec) and metadata.
  System prompt enforces retention structure, concrete visual prompts, and no fabricated stats.
- **Voiceover (TTS).** ElevenLabs `text-to-speech/{voice_id}` per scene using the selected
  `VoiceProfile` (stability/style). Model tier via config; audio stored as `voiceover` assets.
- **Images / B-roll (image model).** An image model (e.g. via the gateway / fal / Replicate)
  turns each scene's `visualPrompt` into a frame at the job's aspect ratio; stored as `image`
  assets. `stock-video`/`motion-graphic` treatments route to stock APIs / templated renders.
- **Captions.** Forced alignment (whisper-class) of the voiceover to produce word-timed kinetic
  captions.
- **Model routing.** `MODELS = { fast, smart, frontier }`; script uses `smart`, lightweight
  reformatting can use `fast`. `hasAI()`, `hasTTS()`, `hasImageGen()` gate real vs. mock paths.

## 6. Third-party integrations

- **Vercel AI Gateway** — unified `provider/model` routing for all LLM/image calls; failover and
  cost tracking. Key: `AI_GATEWAY_API_KEY` (fallback `ANTHROPIC_API_KEY`).
- **ElevenLabs** — TTS voiceover. Keys: `ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_VOICE_ID`.
- **Image provider (fal.ai / Replicate / gateway image model)** — B-roll images.
  Keys: `IMAGE_PROVIDER_API_KEY`, `FAL_API_KEY`.
- **ffmpeg (self-hosted) / Shotstack (cloud)** — assembly. `FFMPEG_PATH`, `SHOTSTACK_API_KEY`,
  `SHOTSTACK_ENV`.
- **YouTube Data API v3** — publishing with AI-content disclosure. `YOUTUBE_CLIENT_ID/SECRET`,
  `YOUTUBE_REDIRECT_URI`, `YOUTUBE_REFRESH_TOKEN`.
- **Blob storage + Redis** — asset storage and job queue. `BLOB_READ_WRITE_TOKEN`, `REDIS_URL`.

## 7. Security & privacy

- Secrets only via env (`.env.example` → `.env.local`); nothing committed. Least-privilege,
  per-provider keys; YouTube uses OAuth refresh tokens scoped to upload.
- Per-workspace data isolation; jobs and assets scoped by `projectId`.
- Input validation with zod on every route; typed JSON responses; no untrusted HTML rendered.
- Generated media stored with signed, expiring URLs; provider keys never reach the client
  (all AI/media calls are server-side in Node.js routes/workers).
- Compliance guardrails: AI-content disclosure flag set by default on publish; copyright
  checklist and license tracking on each `Asset` gate the publish stage.

## 8. Observability

- Structured logs per stage transition (`stage`, `jobId`, `state`, `durationMs`, `provider`,
  `creditCost`). Metrics: stage latency, success/failure rate, credits consumed per provider,
  videos/day, time-to-first-storyboard.
- Error capture on each worker with retry counts; dead-letter queue for repeatedly failing jobs.
- Cost attribution rollup per workspace for billing reconciliation.

## 9. Scaling considerations

- **Stateless routes; stateful workers.** API routes enqueue; workers pull from Redis and scale
  horizontally per stage (independent concurrency limits — visuals/assembly are the heavy ones).
- **Idempotent, retryable stages.** Each stage keyed by `(jobId, stage)`; completed assets are
  reused on retry so a failure never re-bills upstream work.
- **Backpressure & quotas.** Per-provider rate limits and YouTube quota respected with backoff;
  per-workspace concurrency caps prevent noisy-neighbor issues.
- **Cost caps.** Pre-flight credit estimate reserves budget; hard per-job and per-workspace caps.
- **Assembly offload.** ffmpeg on Fluid Compute / dedicated render nodes, or Shotstack for burst.

## 10. Testing strategy

- **Unit.** zod schema round-trips; `estimateCreditsFromScript/Params`; `initialStages`; the
  `advance()` time-based simulator (deterministic given `createdAt` + clock).
- **Contract.** Route tests for `/api/generate/script` and `/api/jobs` covering happy path,
  `422` validation, `400` bad JSON, and mock-vs-AI branching (`hasAI()` toggled).
- **Integration (v1+).** Mocked ElevenLabs/image/ffmpeg/YouTube clients verifying asset creation,
  stage transitions, retry idempotency, and disclosure-flag enforcement at publish.
- **E2E.** Studio flow: topic → storyboard preview → enqueue → job reaches `completed` in mock
  mode with zero keys.
- **Load.** Concurrent job creation to validate worker fan-out and queue backpressure.
