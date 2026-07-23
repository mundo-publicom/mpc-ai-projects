import { generateText, generateObject } from "ai";
import { z } from "zod";
import type {
  Brief,
  BrandKit,
  LogoConcept,
  Palette,
  TypePairing,
} from "./types";
import { BRAND_STYLE_LABELS } from "./types";
import { generatePalette, hashString, readableTextColor } from "./palette";

// Re-export so routes import the SDK helpers from one place.
export { generateText, generateObject };

/**
 * Model catalog. Calls route through the Vercel AI Gateway using plain
 * "provider/model" strings — no provider SDK is wired directly.
 */
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * True when a gateway/provider key is present. When false, the generate route
 * serves a deterministic mock brand kit (with real inline SVG) so the studio
 * is fully demoable with zero configuration.
 */
export const hasAI = () =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

/* ------------------------------------------------------------------ */
/* Output schema (generateObject)                                      */
/* ------------------------------------------------------------------ */

const hexRegex = /^#[0-9a-fA-F]{6}$/;

const fontSpecSchema = z.object({
  family: z.string().describe("Font family name exactly as on Google Fonts."),
  weights: z
    .array(z.number().int())
    .min(1)
    .describe("Recommended weights to load, e.g. [400, 600, 700]."),
  category: z.enum(["serif", "sans-serif", "display", "monospace"]),
  fallback: z
    .string()
    .describe("CSS fallback stack excluding the family, e.g. 'Georgia, serif'."),
});

/**
 * Strict schema the model must satisfy. Note the SVG constraints — the markup
 * is rendered directly, so it must be a single self-contained element sized to
 * a 260x84 viewBox with no scripts or external references.
 */
export const brandKitSchema = z.object({
  concepts: z
    .array(
      z.object({
        name: z.string().describe("Short concept name, e.g. 'Orbit Mark'."),
        style: z.enum([
          "wordmark",
          "lettermark",
          "combination",
          "icon",
          "emblem",
        ]),
        svg: z
          .string()
          .describe(
            "A COMPLETE, self-contained <svg>…</svg> string with viewBox='0 0 260 84'. " +
              "Use only inline shapes (path, rect, circle, polygon), <text> with a generic " +
              "font-family, and palette hex colors. NO <script>, NO external hrefs, NO <image>. " +
              "Include the brand name as text where appropriate.",
          ),
        rationale: z.string().describe("Why this concept fits the brand."),
      }),
    )
    .min(2)
    .max(3),
  palette: z.object({
    name: z.string(),
    colors: z
      .array(
        z.object({
          role: z.enum([
            "primary",
            "secondary",
            "accent",
            "neutral",
            "background",
          ]),
          hex: z.string().regex(hexRegex, "Must be #rrggbb"),
          name: z.string(),
        }),
      )
      .min(4)
      .max(6),
  }),
  typography: z.object({
    heading: fontSpecSchema,
    body: fontSpecSchema,
    rationale: z.string(),
  }),
  voice: z.object({
    archetype: z.string().describe("Brand archetype, e.g. 'The Explorer'."),
    tone: z.array(z.string()).min(2).max(6),
    tagline: z.string(),
    elevatorPitch: z.string(),
    dos: z.array(z.string()).min(2).max(6),
    donts: z.array(z.string()).min(2).max(6),
    sampleHeadline: z.string(),
    sampleBody: z.string(),
  }),
  usageRules: z.array(z.string()).min(3).max(8),
});

export type GeneratedBrandKit = z.infer<typeof brandKitSchema>;

/* ------------------------------------------------------------------ */
/* Prompt construction                                                 */
/* ------------------------------------------------------------------ */

export function buildSystemPrompt(): string {
  return [
    "You are a senior brand identity designer and art director. You produce",
    "coherent, production-ready brand systems: logo concepts, color palettes,",
    "typography pairings, brand voice, and usage rules.",
    "",
    "LOGO / SVG RULES — the SVG you return is rendered verbatim in a browser:",
    "- Return a COMPLETE <svg> element with viewBox='0 0 260 84' and width/height.",
    "- Compose with inline vector shapes (path, rect, circle, polygon, line) and",
    "  <text>. Keep geometry clean, balanced, and legible at small sizes.",
    "- Use ONLY the palette colors you also return, referenced as hex.",
    "- Use a generic font-family in <text> (e.g. \"Arial, sans-serif\" or",
    "  \"Georgia, serif\") since custom fonts are not embedded.",
    "- NEVER include <script>, event handlers, external <image>, or href/url() to",
    "  remote resources. The markup must be self-contained and safe.",
    "- Give 2–3 DISTINCT directions (e.g. a combination mark, a lettermark, an",
    "  icon-led mark) — not variations of the same idea.",
    "",
    "PALETTE RULES:",
    "- Provide primary, secondary, accent, neutral, and background roles.",
    "- Ensure the primary color has readable contrast for white or dark text.",
    "",
    "Be specific and commercially useful. Avoid clichés for the industry.",
  ].join("\n");
}

export function buildUserPrompt(brief: Brief): string {
  return [
    "Create a brand identity system for the following brief.",
    "",
    `Name: ${brief.name}`,
    `Industry: ${brief.industry}`,
    `Style direction: ${BRAND_STYLE_LABELS[brief.style]}`,
    `Brand values: ${brief.values.join(", ") || "(unspecified)"}`,
    brief.audience ? `Target audience: ${brief.audience}` : "",
    brief.description ? `Description: ${brief.description}` : "",
    "",
    "Return 2–3 logo concepts, a palette, a typography pairing, brand voice,",
    "and usage rules. Make the logos genuinely different from one another and",
    "make sure every SVG references your palette colors.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* SVG safety                                                          */
/* ------------------------------------------------------------------ */

/**
 * Minimal defensive sanitizer for model/mock-produced SVG before it is passed
 * to dangerouslySetInnerHTML. Strips script elements, event handlers, and
 * remote references. Not a substitute for a full sanitizer in production, but
 * blocks the obvious injection vectors for this trusted-ish content.
 */
export function sanitizeSvg(svg: string): string {
  let out = svg.trim();
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/(href|xlink:href)\s*=\s*"(?!#)[^"]*"/gi, "");
  out = out.replace(/javascript:/gi, "");
  // Only keep content from the first <svg to the last </svg>.
  const start = out.toLowerCase().indexOf("<svg");
  const end = out.toLowerCase().lastIndexOf("</svg>");
  if (start >= 0 && end > start) out = out.slice(start, end + 6);
  return out;
}

/* ------------------------------------------------------------------ */
/* Mock brand kit — real inline SVG, no API key required               */
/* ------------------------------------------------------------------ */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "B";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface MockColors {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  background: string;
}

/** Concept 1 — combination mark: rounded-square glyph + wordmark. */
function svgCombination(name: string, c: MockColors): string {
  const letter = initials(name).slice(0, 1);
  const wordFill = c.neutral;
  const glyphText = readableTextColor(c.primary);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 84" width="260" height="84" role="img" aria-label="${escapeXml(
    name,
  )} logo">
  <rect x="8" y="16" width="52" height="52" rx="14" fill="${c.primary}"/>
  <circle cx="34" cy="42" r="15" fill="none" stroke="${c.accent}" stroke-width="3"/>
  <text x="34" y="42" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${glyphText}">${escapeXml(
    letter,
  )}</text>
  <text x="76" y="48" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${wordFill}">${escapeXml(
    name,
  )}</text>
</svg>`;
}

/** Concept 2 — lettermark: monogram inside a hexagon. */
function svgLettermark(name: string, c: MockColors): string {
  const mono = initials(name);
  const text = readableTextColor(c.secondary);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 84" width="260" height="84" role="img" aria-label="${escapeXml(
    name,
  )} monogram">
  <rect width="260" height="84" fill="none"/>
  <polygon points="130,10 168,32 168,52 130,74 92,52 92,32" fill="${c.secondary}"/>
  <polygon points="130,10 168,32 168,52 130,74 92,52 92,32" fill="none" stroke="${c.accent}" stroke-width="2.5"/>
  <text x="130" y="43" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-size="30" font-weight="700" fill="${text}" letter-spacing="1">${escapeXml(
    mono,
  )}</text>
</svg>`;
}

/** Concept 3 — icon-led mark: abstract geometric icon + stacked wordmark. */
function svgIconLed(name: string, c: MockColors): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 84" width="260" height="84" role="img" aria-label="${escapeXml(
    name,
  )} icon logo">
  <g transform="translate(14,14)">
    <path d="M28 2 L54 16 L54 40 L28 54 L2 40 L2 16 Z" fill="${c.primary}"/>
    <path d="M28 2 L54 16 L28 30 L2 16 Z" fill="${c.accent}"/>
    <circle cx="28" cy="30" r="9" fill="${c.background}"/>
    <circle cx="28" cy="30" r="4" fill="${c.secondary}"/>
  </g>
  <text x="82" y="38" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="${c.neutral}">${escapeXml(
    name,
  )}</text>
  <text x="83" y="58" font-family="Arial, sans-serif" font-size="11" font-weight="500" letter-spacing="3" fill="${c.primary}">${escapeXml(
    "EST. 2026",
  )}</text>
</svg>`;
}

function pickColors(palette: Palette): MockColors {
  const find = (role: string, fallback: string) =>
    palette.colors.find((c) => c.role === role)?.hex ?? fallback;
  return {
    primary: find("primary", "#3563ff"),
    secondary: find("secondary", "#1a2ab6"),
    accent: find("accent", "#f59e0b"),
    neutral: find("neutral", "#1f2937"),
    background: find("background", "#f8fafc"),
  };
}

/** Curated typography pairings keyed by style. */
const TYPE_PAIRINGS: Record<string, TypePairing> = {
  modern: {
    heading: {
      family: "Space Grotesk",
      weights: [500, 700],
      category: "sans-serif",
      fallback: "system-ui, sans-serif",
    },
    body: {
      family: "Inter",
      weights: [400, 500, 600],
      category: "sans-serif",
      fallback: "system-ui, sans-serif",
    },
    rationale:
      "Space Grotesk's geometric quirk gives headlines personality, while Inter keeps body copy neutral and highly legible on screens.",
  },
  minimal: {
    heading: {
      family: "Inter",
      weights: [600, 700],
      category: "sans-serif",
      fallback: "system-ui, sans-serif",
    },
    body: {
      family: "Inter",
      weights: [400, 500],
      category: "sans-serif",
      fallback: "system-ui, sans-serif",
    },
    rationale:
      "A single, disciplined type family across weights maximizes clarity and restraint — ideal for an understated identity.",
  },
  bold: {
    heading: {
      family: "Archivo",
      weights: [700, 900],
      category: "sans-serif",
      fallback: "Impact, system-ui, sans-serif",
    },
    body: {
      family: "IBM Plex Sans",
      weights: [400, 500],
      category: "sans-serif",
      fallback: "system-ui, sans-serif",
    },
    rationale:
      "Archivo's condensed heavy weights command attention; IBM Plex Sans grounds it with a stable, engineered body voice.",
  },
  playful: {
    heading: {
      family: "Fredoka",
      weights: [500, 600],
      category: "display",
      fallback: "system-ui, sans-serif",
    },
    body: {
      family: "Nunito",
      weights: [400, 600],
      category: "sans-serif",
      fallback: "system-ui, sans-serif",
    },
    rationale:
      "Rounded terminals in Fredoka and Nunito feel warm and approachable without sacrificing readability.",
  },
  elegant: {
    heading: {
      family: "Playfair Display",
      weights: [500, 700],
      category: "serif",
      fallback: "Georgia, serif",
    },
    body: {
      family: "Lato",
      weights: [400, 700],
      category: "sans-serif",
      fallback: "system-ui, sans-serif",
    },
    rationale:
      "Playfair's high-contrast strokes signal premium editorial craft; Lato provides a quiet, refined body companion.",
  },
  classic: {
    heading: {
      family: "Libre Baskerville",
      weights: [400, 700],
      category: "serif",
      fallback: "Georgia, serif",
    },
    body: {
      family: "Source Sans 3",
      weights: [400, 600],
      category: "sans-serif",
      fallback: "system-ui, sans-serif",
    },
    rationale:
      "A trusted Baskerville serif conveys heritage and authority, balanced by a clean humanist sans for modern legibility.",
  },
};

/** Style-based hue offset so different styles read differently even for the same name. */
const STYLE_HUE_SHIFT: Record<string, number> = {
  modern: 0,
  minimal: 40,
  bold: 120,
  playful: 200,
  elegant: 260,
  classic: 300,
};

/**
 * Produces a complete, deterministic brand kit with REAL inline SVG logos, a
 * generated palette, and a curated type pairing. Used when no API key exists
 * and as a safe fallback if a model call fails.
 */
export function mockBrandKit(brief: Brief): Omit<BrandKit, "mocked" | "latencyMs"> {
  const seed = hashString(`${brief.name}|${brief.industry}|${brief.style}`);
  const palette = generatePalette(seed, STYLE_HUE_SHIFT[brief.style] ?? 0);
  const colors = pickColors(palette);
  const typography = TYPE_PAIRINGS[brief.style] ?? TYPE_PAIRINGS.modern;

  const concepts: LogoConcept[] = [
    {
      id: "concept-combination",
      name: "Aperture Mark",
      style: "combination",
      svg: sanitizeSvg(svgCombination(brief.name, colors)),
      rationale:
        "A confident combination mark: a rounded glyph carrying the initial pairs with a clear wordmark, giving you a stackable icon for app tiles and favicons plus a full lockup for headers.",
    },
    {
      id: "concept-lettermark",
      name: "Facet Monogram",
      style: "lettermark",
      svg: sanitizeSvg(svgLettermark(brief.name, colors)),
      rationale:
        "A hexagonal monogram reduces the brand to a compact, ownable symbol that scales down cleanly and works in single color for stamps, watermarks, and social avatars.",
    },
    {
      id: "concept-icon",
      name: "Prism Emblem",
      style: "icon",
      svg: sanitizeSvg(svgIconLed(brief.name, colors)),
      rationale:
        "An icon-led lockup with a faceted emblem communicates precision and craft; the descriptor line adds an establishment cue that reads as trustworthy.",
    },
  ];

  const valueList = brief.values.length
    ? brief.values.join(", ")
    : "clarity, momentum, trust";

  return {
    brief,
    concepts,
    palette,
    typography,
    voice: {
      archetype:
        brief.style === "playful"
          ? "The Jester"
          : brief.style === "elegant"
            ? "The Sage"
            : brief.style === "bold"
              ? "The Hero"
              : "The Creator",
      tone: dedupe([
        ...brief.values.map((v) => v.toLowerCase()),
        "clear",
        "confident",
        "human",
      ]).slice(0, 5),
      tagline: `${brief.name} — built for what's next.`,
      elevatorPitch: `${brief.name} helps ${
        brief.audience || `people in ${brief.industry}`
      } move faster with a ${BRAND_STYLE_LABELS[brief.style].toLowerCase()} experience grounded in ${valueList}.`,
      dos: [
        "Lead with the benefit, then the feature.",
        "Keep sentences short and active.",
        `Reinforce our values (${valueList}) in customer-facing copy.`,
      ],
      donts: [
        "Avoid jargon and hype adjectives ('revolutionary', 'synergy').",
        "Don't stretch or recolor the logo outside the palette.",
        "Never place the primary logo on a low-contrast background.",
      ],
      sampleHeadline: `Meet ${brief.name}.`,
      sampleBody: `A ${brief.industry} brand for people who value ${valueList}. This is placeholder voice copy generated from your brief — connect an AI key for bespoke messaging.`,
    },
    usageRules: [
      "Clear space: keep padding equal to the glyph height on all sides of the logo.",
      "Minimum size: 24px tall for the icon, 120px wide for the full lockup.",
      "Use the primary color for interactive elements and the accent sparingly for emphasis.",
      "Maintain WCAG AA contrast (4.5:1) for all body text on colored surfaces.",
      "Do not rotate, add drop shadows to, or apply gradients over the logo.",
    ],
  };
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}
