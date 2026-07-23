import type { Icp, Lead, Score, ScoreBand, CompanySize } from "./types";

/**
 * Deterministic scoring utilities.
 *
 * The AI produces a nuanced fit score + reasoning, but scoring must never
 * depend on a live model: this module provides a transparent, testable
 * rule-based scorer used (a) as the mock fallback when `!hasAI()`, and
 * (b) as a sanity clamp/blend on AI output so scores stay explainable.
 */

const SIZE_RANK: Record<CompanySize, number> = {
  "1-10": 0,
  "11-50": 1,
  "51-200": 2,
  "201-500": 3,
  "501-1000": 4,
  "1001-5000": 5,
  "5000+": 6,
};

/** Weights for blending sub-scores into the overall value (sum to 1). */
export const SCORE_WEIGHTS = {
  industryFit: 0.3,
  sizeFit: 0.2,
  titleFit: 0.3,
  signalStrength: 0.2,
} as const;

export function bandFor(value: number): ScoreBand {
  if (value >= 80) return "hot";
  if (value >= 60) return "warm";
  if (value >= 40) return "cool";
  return "cold";
}

function includesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => n.trim().length > 0 && h.includes(n.toLowerCase()));
}

function overlapRatio(target: string[], candidate: string): number {
  if (target.length === 0) return 0.6; // no constraint → neutral-positive
  return includesAny(candidate, target) ? 1 : 0.15;
}

/** Compute a transparent rule-based score for a lead against an ICP. */
export function computeScore(
  icp: Icp,
  lead: Pick<Lead, "company" | "contact">,
): Score {
  const industryFit = Math.round(overlapRatio(icp.industries, lead.company.industry) * 100);
  const titleFit = Math.round(overlapRatio(icp.targetTitles, lead.contact.title) * 100);

  // Size fit: full marks if the size is in the ICP's list, partial by rank distance.
  let sizeFit: number;
  if (icp.companySizes.length === 0) {
    sizeFit = 60;
  } else if (icp.companySizes.includes(lead.company.size)) {
    sizeFit = 100;
  } else {
    const leadRank = SIZE_RANK[lead.company.size];
    const nearest = Math.min(
      ...icp.companySizes.map((s) => Math.abs(SIZE_RANK[s] - leadRank)),
    );
    sizeFit = Math.max(10, 100 - nearest * 25);
  }

  // Signal strength: reward buying-signal keyword hits in the company blurb.
  const blurb = `${lead.company.description} ${lead.company.name}`;
  const signalHits = icp.buyingSignals.filter((s) =>
    includesAny(blurb, [s]),
  ).length;
  const signalStrength =
    icp.buyingSignals.length === 0
      ? 50
      : Math.min(100, 30 + signalHits * (70 / icp.buyingSignals.length));

  const breakdown = {
    industryFit,
    sizeFit,
    titleFit,
    signalStrength: Math.round(signalStrength),
  };

  // Apply exclusions as a hard penalty.
  const excluded = includesAny(blurb, icp.exclusions) || includesAny(lead.company.industry, icp.exclusions);

  const rawValue =
    breakdown.industryFit * SCORE_WEIGHTS.industryFit +
    breakdown.sizeFit * SCORE_WEIGHTS.sizeFit +
    breakdown.titleFit * SCORE_WEIGHTS.titleFit +
    breakdown.signalStrength * SCORE_WEIGHTS.signalStrength;

  const value = Math.max(0, Math.min(100, Math.round(excluded ? rawValue * 0.3 : rawValue)));

  return {
    value,
    band: bandFor(value),
    breakdown,
    reasoning: excluded
      ? `Matches profile on paper but trips an exclusion rule, so priority is reduced.`
      : `Scored ${value}/100 — strongest on ${topDimension(breakdown)}.`,
  };
}

function topDimension(b: Score["breakdown"]): string {
  const entries: [keyof Score["breakdown"], number][] = [
    ["industryFit", b.industryFit],
    ["sizeFit", b.sizeFit],
    ["titleFit", b.titleFit],
    ["signalStrength", b.signalStrength],
  ];
  entries.sort((a, c) => c[1] - a[1]);
  const labels: Record<keyof Score["breakdown"], string> = {
    industryFit: "industry fit",
    sizeFit: "company size fit",
    titleFit: "buyer title match",
    signalStrength: "buying-signal strength",
  };
  return labels[entries[0][0]];
}

/**
 * Blend an AI-produced score with the deterministic scorer. Keeps the AI's
 * reasoning and breakdown but clamps the headline value toward the rule-based
 * value so a hallucinated 99 can't override an obvious poor fit.
 */
export function reconcileScore(aiScore: Score, ruleScore: Score): Score {
  const value = Math.round(aiScore.value * 0.6 + ruleScore.value * 0.4);
  return {
    ...aiScore,
    value,
    band: bandFor(value),
  };
}

/** Sort leads by score descending — the prioritization step. */
export function prioritize(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => b.score.value - a.score.value);
}
