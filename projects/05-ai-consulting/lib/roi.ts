import type {
  Intake,
  Process,
  RoiEstimate,
  Opportunity,
  OpportunityCategory,
} from "./types";

/**
 * Deterministic ROI engine.
 *
 * ROI must never depend on a live model: this module provides transparent,
 * testable math used (a) as the mock fallback when `!hasAI()`, (b) to compute
 * the actual dollar figures behind every opportunity (the AI supplies impact/
 * effort judgment and narrative; the numbers are computed here), and (c) to
 * aggregate a portfolio-level ROI across the backlog.
 */

/* -------------------------------------------------------------------------- */
/* Tunable assumptions                                                        */
/* -------------------------------------------------------------------------- */

/** Fraction of a process's labor hours a solution can realistically remove,
 *  by opportunity category. Conservative on purpose. */
const AUTOMATION_FACTOR: Record<OpportunityCategory, number> = {
  automation: 0.55,
  augmentation: 0.3,
  insight: 0.15,
  "customer-experience": 0.25,
  "risk-compliance": 0.2,
  "new-product": 0.1,
};

/** Repetitiveness multiplies how much of the theoretical saving is achievable. */
const REPETITIVENESS_MULT: Record<Process["repetitiveness"], number> = {
  low: 0.5,
  medium: 0.8,
  high: 1.0,
};

/** Implementation cost baseline (USD) scaled by effort (1–5). */
const EFFORT_COST_USD: Record<number, number> = {
  1: 6_000,
  2: 15_000,
  3: 35_000,
  4: 75_000,
  5: 140_000,
};

/** Annual run cost as a fraction of implementation cost, by effort. */
const RUN_COST_RATIO = 0.18;

const WEEKS_PER_YEAR = 48; // net of holidays/ramp

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function confidenceFor(intake: Intake, effort: number): RoiEstimate["confidence"] {
  const dataScore = { poor: 0, fair: 1, good: 2, excellent: 3 }[intake.dataReadiness];
  // Good data + low effort → high confidence; poor data or big effort → low.
  const signal = dataScore - (effort - 2);
  if (signal >= 2) return "high";
  if (signal >= 0) return "medium";
  return "low";
}

/* -------------------------------------------------------------------------- */
/* Per-opportunity ROI                                                        */
/* -------------------------------------------------------------------------- */

export interface RoiInputs {
  category: OpportunityCategory;
  effort: number; // 1–5
  /** The process this opportunity targets, if matched. */
  process?: Process;
  /** Optional revenue-lift estimate (USD/yr) for growth-oriented plays. */
  revenueLiftUsd?: number;
}

/**
 * Compute a full ROI estimate from first principles. Labor savings come from
 * the targeted process's hours × cost × automation factor; growth plays can
 * add a revenue lift. Costs scale with effort.
 */
export function computeRoi(inputs: RoiInputs): RoiEstimate {
  const { category, effort, process, revenueLiftUsd = 0 } = inputs;
  const clampedEffort = Math.max(1, Math.min(5, Math.round(effort)));

  // Annual labor cost currently spent on the process.
  const annualLaborUsd = process
    ? process.hoursPerWeek * WEEKS_PER_YEAR * process.hourlyCostUsd
    : 0;

  const achievable =
    AUTOMATION_FACTOR[category] *
    (process ? REPETITIVENESS_MULT[process.repetitiveness] : 0.6);

  const laborSavingUsd = annualLaborUsd * achievable;
  const annualBenefitUsd = round(laborSavingUsd + revenueLiftUsd);

  const implementationCostUsd = EFFORT_COST_USD[clampedEffort];
  const annualRunCostUsd = round(implementationCostUsd * RUN_COST_RATIO);
  const annualNetUsd = round(annualBenefitUsd - annualRunCostUsd);

  const paybackMonths =
    annualNetUsd > 0
      ? round((implementationCostUsd / annualNetUsd) * 12, 1)
      : 999;

  const firstYearRoi =
    implementationCostUsd > 0
      ? round((annualNetUsd - implementationCostUsd) / implementationCostUsd, 2)
      : 0;

  return {
    implementationCostUsd,
    annualRunCostUsd,
    annualBenefitUsd,
    annualNetUsd,
    paybackMonths,
    firstYearRoi,
    confidence: "medium", // default; caller may refine with intake
    narrative: buildNarrative({
      annualLaborUsd,
      achievable,
      laborSavingUsd,
      revenueLiftUsd,
      implementationCostUsd,
      annualRunCostUsd,
      annualNetUsd,
      paybackMonths,
    }),
  };
}

function buildNarrative(p: {
  annualLaborUsd: number;
  achievable: number;
  laborSavingUsd: number;
  revenueLiftUsd: number;
  implementationCostUsd: number;
  annualRunCostUsd: number;
  annualNetUsd: number;
  paybackMonths: number;
}): string {
  const parts: string[] = [];
  if (p.annualLaborUsd > 0) {
    parts.push(
      `The targeted process costs ~$${fmt(p.annualLaborUsd)}/yr in labor; a ${Math.round(
        p.achievable * 100,
      )}% realistic reduction frees ~$${fmt(p.laborSavingUsd)}/yr.`,
    );
  }
  if (p.revenueLiftUsd > 0) {
    parts.push(`Estimated revenue lift adds ~$${fmt(p.revenueLiftUsd)}/yr.`);
  }
  parts.push(
    `Against ~$${fmt(p.implementationCostUsd)} to build and ~$${fmt(
      p.annualRunCostUsd,
    )}/yr to run, net benefit is ~$${fmt(p.annualNetUsd)}/yr` +
      (p.paybackMonths < 999
        ? `, paying back in ~${p.paybackMonths} months.`
        : `.`),
  );
  return parts.join(" ");
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Refine an ROI estimate's confidence using intake context. Kept separate so
 * the pure math above stays intake-agnostic.
 */
export function withConfidence(
  roi: RoiEstimate,
  intake: Intake,
  effort: number,
): RoiEstimate {
  return { ...roi, confidence: confidenceFor(intake, effort) };
}

/* -------------------------------------------------------------------------- */
/* Quadrant + priority                                                        */
/* -------------------------------------------------------------------------- */

export function quadrantFor(
  impact: number,
  effort: number,
): Opportunity["quadrant"] {
  const highImpact = impact >= 3;
  const lowEffort = effort <= 3;
  if (highImpact && lowEffort) return "quick-win";
  if (highImpact && !lowEffort) return "big-bet";
  if (!highImpact && lowEffort) return "fill-in";
  return "money-pit";
}

/**
 * Priority score: reward impact + ROI, penalize effort + risk. Lower rank
 * number = do sooner. Returns opportunities sorted, with `priority` assigned.
 */
export function prioritize(opps: Opportunity[]): Opportunity[] {
  const scored = opps.map((o) => {
    const roiScore = Math.max(-1, Math.min(5, o.roi.firstYearRoi));
    const weight =
      o.impact * 2 + roiScore - o.effort * 1.2 - o.risk * 0.8;
    return { o, weight };
  });
  scored.sort((a, b) => b.weight - a.weight);
  return scored.map(({ o }, i) => ({ ...o, priority: i + 1 }));
}

/* -------------------------------------------------------------------------- */
/* Portfolio aggregation                                                      */
/* -------------------------------------------------------------------------- */

/** Sum ROI across a backlog into a single portfolio-level estimate. */
export function aggregateRoi(opps: Opportunity[]): RoiEstimate {
  if (opps.length === 0) {
    return {
      implementationCostUsd: 0,
      annualRunCostUsd: 0,
      annualBenefitUsd: 0,
      annualNetUsd: 0,
      paybackMonths: 0,
      firstYearRoi: 0,
      confidence: "low",
      narrative: "No opportunities selected.",
    };
  }

  const implementationCostUsd = round(
    opps.reduce((s, o) => s + o.roi.implementationCostUsd, 0),
  );
  const annualRunCostUsd = round(
    opps.reduce((s, o) => s + o.roi.annualRunCostUsd, 0),
  );
  const annualBenefitUsd = round(
    opps.reduce((s, o) => s + o.roi.annualBenefitUsd, 0),
  );
  const annualNetUsd = round(annualBenefitUsd - annualRunCostUsd);
  const paybackMonths =
    annualNetUsd > 0
      ? round((implementationCostUsd / annualNetUsd) * 12, 1)
      : 999;
  const firstYearRoi =
    implementationCostUsd > 0
      ? round((annualNetUsd - implementationCostUsd) / implementationCostUsd, 2)
      : 0;

  // Portfolio confidence = the modal/most-cautious of its parts.
  const order = { low: 0, medium: 1, high: 2 } as const;
  const minConf = opps.reduce<RoiEstimate["confidence"]>(
    (acc, o) => (order[o.roi.confidence] < order[acc] ? o.roi.confidence : acc),
    "high",
  );

  return {
    implementationCostUsd,
    annualRunCostUsd,
    annualBenefitUsd,
    annualNetUsd,
    paybackMonths,
    firstYearRoi,
    confidence: minConf,
    narrative: `Across ${opps.length} recommended initiatives: ~$${fmt(
      implementationCostUsd,
    )} to implement, ~$${fmt(annualNetUsd)}/yr net benefit, ~${
      paybackMonths < 999 ? `${paybackMonths}-month` : "no near-term"
    } payback (${Math.round(firstYearRoi * 100)}% first-year ROI).`,
  };
}
