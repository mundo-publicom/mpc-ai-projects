import { generateObject } from "ai";
import { z } from "zod";
import {
  BrandVoiceSchema,
  type BrandVoice,
  type FormatId,
  type Output,
} from "@/lib/types";
import { FORMATS, measure } from "@/lib/formats";

// ---------------------------------------------------------------------------
// Model access — routed through the Vercel AI Gateway via "provider/model"
// strings (see monorepo CONVENTIONS.md). No provider SDK is imported directly.
// ---------------------------------------------------------------------------

export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

export const hasAI = (): boolean =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Step 1 — Brand voice extraction
// ---------------------------------------------------------------------------

const VoiceExtractionSchema = z.object({
  summary: z
    .string()
    .describe("One paragraph capturing how this author sounds and writes."),
  tone: z
    .array(
      z.enum([
        "authoritative",
        "friendly",
        "witty",
        "inspirational",
        "technical",
        "contrarian",
        "empathetic",
        "playful",
      ])
    )
    .describe("2–4 dominant tone traits."),
  vocabulary: z
    .array(z.string())
    .describe("Signature words or phrases the author leans on."),
  avoid: z.array(z.string()).describe("Words/phrases that would feel off-brand."),
  readingLevel: z.string().describe('e.g. "grade 8", "expert".'),
  emojiUsage: z.enum(["none", "sparing", "liberal"]),
});

/**
 * Extract a reusable brand-voice fingerprint from the source text. Any fields
 * the caller already supplied are treated as overrides and win.
 */
export async function extractBrandVoice(
  sourceText: string,
  override?: Partial<BrandVoice>
): Promise<BrandVoice> {
  // If the caller gave us a rich enough voice, skip the model call.
  if (override?.summary && override.summary.length > 0) {
    return BrandVoiceSchema.parse({ id: "custom", name: "Custom voice", ...override });
  }

  if (!hasAI()) {
    return mockBrandVoice(override);
  }

  const { object } = await generateObject({
    model: MODELS.fast,
    schema: VoiceExtractionSchema,
    temperature: 0.2,
    system:
      "You are a brand-voice analyst. Read a writing sample and produce a precise, reusable voice fingerprint that another writer could follow to sound identical. Be concrete, not generic.",
    prompt: `Analyze the voice of the following content and return the fingerprint.\n\n---\n${sourceText.slice(0, 6000)}\n---`,
  });

  return BrandVoiceSchema.parse({
    id: "extracted",
    name: "Extracted voice",
    ...object,
    ...stripEmpty(override),
  });
}

// ---------------------------------------------------------------------------
// Step 2 — Multi-format generation (fan-out) via a single generateObject call
// that returns an ARRAY of typed outputs.
// ---------------------------------------------------------------------------

// Element schema for one generated asset. Kept lean for reliable structured
// output; server code enriches each element with counts/limits afterwards.
const GeneratedPieceSchema = z.object({
  format: z.enum(
    Object.keys(FORMATS) as [FormatId, ...FormatId[]]
  ),
  body: z.string().describe("Paste-ready text for the platform."),
  segments: z
    .array(z.string())
    .describe("Natural platform units (tweets, beats, quote lines). Empty if not applicable.")
    .default([]),
  hashtags: z.array(z.string()).default([]),
  notes: z.string().describe("One line: the hook/angle used.").default(""),
});

export async function generateOutputs(
  sourceText: string,
  voice: BrandVoice,
  formats: FormatId[]
): Promise<Output[]> {
  if (!hasAI()) {
    return formats.map((f) => mockOutput(f, sourceText));
  }

  const formatBrief = formats
    .map((f) => {
      const def = FORMATS[f];
      return `- ${def.id} (${def.label}): ${def.instruction}`;
    })
    .join("\n");

  const { object } = await generateObject({
    model: MODELS.smart,
    // Array output: `schema` is the ELEMENT schema, `object` is Output[].
    output: "array",
    schema: GeneratedPieceSchema,
    temperature: 0.7,
    system: buildVoiceSystemPrompt(voice),
    prompt:
      `Repurpose the SOURCE below into exactly one asset for EACH of the requested formats. ` +
      `Return one array element per format, using the exact format id given. ` +
      `Every asset must stand alone, be genuinely native to its platform, and preserve the brand voice.\n\n` +
      `REQUESTED FORMATS:\n${formatBrief}\n\n` +
      `SOURCE:\n---\n${sourceText.slice(0, 16000)}\n---`,
  });

  // Enrich + validate. Ensure every requested format is present (backfill with
  // a mock if the model skipped one) so the API contract is always honored.
  const byFormat = new Map<FormatId, (typeof object)[number]>();
  for (const piece of object) byFormat.set(piece.format, piece);

  return formats.map((f) => {
    const piece = byFormat.get(f);
    if (!piece) return mockOutput(f, sourceText);
    const def = FORMATS[f];
    const segments = piece.segments?.length ? piece.segments : undefined;
    const { charCount, overLimit } = measure(f, piece.body, segments);
    return {
      format: f,
      platform: def.platform,
      label: def.label,
      body: piece.body,
      segments,
      hashtags: piece.hashtags ?? [],
      charCount,
      overLimit,
      notes: piece.notes || undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildVoiceSystemPrompt(voice: BrandVoice): string {
  const lines = [
    "You are an elite content repurposing engine that rewrites long-form assets into platform-native pieces while preserving a specific brand voice.",
    "",
    "BRAND VOICE:",
    voice.summary ? `Summary: ${voice.summary}` : null,
    voice.tone.length ? `Tone: ${voice.tone.join(", ")}` : null,
    voice.vocabulary.length ? `Signature vocabulary: ${voice.vocabulary.join(", ")}` : null,
    voice.avoid.length ? `Avoid: ${voice.avoid.join(", ")}` : null,
    `Reading level: ${voice.readingLevel}`,
    `Emoji usage: ${voice.emojiUsage}`,
    "",
    "RULES:",
    "- Never invent facts not supported by the source.",
    "- No hashtag spam; keep hashtags relevant and platform-appropriate.",
    "- Respect each platform's conventions and length norms.",
    "- Lead with the strongest hook; earn the scroll.",
  ].filter(Boolean);
  return lines.join("\n");
}

function stripEmpty<T extends object>(obj?: Partial<T>): Partial<T> {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => {
      if (v == null) return false;
      if (typeof v === "string") return v.length > 0;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    })
  ) as Partial<T>;
}

// ---------------------------------------------------------------------------
// Mock fallback — realistic content so the demo runs with zero API keys.
// ---------------------------------------------------------------------------

export function mockBrandVoice(override?: Partial<BrandVoice>): BrandVoice {
  return BrandVoiceSchema.parse({
    id: "mock",
    name: "Mock voice",
    summary:
      "Clear, confident, and practical. Speaks directly to the reader, favors short sentences and concrete examples over abstraction.",
    tone: ["authoritative", "friendly"],
    vocabulary: ["here's the thing", "the real win", "in practice"],
    avoid: ["synergy", "leverage (as a verb)", "circle back"],
    readingLevel: "grade 8",
    emojiUsage: "sparing",
    ...stripEmpty(override),
  });
}

function firstSentence(text: string): string {
  const s = text.trim().replace(/\s+/g, " ");
  const m = s.match(/^.{20,140}?[.!?](\s|$)/);
  return (m ? m[0] : s.slice(0, 120)).trim();
}

function keyPhrase(text: string): string {
  const words = text.trim().split(/\s+/).slice(0, 8).join(" ");
  return words.replace(/[.,;:]+$/, "");
}

/** Deterministic, format-appropriate mock so the UI shows real structure. */
export function mockOutput(format: FormatId, source: string): Output {
  const def = FORMATS[format];
  const hook = firstSentence(source);
  const topic = keyPhrase(source);
  let body = "";
  let segments: string[] | undefined;
  let hashtags: string[] = [];

  switch (format) {
    case "x_thread": {
      segments = [
        `1/ ${hook} 🧵`,
        `2/ Most people get ${topic} wrong because they skip the fundamentals.`,
        `3/ Here's the framework that actually works, step by step.`,
        `4/ Step 1: start smaller than feels comfortable. Momentum compounds.`,
        `5/ Step 2: measure one thing. Everything else is noise for now.`,
        `6/ The real win: consistency beats intensity every single time.`,
        `7/ That's the thread. Save it, and follow for more breakdowns like this.`,
      ];
      body = segments.join("\n\n");
      hashtags = ["#buildinpublic"];
      break;
    }
    case "linkedin_post": {
      body = `${hook}\n\nI used to overcomplicate this.\n\nThen I realized the pattern:\n\n→ Start with the problem, not the tool.\n→ Ship the smallest version that helps someone.\n→ Let feedback, not opinions, set the roadmap.\n\nIn practice, that one shift changed how our whole team works.\n\nWhat's the simplest change that made the biggest difference for you?`;
      break;
    }
    case "instagram_caption": {
      body = `${hook}\n\nSave this one 👇\n\nThe thing nobody tells you about ${topic}: the basics are boring, and that's exactly why they work.\n\nStart today. Comment "ready" and I'll send the checklist.`;
      hashtags = ["#creatorlife", "#contentstrategy", "#growthtips", "#learnonhere"];
      break;
    }
    case "tiktok_script": {
      segments = [
        `[0-3s] Hook: "${hook}" — on-screen: STOP scrolling`,
        `[3-10s] Point 1: the mistake everyone makes with ${topic}`,
        `[10-20s] Point 2: the 3-step fix (show it fast)`,
        `[20-30s] Point 3: the result you can expect`,
        `[30-35s] CTA: "Follow for part 2" — on-screen: PART 2 TMRW`,
      ];
      body = segments.join("\n");
      break;
    }
    case "newsletter_section": {
      const subject = `The truth about ${topic}`;
      body = `Subject: ${subject}\n\nHey —\n\n${hook}\n\nHere's the thing: the fundamentals win. This week I broke down the exact steps we use, and the one metric worth watching. Reply and tell me where you're stuck — I read every response.\n\nTalk soon.`;
      segments = [`Subject: ${subject}`];
      break;
    }
    case "quote_graphics": {
      segments = [
        "Consistency beats intensity — every single time.",
        "Start smaller than feels comfortable.",
        "Measure one thing. Ignore the rest.",
        "The basics are boring. That's why they work.",
        "Momentum compounds faster than motivation.",
      ];
      body = segments.join("\n");
      break;
    }
    case "seo_meta": {
      const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      segments = [
        `Title: ${capitalize(topic)}: The Practical Guide`,
        `Description: ${hook.slice(0, 150)}`,
        `Slug: ${slug || "practical-guide"}`,
        `Keywords: ${topic}, guide, framework, tips`,
      ];
      body = segments.join("\n");
      break;
    }
    case "youtube_description": {
      body = `${capitalize(topic)} — the practical breakdown.\n\n${hook}\n\nIn this video:\n• The most common mistake\n• A simple 3-step framework\n• What results to expect\n\n00:00 Intro\n00:45 The mistake\n02:10 The framework\n05:30 Results\n\n👉 Subscribe for weekly breakdowns.`;
      break;
    }
    case "facebook_post": {
      body = `${hook}\n\nOkay, real talk. Most of us make ${topic} way harder than it needs to be. Here's what finally clicked for me — and it's almost embarrassingly simple.\n\nWhat's worked for you? Drop it below 👇`;
      break;
    }
    case "threads_post": {
      body = `${hook}\n\nHot take: ${topic} isn't complicated — we just like feeling busy. Simplify one thing today.`;
      break;
    }
  }

  const { charCount, overLimit } = measure(format, body, segments);
  return {
    format,
    platform: def.platform,
    label: def.label,
    body,
    segments,
    hashtags,
    charCount,
    overLimit,
    notes: "Mock output (no API key set) — set AI_GATEWAY_API_KEY for live generation.",
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
