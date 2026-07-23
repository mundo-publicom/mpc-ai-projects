/**
 * Domain types for the AI Logo & Brand Design studio.
 *
 * The core artifact is a `BrandKit`: everything a founder needs to ship a
 * coherent visual identity — logo concepts (as inline SVG), a color palette
 * with semantic roles, a typography pairing, brand voice, and usage rules.
 */

/* ------------------------------------------------------------------ */
/* Brief — the user's input                                            */
/* ------------------------------------------------------------------ */

export const BRAND_STYLES = [
  "modern",
  "minimal",
  "bold",
  "playful",
  "elegant",
  "classic",
] as const;
export type BrandStyle = (typeof BRAND_STYLES)[number];

export const BRAND_STYLE_LABELS: Record<BrandStyle, string> = {
  modern: "Modern & clean",
  minimal: "Minimal & understated",
  bold: "Bold & confident",
  playful: "Playful & friendly",
  elegant: "Elegant & premium",
  classic: "Classic & trustworthy",
};

/** The short brand brief that seeds generation. */
export interface Brief {
  /** Company / product name (used verbatim in the wordmark). */
  name: string;
  /** Industry or category, e.g. "fintech", "specialty coffee", "SaaS". */
  industry: string;
  /** Brand values / adjectives that should come through, e.g. ["trust", "speed"]. */
  values: string[];
  /** Overall aesthetic direction. */
  style: BrandStyle;
  /** Optional free-text description of the business or vibe. */
  description?: string;
  /** Optional target audience descriptor. */
  audience?: string;
}

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

export type ColorRole =
  | "primary"
  | "secondary"
  | "accent"
  | "neutral"
  | "background";

export interface PaletteColor {
  role: ColorRole;
  /** Hex string, always in `#rrggbb` form. */
  hex: string;
  /** Human name, e.g. "Deep Indigo". */
  name: string;
}

export interface Palette {
  name: string;
  colors: PaletteColor[];
}

/* ------------------------------------------------------------------ */
/* Typography                                                          */
/* ------------------------------------------------------------------ */

export type FontCategory = "serif" | "sans-serif" | "display" | "monospace";

export interface FontSpec {
  /** Font family name as it appears on Google Fonts. */
  family: string;
  /** Recommended weights to load, e.g. [400, 600, 700]. */
  weights: number[];
  category: FontCategory;
  /** CSS fallback stack (excluding the family itself). */
  fallback: string;
}

export interface TypePairing {
  heading: FontSpec;
  body: FontSpec;
  /** Why this pairing suits the brand. */
  rationale: string;
}

/* ------------------------------------------------------------------ */
/* Logo concepts                                                       */
/* ------------------------------------------------------------------ */

export type LogoStyle =
  | "wordmark"
  | "lettermark"
  | "combination"
  | "icon"
  | "emblem";

export interface LogoConcept {
  id: string;
  name: string;
  style: LogoStyle;
  /** A complete, self-contained `<svg>…</svg>` string. */
  svg: string;
  /** Design rationale for the concept. */
  rationale: string;
}

/* ------------------------------------------------------------------ */
/* Brand voice                                                         */
/* ------------------------------------------------------------------ */

export interface BrandVoice {
  /** Brand archetype, e.g. "The Sage", "The Explorer". */
  archetype: string;
  /** Tone adjectives, e.g. ["confident", "warm", "concise"]. */
  tone: string[];
  tagline: string;
  elevatorPitch: string;
  dos: string[];
  donts: string[];
  sampleHeadline: string;
  sampleBody: string;
}

/* ------------------------------------------------------------------ */
/* Brand kit — the deliverable                                         */
/* ------------------------------------------------------------------ */

export interface BrandKit {
  brief: Brief;
  concepts: LogoConcept[];
  palette: Palette;
  typography: TypePairing;
  voice: BrandVoice;
  /** Practical usage rules (clear space, min size, don'ts). */
  usageRules: string[];
  /** True when produced by the deterministic mock (no API key present). */
  mocked: boolean;
  /** Wall-clock generation latency in ms. */
  latencyMs: number;
}

/* ------------------------------------------------------------------ */
/* API response                                                        */
/* ------------------------------------------------------------------ */

export interface GenerateBrandResponse {
  kit: BrandKit;
}
