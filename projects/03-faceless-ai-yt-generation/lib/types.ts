import { z } from "zod";

/**
 * Domain types + zod schemas for the faceless YouTube generation pipeline.
 *
 * The zod schemas live here (not in the routes) so the same contract is shared
 * by the `generateObject` script call, the API validation layer, and the UI.
 */

/* -------------------------------------------------------------------------- */
/*  Script + scenes (the AI-generated storyboard)                             */
/* -------------------------------------------------------------------------- */

/** A single beat of the video. One scene ≈ one B-roll clip / image + narration. */
export const SceneSchema = z.object({
  /** Ordinal position, 1-based, for display + assembly ordering. */
  index: z.number().int().positive(),
  /** Short human label for the scene (used on scene cards, not spoken). */
  title: z.string().min(1).max(80),
  /** The voiceover line(s) spoken over this scene. Kept tight for pacing. */
  narration: z.string().min(1).max(600),
  /** Prompt for the image/video model that fills the frame behind narration. */
  visualPrompt: z.string().min(1).max(400),
  /** Kinetic on-screen text / caption emphasized during the scene. */
  onScreenText: z.string().max(120).default(""),
  /** Suggested B-roll treatment so the render worker knows what to source. */
  broll: z
    .enum(["ai-image", "stock-video", "motion-graphic", "screen-capture"])
    .default("ai-image"),
  /** Estimated spoken duration in seconds (drives timeline + cost estimate). */
  durationSec: z.number().min(1).max(60).default(6),
});
export type Scene = z.infer<typeof SceneSchema>;

/** The full structured script returned by the script-generation model. */
export const ScriptSchema = z.object({
  /** Click-optimized video title (< 70 chars for YouTube truncation). */
  title: z.string().min(1).max(100),
  /** The first spoken line — the retention hook (first 3 seconds). */
  hook: z.string().min(1).max(240),
  /** Ordered scenes that make up the body of the video. */
  scenes: z.array(SceneSchema).min(3).max(30),
  /** Closing call-to-action (subscribe / next video / product). */
  callToAction: z.string().min(1).max(240),
  /** SEO description for the YouTube upload. */
  description: z.string().min(1).max(1200),
  /** SEO tags for discovery. */
  tags: z.array(z.string().min(1).max(40)).min(3).max(20),
  /** Thumbnail concept: what the frame shows + the punchy overlay text. */
  thumbnailConcept: z.object({
    visual: z.string().min(1).max(300),
    overlayText: z.string().min(1).max(40),
  }),
});
export type Script = z.infer<typeof ScriptSchema>;

/* -------------------------------------------------------------------------- */
/*  Generation request                                                        */
/* -------------------------------------------------------------------------- */

export const AspectRatio = z.enum(["16:9", "9:16", "1:1"]);
export type AspectRatio = z.infer<typeof AspectRatio>;

/** Payload accepted by POST /api/generate/script. */
export const GenerateScriptRequestSchema = z.object({
  topic: z.string().min(3, "Give the generator a topic to work with.").max(300),
  /** Content niche — steers tone, pacing and vocabulary. */
  niche: z
    .enum([
      "education",
      "finance",
      "motivation",
      "tech",
      "history",
      "health",
      "entertainment",
      "true-crime",
    ])
    .default("education"),
  /** Target total length; the model sizes the scene count to match. */
  targetLengthSec: z.number().int().min(30).max(1200).default(180),
  aspectRatio: AspectRatio.default("16:9"),
  /** Delivery format changes hook density + caption style. */
  format: z.enum(["long-form", "short"]).default("long-form"),
});
export type GenerateScriptRequest = z.infer<typeof GenerateScriptRequestSchema>;

/* -------------------------------------------------------------------------- */
/*  Voice, assets, jobs                                                        */
/* -------------------------------------------------------------------------- */

export interface VoiceProfile {
  id: string;
  name: string;
  /** Provider voice id (e.g. ElevenLabs voice_id). */
  providerVoiceId: string;
  provider: "elevenlabs" | "openai" | "mock";
  /** BCP-47 language tag. */
  language: string;
  /** 0..1 stability / expressiveness knobs surfaced to the user. */
  stability: number;
  style: string;
}

export type AssetKind = "voiceover" | "image" | "video" | "captions" | "thumbnail" | "final";

export interface Asset {
  id: string;
  kind: AssetKind;
  /** Which scene this asset belongs to (undefined for whole-video assets). */
  sceneIndex?: number;
  /** Where the produced file lives once rendered (blob URL / S3 key). */
  url?: string;
  mimeType?: string;
  bytes?: number;
  /** Provider that produced the asset, for cost attribution. */
  provider?: string;
  /** Credits this asset consumed (rolled up into job cost). */
  creditCost?: number;
}

/** The ordered stages every video job passes through. */
export const PIPELINE_STAGES = [
  "script",
  "voiceover",
  "visuals",
  "captions",
  "thumbnail",
  "assembly",
  "publish",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type StageState = "pending" | "running" | "done" | "failed" | "skipped";

export interface StageStatus {
  stage: PipelineStage;
  state: StageState;
  /** 0..100 for stages that report granular progress. */
  progress: number;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
}

export type JobStatus = "queued" | "processing" | "completed" | "failed" | "canceled";

export interface VideoJob {
  id: string;
  projectId: string;
  topic: string;
  niche: GenerateScriptRequest["niche"];
  aspectRatio: AspectRatio;
  format: GenerateScriptRequest["format"];
  status: JobStatus;
  stages: StageStatus[];
  /** Attached once the script stage completes. */
  script?: Script;
  voiceProfileId?: string;
  assets: Asset[];
  /** Total credits reserved/consumed for the whole render. */
  estimatedCredits: number;
  consumedCredits: number;
  /** YouTube video id once published. */
  youtubeVideoId?: string;
  createdAt: string;
  updatedAt: string;
}

/** A channel/workspace grouping many video jobs. */
export interface Project {
  id: string;
  name: string;
  niche: GenerateScriptRequest["niche"];
  defaultVoiceProfileId: string;
  aspectRatio: AspectRatio;
  createdAt: string;
}

/** Payload accepted by POST /api/jobs. */
export const CreateJobRequestSchema = z.object({
  topic: z.string().min(3).max(300),
  niche: GenerateScriptRequestSchema.shape.niche,
  aspectRatio: AspectRatio.default("16:9"),
  format: GenerateScriptRequestSchema.shape.format,
  targetLengthSec: GenerateScriptRequestSchema.shape.targetLengthSec,
  projectId: z.string().optional(),
  voiceProfileId: z.string().optional(),
  /** Optional pre-generated script so the studio can enqueue what it previewed. */
  script: ScriptSchema.optional(),
});
export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;
