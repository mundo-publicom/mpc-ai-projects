import { z } from "zod";

/**
 * Domain types for the AI Content Repurposing engine.
 *
 * Flow: a long-form `Source` + a `BrandVoice` fingerprint feed a `RepurposeJob`,
 * which fans out into many platform-native `Output` pieces.
 *
 * All external inputs are validated with the zod schemas exported here; the
 * inferred TypeScript types are the single source of truth used across the app.
 */

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export const SourceKind = z.enum([
  "blog_post",
  "youtube_transcript",
  "podcast_transcript",
  "newsletter",
  "webinar",
  "raw_notes",
]);
export type SourceKind = z.infer<typeof SourceKind>;

export const SourceSchema = z.object({
  id: z.string(),
  kind: SourceKind.default("blog_post"),
  title: z.string().max(300).optional(),
  /** Full long-form text. This is the asset being repurposed. */
  text: z.string().min(1),
  /** Optional origin URL (blog permalink, YouTube video, RSS item). */
  url: z.string().url().optional(),
  /** Rough word count, computed server-side for KPI reporting. */
  wordCount: z.number().int().nonnegative().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

// ---------------------------------------------------------------------------
// Brand voice
// ---------------------------------------------------------------------------

export const ToneTrait = z.enum([
  "authoritative",
  "friendly",
  "witty",
  "inspirational",
  "technical",
  "contrarian",
  "empathetic",
  "playful",
]);
export type ToneTrait = z.infer<typeof ToneTrait>;

/**
 * A reusable fingerprint of how a creator/brand sounds. Either supplied by the
 * user or extracted from sample content by the voice-analysis step.
 */
export const BrandVoiceSchema = z.object({
  id: z.string().default("default"),
  name: z.string().default("Default voice"),
  /** One-paragraph description of the voice, used directly in the system prompt. */
  summary: z.string().default(""),
  tone: z.array(ToneTrait).default([]),
  /** Signature words/phrases the brand leans on. */
  vocabulary: z.array(z.string()).default([]),
  /** Words/phrases to avoid (banned jargon, competitor names, cliches). */
  avoid: z.array(z.string()).default([]),
  /** Reading level target, e.g. "grade 8", "expert". */
  readingLevel: z.string().default("grade 8"),
  /** Whether emojis are on-brand. */
  emojiUsage: z.enum(["none", "sparing", "liberal"]).default("sparing"),
});
export type BrandVoice = z.infer<typeof BrandVoiceSchema>;

// ---------------------------------------------------------------------------
// Formats & outputs
// ---------------------------------------------------------------------------

export const FormatId = z.enum([
  "x_thread",
  "linkedin_post",
  "instagram_caption",
  "tiktok_script",
  "newsletter_section",
  "quote_graphics",
  "seo_meta",
  "youtube_description",
  "facebook_post",
  "threads_post",
]);
export type FormatId = z.infer<typeof FormatId>;

export const Platform = z.enum([
  "x",
  "linkedin",
  "instagram",
  "tiktok",
  "email",
  "web",
  "youtube",
  "facebook",
  "threads",
]);
export type Platform = z.infer<typeof Platform>;

/**
 * A single generated, platform-native asset. `body` is the paste-ready text;
 * `segments` optionally breaks it into the natural units of the platform
 * (individual tweets in a thread, each quote-card line, script beats).
 */
export const OutputSchema = z.object({
  format: FormatId,
  platform: Platform,
  /** Human label, e.g. "X / Twitter thread". */
  label: z.string(),
  /** Paste-ready full text. */
  body: z.string(),
  /** Optional structured breakdown of the body into platform units. */
  segments: z.array(z.string()).optional(),
  /** Suggested hashtags (without the leading text of the body). */
  hashtags: z.array(z.string()).default([]),
  /** Character count of `body`, filled server-side. */
  charCount: z.number().int().nonnegative().default(0),
  /** True when `charCount` exceeds the platform hard limit. */
  overLimit: z.boolean().default(false),
  /** One-line rationale describing the hook/angle used. */
  notes: z.string().optional(),
});
export type Output = z.infer<typeof OutputSchema>;

// ---------------------------------------------------------------------------
// Repurpose job (request + result envelope)
// ---------------------------------------------------------------------------

export const JobStatus = z.enum([
  "queued",
  "analyzing_voice",
  "generating",
  "completed",
  "failed",
]);
export type JobStatus = z.infer<typeof JobStatus>;

/** Public request body for POST /api/repurpose. */
export const RepurposeRequestSchema = z.object({
  /** Raw long-form text to repurpose. */
  source: z.string().min(30, "Provide at least a paragraph of source content."),
  kind: SourceKind.optional(),
  title: z.string().max(300).optional(),
  url: z.string().url().optional(),
  /** Formats to generate. Defaults to a sensible starter pack when omitted. */
  formats: z.array(FormatId).min(1).max(20).optional(),
  /**
   * Optional brand voice. If omitted, the engine extracts a voice fingerprint
   * from the source before generating.
   */
  brandVoice: BrandVoiceSchema.partial().optional(),
});
export type RepurposeRequest = z.infer<typeof RepurposeRequestSchema>;

export const RepurposeResultSchema = z.object({
  jobId: z.string(),
  status: JobStatus,
  /** Whether real AI ran (true) or the mock fallback was used (false). */
  usedAI: z.boolean(),
  model: z.string().optional(),
  brandVoice: BrandVoiceSchema,
  source: z.object({
    kind: SourceKind,
    wordCount: z.number().int().nonnegative(),
    title: z.string().optional(),
  }),
  outputs: z.array(OutputSchema),
  /** Milliseconds of wall-clock generation time (KPI: time saved). */
  elapsedMs: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type RepurposeResult = z.infer<typeof RepurposeResultSchema>;
