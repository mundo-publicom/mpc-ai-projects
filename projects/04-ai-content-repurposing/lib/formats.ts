import type { FormatId, Platform } from "@/lib/types";

/**
 * The catalog of platform-native output formats the engine can produce.
 *
 * Each definition carries everything the generation step needs: the platform
 * it targets, the hard character limit used for the `overLimit` flag, and a
 * generation instruction injected into the prompt so every format is truly
 * native (not a resized clone of the same paragraph).
 */
export interface FormatDefinition {
  id: FormatId;
  platform: Platform;
  /** Short display label used across the UI. */
  label: string;
  /** One-line description shown in the format picker. */
  description: string;
  /**
   * Hard character limit for the platform. `body` above this is flagged
   * `overLimit`. `null` means no meaningful single-field limit (e.g. threads,
   * newsletters) — length is instead governed by the instruction.
   */
  charLimit: number | null;
  /** Whether the format is naturally multi-part (thread, script, quote set). */
  multiSegment: boolean;
  /** Emoji used as the card glyph. */
  glyph: string;
  /** Instruction appended to the generation prompt for this format. */
  instruction: string;
}

export const FORMATS: Record<FormatId, FormatDefinition> = {
  x_thread: {
    id: "x_thread",
    platform: "x",
    label: "X / Twitter thread",
    description: "5–9 punchy posts, strong hook, one idea per post.",
    charLimit: 280, // per segment
    multiSegment: true,
    glyph: "𝕏",
    instruction:
      "Write a 5–9 post thread. The first post is a scroll-stopping hook with a bold claim or surprising stat. Each post is a self-contained idea under 280 characters. Number posts like 1/, 2/. End with a takeaway + soft CTA. Put each post as one entry in `segments` and the full thread joined by blank lines in `body`.",
  },
  linkedin_post: {
    id: "linkedin_post",
    platform: "linkedin",
    label: "LinkedIn post",
    description: "Professional narrative with a hook line and whitespace.",
    charLimit: 3000,
    multiSegment: false,
    glyph: "in",
    instruction:
      "Write a LinkedIn post: a 1-line hook, then short 1–2 sentence paragraphs separated by line breaks for skimmability, a concrete insight or story from the source, and a reflective question CTA. Professional but human. 900–1500 characters.",
  },
  instagram_caption: {
    id: "instagram_caption",
    platform: "instagram",
    label: "Instagram caption",
    description: "Hooky caption + line breaks + hashtag block.",
    charLimit: 2200,
    multiSegment: false,
    glyph: "IG",
    instruction:
      "Write an Instagram caption: emotive first line hook, 2–4 short lines of value with tasteful line breaks, a clear CTA (save/share/comment). Provide 8–12 relevant hashtags in `hashtags` (not inside body). Under 2200 characters.",
  },
  tiktok_script: {
    id: "tiktok_script",
    platform: "tiktok",
    label: "TikTok / Reels script",
    description: "30–45s spoken script with on-screen beats.",
    charLimit: null,
    multiSegment: true,
    glyph: "▶",
    instruction:
      "Write a 30–45 second short-video script. Open with a 3-second pattern-interrupt hook, then 3–5 fast beats, then a CTA. For each beat put a line as `[0-3s] Hook: ...` including spoken line and a suggested on-screen text. Put beats in `segments`; full script in `body`.",
  },
  newsletter_section: {
    id: "newsletter_section",
    platform: "email",
    label: "Newsletter section",
    description: "Subject line + a self-contained email segment.",
    charLimit: null,
    multiSegment: false,
    glyph: "✉",
    instruction:
      "Write a newsletter section: a compelling subject line as the first `segments` entry prefixed 'Subject: ', then 150–250 words of value in a warm, direct email voice with one link-worthy takeaway and a CTA. Full text (including subject) in `body`.",
  },
  quote_graphics: {
    id: "quote_graphics",
    platform: "instagram",
    label: "Quote graphics",
    description: "5–7 short quotable lines for carousel/quote cards.",
    charLimit: 120, // per quote line
    multiSegment: true,
    glyph: "❝",
    instruction:
      "Extract 5–7 highly quotable, standalone lines (each under 120 characters) suitable for quote cards or a carousel. Punchy, no context needed. Each quote is one entry in `segments`; join them with newlines in `body`.",
  },
  seo_meta: {
    id: "seo_meta",
    platform: "web",
    label: "SEO meta",
    description: "Title tag, meta description, slug, keywords.",
    charLimit: 160, // meta description
    multiSegment: true,
    glyph: "🔍",
    instruction:
      "Produce SEO metadata. `segments` must contain, in order: 'Title: <=60 chars', 'Description: <=155 chars', 'Slug: kebab-case-url', 'Keywords: comma,separated'. Put the same content readably in `body`. Optimize for click-through and a primary keyword.",
  },
  youtube_description: {
    id: "youtube_description",
    platform: "youtube",
    label: "YouTube description",
    description: "Optimized description + timestamps + links.",
    charLimit: 5000,
    multiSegment: false,
    glyph: "▷",
    instruction:
      "Write a YouTube description: a keyword-rich first 2 lines (visible above the fold), a 2–3 sentence summary, a bulleted 'In this video' list, placeholder chapter timestamps (00:00 Intro ...), and a CTA. Under 5000 characters.",
  },
  facebook_post: {
    id: "facebook_post",
    platform: "facebook",
    label: "Facebook post",
    description: "Conversational post optimized for shares.",
    charLimit: 2000,
    multiSegment: false,
    glyph: "f",
    instruction:
      "Write a conversational Facebook post: relatable hook, a short story or insight from the source, and a question that invites comments. Warmer and slightly longer than the X version. Under 2000 characters.",
  },
  threads_post: {
    id: "threads_post",
    platform: "threads",
    label: "Threads post",
    description: "Casual, culture-forward single post.",
    charLimit: 500,
    multiSegment: false,
    glyph: "@",
    instruction:
      "Write a single Threads post: casual, culture-forward, opinionated take drawn from the source. Conversational, under 500 characters, no hashtag spam.",
  },
};

/** All format definitions as an ordered array (UI iteration). */
export const FORMAT_LIST: FormatDefinition[] = Object.values(FORMATS);

/** Sensible default pack when the caller does not specify formats. */
export const DEFAULT_FORMATS: FormatId[] = [
  "x_thread",
  "linkedin_post",
  "instagram_caption",
  "tiktok_script",
  "newsletter_section",
  "quote_graphics",
  "seo_meta",
];

/** The per-segment or whole-body limit relevant for a format, for UI display. */
export function limitFor(format: FormatId): number | null {
  return FORMATS[format].charLimit;
}

/**
 * Compute char count + over-limit flag for a generated output. For
 * multi-segment formats the limit applies per segment (longest segment wins).
 */
export function measure(
  format: FormatId,
  body: string,
  segments?: string[]
): { charCount: number; overLimit: boolean } {
  const def = FORMATS[format];
  const charCount = body.length;
  if (def.charLimit === null) return { charCount, overLimit: false };

  if (def.multiSegment && segments && segments.length > 0) {
    const longest = Math.max(...segments.map((s) => s.length));
    return { charCount, overLimit: longest > def.charLimit };
  }
  return { charCount, overLimit: charCount > def.charLimit };
}
