import { z } from "zod";
import { FRAMEWORK_IDS } from "./frameworks";

/**
 * Domain models for the AI Copywriting studio.
 *
 * Every model has a matching zod schema so a single definition validates API
 * inputs, structures AI (`generateObject`) output, and types the UI. Schemas
 * that shape model output are kept lean (no `.default()` on required fields)
 * so the provider returns exactly what we ask for.
 */

/* -------------------------------------------------------------------------- */
/* Copy types                                                                 */
/* -------------------------------------------------------------------------- */

export const CopyTypeSchema = z.enum([
  "google_ad",
  "meta_ad",
  "cold_email",
  "nurture_email",
  "landing_section",
  "product_description",
  "headline",
]);
export type CopyType = z.infer<typeof CopyTypeSchema>;

export interface CopyTypeMeta {
  id: CopyType;
  label: string;
  description: string;
  /** Soft length guidance surfaced to the model and shown in the UI. */
  guidance: string;
  /** Channel this copy ships to — used for the export mapping. */
  channel: "search" | "social" | "email" | "web";
}

export const COPY_TYPES: Record<CopyType, CopyTypeMeta> = {
  google_ad: {
    id: "google_ad",
    label: "Google Ad (RSA)",
    description: "Responsive search ad — punchy headlines + descriptions.",
    guidance: "Headline ≤ 30 chars, description ≤ 90 chars. Keyword-relevant, benefit-led.",
    channel: "search",
  },
  meta_ad: {
    id: "meta_ad",
    label: "Meta Ad",
    description: "Facebook / Instagram primary text with a hook and CTA.",
    guidance: "Scroll-stopping first line, 1-3 short paragraphs, one clear CTA.",
    channel: "social",
  },
  cold_email: {
    id: "cold_email",
    label: "Cold Email",
    description: "First-touch outbound email — subject + concise body.",
    guidance: "Subject ≤ 60 chars, body under 120 words, one ask, no fluff.",
    channel: "email",
  },
  nurture_email: {
    id: "nurture_email",
    label: "Nurture Email",
    description: "Warm sequence email that builds trust toward conversion.",
    guidance: "Value-first, conversational, single CTA, 120-200 words.",
    channel: "email",
  },
  landing_section: {
    id: "landing_section",
    label: "Landing Section",
    description: "Hero or value section — headline, subhead, body, CTA.",
    guidance: "Headline is the promise; subhead clarifies; body proves; CTA acts.",
    channel: "web",
  },
  product_description: {
    id: "product_description",
    label: "Product Description",
    description: "Ecommerce PDP copy that converts browsers to buyers.",
    guidance: "Lead with the benefit, weave in features, close with reassurance.",
    channel: "web",
  },
  headline: {
    id: "headline",
    label: "Headline",
    description: "A single high-impact headline / hook.",
    guidance: "≤ 12 words, concrete, specific, one idea. No body copy.",
    channel: "web",
  },
};

/* -------------------------------------------------------------------------- */
/* Brand voice                                                                */
/* -------------------------------------------------------------------------- */

export const ReadingLevelSchema = z.enum([
  "simple",
  "conversational",
  "professional",
  "expert",
]);
export type ReadingLevel = z.infer<typeof ReadingLevelSchema>;

export const BrandVoiceSchema = z.object({
  /** Display name of the profile, e.g. "Acme — Playful". */
  name: z.string().min(1).max(80),
  /** Tone descriptors, e.g. ["confident", "warm", "witty"]. */
  tone: z.array(z.string()).default([]),
  /** Who the brand speaks to. */
  audience: z.string().max(500).default(""),
  readingLevel: ReadingLevelSchema.default("conversational"),
  /** Stylistic "do" rules (e.g. "use active voice", "short sentences"). */
  doList: z.array(z.string()).default([]),
  /** Stylistic "don't" rules (e.g. "no jargon", "never say 'synergy'"). */
  avoidList: z.array(z.string()).default([]),
  /** Preferred power words / vocabulary to lean into. */
  powerWords: z.array(z.string()).default([]),
  /** Hard brand-safety blocklist — words/claims that must never appear. */
  forbiddenWords: z.array(z.string()).default([]),
  /** A short sample of on-brand writing the model can pattern-match. */
  sample: z.string().max(4000).default(""),
});
export type BrandVoice = z.infer<typeof BrandVoiceSchema>;

/* -------------------------------------------------------------------------- */
/* Brief                                                                      */
/* -------------------------------------------------------------------------- */

export const CampaignGoalSchema = z.enum([
  "awareness",
  "clicks",
  "leads",
  "sales",
  "signups",
  "retention",
]);
export type CampaignGoal = z.infer<typeof CampaignGoalSchema>;

export const BriefSchema = z.object({
  /** The product, offer or feature being marketed. */
  product: z.string().min(1).max(500),
  /** Who this specific piece targets (may narrow the brand audience). */
  audience: z.string().max(500).default(""),
  goal: CampaignGoalSchema.default("clicks"),
  /** The single most important benefit to lead with. */
  keyBenefits: z.array(z.string()).default([]),
  /** Credible proof — stats, awards, testimonials, guarantees. */
  proofPoints: z.array(z.string()).default([]),
  /** Desired call to action, e.g. "Start free trial". */
  cta: z.string().max(120).default(""),
  /** Keywords / phrases to include (SEO or ad relevance). */
  keywords: z.array(z.string()).default([]),
  /** Freeform constraints (max length, must mention price, etc.). */
  constraints: z.string().max(1000).default(""),
});
export type Brief = z.infer<typeof BriefSchema>;

/* -------------------------------------------------------------------------- */
/* Critique / scoring                                                         */
/* -------------------------------------------------------------------------- */

export const FrameworkIdSchema = z.enum(FRAMEWORK_IDS);

export const PlagiarismRiskSchema = z.enum(["low", "medium", "high"]);
export type PlagiarismRisk = z.infer<typeof PlagiarismRiskSchema>;

/** Structured self-critique the model returns for each variant. */
export const CritiqueSchema = z.object({
  /** 0-100 headline quality score. */
  overallScore: z.number().min(0).max(100),
  /** Transparent sub-scores (each 0-100). */
  breakdown: z.object({
    clarity: z.number().min(0).max(100),
    persuasion: z.number().min(0).max(100),
    brandFit: z.number().min(0).max(100),
    brevity: z.number().min(0).max(100),
    ctaStrength: z.number().min(0).max(100),
  }),
  /** Which framework the variant executed and how well it hit the beats. */
  framework: FrameworkIdSchema,
  /** One-to-three sentences explaining the score. */
  rationale: z.string(),
  /** Concrete, actionable suggestions to improve the variant. */
  suggestions: z.array(z.string()).default([]),
  /** Brand-safety verdict — passes unless a forbidden term/claim slipped in. */
  brandSafety: z.object({
    passed: z.boolean(),
    /** Specific violations found (empty when passed). */
    flags: z.array(z.string()).default([]),
  }),
  /** Heuristic risk that the copy echoes a well-known slogan. */
  plagiarismRisk: PlagiarismRiskSchema,
});
export type Critique = z.infer<typeof CritiqueSchema>;

/* -------------------------------------------------------------------------- */
/* Variant                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The raw copy content a variant carries. Different copy types populate
 * different fields; the UI renders whatever is present. Kept flat so a single
 * `generateObject` schema covers every copy type.
 */
export const CopyContentSchema = z.object({
  /** Primary headline / subject line / hook. */
  headline: z.string(),
  /** Optional supporting subheadline (landing sections). */
  subheadline: z.string().optional(),
  /** Main body copy. May be empty for headline-only types. */
  body: z.string(),
  /** Call-to-action text. */
  cta: z.string().optional(),
  /** RSA-style extra headlines (google_ad). */
  altHeadlines: z.array(z.string()).optional(),
  /** RSA-style extra descriptions (google_ad). */
  altDescriptions: z.array(z.string()).optional(),
});
export type CopyContent = z.infer<typeof CopyContentSchema>;

/** A single generated option, including its critique. */
export const VariantSchema = z.object({
  id: z.string(),
  copyType: CopyTypeSchema,
  framework: FrameworkIdSchema,
  content: CopyContentSchema,
  critique: CritiqueSchema,
});
export type Variant = z.infer<typeof VariantSchema>;

/* The lean schema handed to the model for the *generation* pass (no id / no
 * critique — those are attached server-side / by the critique pass). */
export const DraftSchema = z.object({
  framework: FrameworkIdSchema,
  content: CopyContentSchema,
});
export type Draft = z.infer<typeof DraftSchema>;

export const DraftListSchema = z.object({
  drafts: z.array(DraftSchema),
});

export const CritiqueListSchema = z.object({
  critiques: z.array(CritiqueSchema),
});

/* -------------------------------------------------------------------------- */
/* API payloads                                                               */
/* -------------------------------------------------------------------------- */

export const GenerateCopyRequestSchema = z.object({
  brandVoice: BrandVoiceSchema,
  brief: BriefSchema,
  copyType: CopyTypeSchema,
  /** How many variants to generate (capped server-side). */
  count: z.number().int().min(1).max(8).default(3),
});
export type GenerateCopyRequest = z.infer<typeof GenerateCopyRequestSchema>;

export const GenerateCopyResponseSchema = z.object({
  variants: z.array(VariantSchema),
  meta: z.object({
    usedAI: z.boolean(),
    model: z.string().nullable(),
    /** Credits consumed by this generation (generation + critique passes). */
    creditsUsed: z.number().int(),
    copyType: CopyTypeSchema,
    generatedAt: z.string(),
  }),
});
export type GenerateCopyResponse = z.infer<typeof GenerateCopyResponseSchema>;
