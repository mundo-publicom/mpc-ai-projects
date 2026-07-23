/**
 * Color utilities for brand palettes.
 *
 * Includes hex/RGB/HSL conversion, WCAG contrast checking (so we can flag
 * inaccessible color pairings before they ship), and a deterministic palette
 * generator used by the mock fallback.
 */

import type { Palette, PaletteColor } from "./types";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

/** Normalizes a hex string to `#rrggbb` (lowercase). Returns null if invalid. */
export function normalizeHex(hex: string): string | null {
  const m = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(m)) {
    const [r, g, b] = m.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(m)) return `#${m}`.toLowerCase();
  return null;
}

export function hexToRgb(hex: string): Rgb {
  const norm = normalizeHex(hex) ?? "#000000";
  const int = parseInt(norm.slice(1), 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const h = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** h in [0,360), s and l in [0,1]. */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/* ------------------------------------------------------------------ */
/* WCAG contrast                                                       */
/* ------------------------------------------------------------------ */

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/** Contrast ratio between two colors, from 1 (identical) to 21 (black/white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagLevel = "AAA" | "AA" | "AA Large" | "Fail";

/** WCAG rating for normal body text against a background. */
export function wcagRating(fg: string, bg: string): WcagLevel {
  const ratio = contrastRatio(fg, bg);
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

/** Picks black or white text for maximum legibility on a background color. */
export function readableTextColor(bg: string): "#000000" | "#ffffff" {
  return contrastRatio("#ffffff", bg) >= contrastRatio("#000000", bg)
    ? "#ffffff"
    : "#000000";
}

export interface ContrastCheck {
  fg: string;
  bg: string;
  ratio: number;
  level: WcagLevel;
  passesBody: boolean;
}

/**
 * Audits the key text-on-color pairings in a palette so the UI can surface
 * accessibility problems (e.g. primary buttons with unreadable labels).
 */
export function auditPalette(palette: Palette): ContrastCheck[] {
  const bg =
    palette.colors.find((c) => c.role === "background")?.hex ?? "#ffffff";
  const checks: ContrastCheck[] = [];
  for (const color of palette.colors) {
    if (color.role === "background") continue;
    const fg = readableTextColor(color.hex);
    const ratio = contrastRatio(fg, color.hex);
    checks.push({
      fg,
      bg: color.hex,
      ratio: Math.round(ratio * 100) / 100,
      level: wcagRating(fg, color.hex),
      passesBody: ratio >= 4.5,
    });
    // Also verify the color reads as text on the page background.
    if (color.role === "primary" || color.role === "secondary") {
      const r = contrastRatio(color.hex, bg);
      checks.push({
        fg: color.hex,
        bg,
        ratio: Math.round(r * 100) / 100,
        level: wcagRating(color.hex, bg),
        passesBody: r >= 4.5,
      });
    }
  }
  return checks;
}

/* ------------------------------------------------------------------ */
/* Deterministic generation (mock)                                     */
/* ------------------------------------------------------------------ */

/** Stable 32-bit hash of a string — used to seed deterministic mock output. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PALETTE_NAMES = [
  "Signal",
  "Horizon",
  "Meridian",
  "Cobalt Craft",
  "Warm Modern",
  "Northlight",
];

/**
 * Builds a coherent 5-color palette from a seed hue using color-theory
 * relationships (analogous secondary, complementary accent, tuned neutral,
 * near-white background). Fully deterministic for a given seed.
 */
export function generatePalette(seed: number, styleShift = 0): Palette {
  const baseHue = (seed % 360) + styleShift;
  const primary = hslToHex(baseHue, 0.68, 0.46);
  const secondary = hslToHex(baseHue + 28, 0.55, 0.38);
  const accent = hslToHex(baseHue + 175, 0.72, 0.55);
  const neutral = hslToHex(baseHue, 0.12, 0.22);
  const background = hslToHex(baseHue, 0.28, 0.97);

  const colors: PaletteColor[] = [
    { role: "primary", hex: primary, name: hueName(baseHue) },
    { role: "secondary", hex: secondary, name: hueName(baseHue + 28) + " Deep" },
    { role: "accent", hex: accent, name: hueName(baseHue + 175) + " Pop" },
    { role: "neutral", hex: neutral, name: "Ink" },
    { role: "background", hex: background, name: "Paper" },
  ];

  return {
    name: PALETTE_NAMES[seed % PALETTE_NAMES.length],
    colors,
  };
}

function hueName(hue: number): string {
  const h = ((hue % 360) + 360) % 360;
  const names: [number, string][] = [
    [15, "Crimson"],
    [45, "Amber"],
    [70, "Citron"],
    [100, "Fern"],
    [150, "Emerald"],
    [190, "Teal"],
    [220, "Azure"],
    [255, "Indigo"],
    [290, "Violet"],
    [330, "Magenta"],
    [360, "Crimson"],
  ];
  for (const [max, name] of names) if (h < max) return name;
  return "Cobalt";
}
