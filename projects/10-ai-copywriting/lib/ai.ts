import { generateText, generateObject } from "ai";
import type { BrandVoice, Brief, CopyType, Draft } from "./types";
import { COPY_TYPES } from "./types";
import { describeFramework, type FrameworkId } from "./frameworks";

/**
 * Shared model-access layer. All calls route through the Vercel AI Gateway via
 * plain `"provider/model"` strings — no provider SDK wiring.
 */
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

/**
 * True when an AI Gateway (or direct Anthropic) key is present. When false,
 * API routes fall back to a deterministic mock generator so the demo runs with
 * zero keys.
 */
export const hasAI = (): boolean =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

/* -------------------------------------------------------------------------- */
/* Prompt construction                                                        */
/* -------------------------------------------------------------------------- */

function list(label: string, items: string[]): string {
  if (!items || items.length === 0) return "";
  return `${label}: ${items.filter((s) => s.trim().length > 0).join(", ")}`;
}

/** Render the brand voice into a reusable system-prompt block. */
export function renderBrandVoice(bv: BrandVoice): string {
  const lines = [
    `Brand voice profile: "${bv.name}"`,
    list("Tone", bv.tone),
    bv.audience ? `Speaks to: ${bv.audience}` : "",
    `Reading level: ${bv.readingLevel}`,
    list("Always do", bv.doList),
    list("Never do", bv.avoidList),
    list("Lean into these words", bv.powerWords),
    list("FORBIDDEN — must never appear", bv.forbiddenWords),
    bv.sample ? `On-brand writing sample:\n"""${bv.sample}"""` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Render the brief into a prompt block. */
export function renderBrief(brief: Brief, copyType: CopyType): string {
  const meta = COPY_TYPES[copyType];
  const lines = [
    `Copy type: ${meta.label} — ${meta.description}`,
    `Format guidance: ${meta.guidance}`,
    `Product / offer: ${brief.product}`,
    brief.audience ? `Target for this piece: ${brief.audience}` : "",
    `Campaign goal: ${brief.goal}`,
    list("Key benefits", brief.keyBenefits),
    list("Proof points", brief.proofPoints),
    brief.cta ? `Desired CTA: ${brief.cta}` : "",
    list("Must-use keywords", brief.keywords),
    brief.constraints ? `Constraints: ${brief.constraints}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** System prompt for the generation pass. */
export function buildGenerationSystem(bv: BrandVoice, frameworks: FrameworkId[]): string {
  return [
    "You are a senior direct-response copywriter. You write copy that is",
    "on-brand, specific, and conversion-focused — never generic filler.",
    "",
    renderBrandVoice(bv),
    "",
    "You will produce one draft per requested framework. Each draft must be",
    "structured around its assigned framework's beats:",
    "",
    frameworks
      .map((f, i) => `Draft ${i + 1} → ${describeFramework(f)}`)
      .join("\n\n"),
    "",
    "Rules:",
    "- Respect every brand-voice do/don't rule and the forbidden-words list.",
    "- Make each draft meaningfully different, not a reword of the others.",
    "- Fill only the fields that make sense for the copy type; leave others empty.",
    "- No fabricated statistics or claims beyond the provided proof points.",
  ].join("\n");
}

/** System prompt for the critique/scoring pass. */
export function buildCritiqueSystem(bv: BrandVoice): string {
  return [
    "You are a strict copy-critique engine. Score each draft honestly on a",
    "0-100 scale — most first drafts land 55-80; reserve 90+ for exceptional",
    "copy. Evaluate clarity, persuasion, brand fit, brevity, and CTA strength.",
    "Judge how well the draft executes its stated framework's beats.",
    "",
    "Brand-safety check: fail a draft if it uses any forbidden word/claim or",
    "violates a 'never do' rule. Estimate plagiarism risk (low/medium/high)",
    "based on how closely it echoes famous slogans or clichés.",
    "",
    renderBrandVoice(bv),
    "",
    "Return one critique per draft, in the same order.",
  ].join("\n");
}

/** Prompt body listing drafts for the critique pass. */
export function renderDraftsForCritique(drafts: Draft[]): string {
  return drafts
    .map((d, i) => {
      const c = d.content;
      const parts = [
        `Draft ${i + 1} (framework ${d.framework}):`,
        c.headline ? `Headline: ${c.headline}` : "",
        c.subheadline ? `Subheadline: ${c.subheadline}` : "",
        c.body ? `Body: ${c.body}` : "",
        c.cta ? `CTA: ${c.cta}` : "",
      ];
      return parts.filter(Boolean).join("\n");
    })
    .join("\n\n");
}

// Re-export the primitives used across the app so routes import from one place.
export { generateText, generateObject };
