import type {
  BrandVoice,
  Brief,
  CopyType,
  CopyContent,
  Critique,
  Draft,
  Variant,
} from "./types";
import { COPY_TYPES } from "./types";
import { FRAMEWORKS, frameworkRotation, type FrameworkId } from "./frameworks";

/**
 * Deterministic mock + heuristic layer.
 *
 * Two jobs:
 *   1. `mockDrafts` / `buildVariants` produce a fully working demo when no API
 *      key is present — real-looking, brand-aware copy with real scores.
 *   2. `heuristicCritique` runs on every variant (mock *and* AI) so brand-safety
 *      and plagiarism checks never depend on a live model, and AI scores can be
 *      reconciled against a transparent rule-based baseline.
 */

function firstOr(items: string[], fallback: string): string {
  const v = items.find((s) => s.trim().length > 0);
  return v ?? fallback;
}

/* -------------------------------------------------------------------------- */
/* Mock generation                                                            */
/* -------------------------------------------------------------------------- */

/** Build one framework-shaped draft for a copy type. */
function draftFor(
  framework: FrameworkId,
  bv: BrandVoice,
  brief: Brief,
  copyType: CopyType,
): Draft {
  const benefit = firstOr(brief.keyBenefits, "get results faster");
  const proof = firstOr(brief.proofPoints, "trusted by teams that ship");
  const cta = brief.cta || defaultCta(brief.goal);
  const product = brief.product;
  const tone = bv.tone[0] ? `${bv.tone[0]} ` : "";
  const kw = brief.keywords[0] ? ` ${brief.keywords[0]}` : "";

  const content: CopyContent = { headline: "", body: "", cta };

  switch (framework) {
    case "PAS":
      content.headline = `Still fighting${kw}? ${product} ends that.`;
      content.body = `Problem: ${benefit} keeps slipping away. Agitate: every week without it costs you momentum. Solution: ${product} fixes it — ${proof}.`;
      break;
    case "FAB":
      content.headline = `${product}: built for${kw || " the win"}`;
      content.body = `Feature: ${product} does the heavy lifting. Advantage: faster than the old way. Benefit: you finally ${benefit}. ${proof}.`;
      break;
    case "BAB":
      content.headline = `From stuck to shipping with ${product}`;
      content.body = `Before: ${benefit} felt out of reach. After: it's routine. Bridge: ${product} gets you there — ${proof}.`;
      break;
    case "4Ps":
      content.headline = `Picture ${benefit}, on autopilot`;
      content.body = `We promise ${product} delivers it. Proof: ${proof}. Now's the moment — don't let another cycle slip.`;
      break;
    case "AIDA":
    default:
      content.headline = `${tone}way to ${benefit}`.trim();
      content.body = `Meet ${product}. It turns "${benefit}" from a goal into a habit. ${proof}. Ready when you are.`;
      break;
  }

  // Shape content to the copy type.
  switch (copyType) {
    case "headline":
      content.body = "";
      content.cta = undefined;
      break;
    case "google_ad":
      content.headline = truncate(content.headline, 30);
      content.altHeadlines = [
        truncate(`${product} — ${benefit}`, 30),
        truncate(`Try ${product} today`, 30),
      ];
      content.body = truncate(content.body, 90);
      content.altDescriptions = [truncate(`${proof}. ${cta}.`, 90)];
      break;
    case "landing_section":
      content.subheadline = `${proof}. ${benefit} without the busywork.`;
      break;
    case "cold_email":
    case "nurture_email":
      // Headline doubles as subject line for email types.
      break;
    default:
      break;
  }

  return { framework, content };
}

function defaultCta(goal: Brief["goal"]): string {
  const map: Record<Brief["goal"], string> = {
    awareness: "Learn more",
    clicks: "See how it works",
    leads: "Get the guide",
    sales: "Buy now",
    signups: "Start free",
    retention: "Explore what's new",
  };
  return map[goal];
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Produce `count` deterministic drafts rotating through fitting frameworks. */
export function mockDrafts(
  bv: BrandVoice,
  brief: Brief,
  copyType: CopyType,
  count: number,
): Draft[] {
  const frameworks = frameworkRotation(copyType, count);
  return frameworks.map((f) => draftFor(f, bv, brief, copyType));
}

/* -------------------------------------------------------------------------- */
/* Heuristic critique / scoring                                               */
/* -------------------------------------------------------------------------- */

const CLICHES = [
  "think different",
  "just do it",
  "because you're worth it",
  "the ultimate",
  "game changer",
  "revolutionary",
  "world-class",
  "best in class",
  "cutting edge",
  "next level",
];

function collectText(content: CopyContent): string {
  return [
    content.headline,
    content.subheadline ?? "",
    content.body,
    content.cta ?? "",
    ...(content.altHeadlines ?? []),
    ...(content.altDescriptions ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Deterministic critique of a draft. Used as the mock critique and as a sanity
 * baseline the AI score is blended against (see `reconcileCritique`).
 */
export function heuristicCritique(
  draft: Draft,
  bv: BrandVoice,
  brief: Brief,
  copyType: CopyType,
): Critique {
  const text = collectText(draft.content);
  const meta = COPY_TYPES[copyType];

  // Brand safety: any forbidden word present is a hard fail.
  const flags = bv.forbiddenWords
    .filter((w) => w.trim().length > 0 && text.includes(w.toLowerCase()))
    .map((w) => `Uses forbidden term "${w}"`);
  bv.avoidList.forEach((rule) => {
    const token = rule.toLowerCase().replace(/^never say\s+/i, "").replace(/["']/g, "").trim();
    if (token.length > 2 && text.includes(token)) flags.push(`Violates rule: ${rule}`);
  });
  const brandSafetyPassed = flags.length === 0;

  // Clarity: shorter sentences + presence of a concrete benefit read clearer.
  const words = text.split(/\s+/).filter(Boolean).length;
  const benefitHit = brief.keyBenefits.some(
    (b) => b.trim().length > 0 && text.includes(b.toLowerCase()),
  );
  const clarity = clamp(78 - Math.max(0, words - 45) * 0.5 + (benefitHit ? 8 : 0));

  // Persuasion: proof points + power words + framework completeness.
  const proofHit = brief.proofPoints.some(
    (p) => p.trim().length > 0 && text.includes(p.toLowerCase().slice(0, 12)),
  );
  const powerHit = bv.powerWords.filter(
    (w) => w.trim().length > 0 && text.includes(w.toLowerCase()),
  ).length;
  const persuasion = clamp(64 + (proofHit ? 12 : 0) + Math.min(12, powerHit * 4));

  // Brand fit: tone words present + reading-level alignment (approx).
  const toneHit = bv.tone.filter(
    (t) => t.trim().length > 0 && text.includes(t.toLowerCase()),
  ).length;
  const brandFit = clamp(70 + Math.min(18, toneHit * 6) + (brandSafetyPassed ? 0 : -40));

  // Brevity: reward staying near the copy type's expected size.
  const brevity = brevityScore(copyType, words);

  // CTA strength: is there a CTA when the type wants one, and is it active?
  const cta = draft.content.cta ?? "";
  const wantsCta = copyType !== "headline";
  const ctaStrength = !wantsCta
    ? 85
    : cta.trim().length === 0
      ? 30
      : clamp(70 + (/^(start|get|try|buy|book|claim|see|join)/i.test(cta.trim()) ? 15 : 0));

  const breakdown = { clarity, persuasion, brandFit, brevity, ctaStrength };
  const overallScore = clamp(
    clarity * 0.2 + persuasion * 0.3 + brandFit * 0.25 + brevity * 0.1 + ctaStrength * 0.15,
  );

  // Plagiarism heuristic.
  const clicheHits = CLICHES.filter((c) => text.includes(c)).length;
  const plagiarismRisk = clicheHits >= 2 ? "high" : clicheHits === 1 ? "medium" : "low";

  const suggestions: string[] = [];
  if (!benefitHit) suggestions.push("Lead more explicitly with the key benefit.");
  if (!proofHit && brief.proofPoints.length > 0)
    suggestions.push("Work a concrete proof point into the copy.");
  if (wantsCta && cta.trim().length === 0) suggestions.push("Add an explicit call to action.");
  if (words > 60 && copyType !== "landing_section" && copyType !== "nurture_email")
    suggestions.push("Tighten — cut roughly a third of the words.");
  if (suggestions.length === 0) suggestions.push("Strong draft; A/B test the headline against variant 1.");

  return {
    overallScore,
    breakdown,
    framework: draft.framework,
    rationale: brandSafetyPassed
      ? `Executes the ${FRAMEWORKS[draft.framework].name} beats and fits the brand voice; strongest on ${topDim(breakdown)}. (${meta.label})`
      : `Would score well but trips a brand-safety rule, so it must not ship as-is.`,
    suggestions,
    brandSafety: { passed: brandSafetyPassed, flags },
    plagiarismRisk,
  };
}

function brevityScore(copyType: CopyType, words: number): number {
  const targets: Record<CopyType, [number, number]> = {
    headline: [3, 12],
    google_ad: [10, 30],
    meta_ad: [20, 60],
    cold_email: [40, 120],
    nurture_email: [80, 200],
    landing_section: [25, 90],
    product_description: [40, 120],
  };
  const [lo, hi] = targets[copyType];
  if (words >= lo && words <= hi) return 92;
  const over = words > hi ? words - hi : lo - words;
  return clamp(92 - over * 1.5);
}

function topDim(b: Critique["breakdown"]): string {
  const entries: [keyof Critique["breakdown"], number][] = [
    ["clarity", b.clarity],
    ["persuasion", b.persuasion],
    ["brandFit", b.brandFit],
    ["brevity", b.brevity],
    ["ctaStrength", b.ctaStrength],
  ];
  entries.sort((a, c) => c[1] - a[1]);
  const labels: Record<keyof Critique["breakdown"], string> = {
    clarity: "clarity",
    persuasion: "persuasion",
    brandFit: "brand fit",
    brevity: "brevity",
    ctaStrength: "CTA strength",
  };
  return labels[entries[0][0]];
}

/**
 * Blend an AI critique with the heuristic one. The AI keeps its rationale and
 * suggestions, but the headline score is pulled toward the deterministic value,
 * and any heuristic brand-safety failure overrides an over-generous AI pass.
 */
export function reconcileCritique(ai: Critique, rule: Critique): Critique {
  const overallScore = clamp(ai.overallScore * 0.6 + rule.overallScore * 0.4);
  const brandSafetyPassed = ai.brandSafety.passed && rule.brandSafety.passed;
  const flags = Array.from(new Set([...ai.brandSafety.flags, ...rule.brandSafety.flags]));
  const riskRank = { low: 0, medium: 1, high: 2 } as const;
  const plagiarismRisk =
    riskRank[ai.plagiarismRisk] >= riskRank[rule.plagiarismRisk]
      ? ai.plagiarismRisk
      : rule.plagiarismRisk;
  return {
    ...ai,
    overallScore: brandSafetyPassed ? overallScore : Math.min(overallScore, 45),
    brandSafety: { passed: brandSafetyPassed, flags },
    plagiarismRisk,
  };
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

let counter = 0;
export function makeVariantId(copyType: CopyType): string {
  counter += 1;
  return `${copyType}-${Date.now().toString(36)}-${counter}`;
}

/** Attach ids + critiques to drafts, producing final Variants (mock path). */
export function buildMockVariants(
  bv: BrandVoice,
  brief: Brief,
  copyType: CopyType,
  count: number,
): Variant[] {
  return mockDrafts(bv, brief, copyType, count).map((draft) => ({
    id: makeVariantId(copyType),
    copyType,
    framework: draft.framework,
    content: draft.content,
    critique: heuristicCritique(draft, bv, brief, copyType),
  }));
}
