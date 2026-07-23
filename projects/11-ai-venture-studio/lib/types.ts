/**
 * Domain model for the AI Venture Studio.
 *
 * The pipeline is: Idea → ValidationReport (market, competitors, lean canvas,
 * MVP spec, risks, score). Types here are the single source of truth shared by
 * the API route, AI orchestration, and UI components.
 */

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

/** A startup idea captured at intake, before any validation has run. */
export interface Idea {
  /** Stable id (generated client- or server-side). */
  id: string;
  /** Short working name for the venture. */
  title: string;
  /** Free-text description of the idea / problem / product. */
  description: string;
  /** Optional target market or geography hint (e.g. "SMB dentists, US"). */
  market?: string;
  /** Optional business model hint (e.g. "SaaS subscription"). */
  businessModel?: string;
  /** Optional named stage. */
  stage?: VentureStage;
  /** ISO timestamp of capture. */
  createdAt: string;
}

export type VentureStage =
  | "idea"
  | "validating"
  | "validated"
  | "building"
  | "launched"
  | "killed";

/* ------------------------------------------------------------------ */
/* Market analysis                                                     */
/* ------------------------------------------------------------------ */

/** One tier of a TAM / SAM / SOM market-size estimate. */
export interface MarketSizeEstimate {
  /** USD value of the tier. */
  valueUsd: number;
  /** Human-friendly rendering, e.g. "$4.2B". */
  display: string;
  /** How this number was derived (top-down / bottom-up reasoning). */
  basis: string;
}

/** Structured market / TAM analysis for a venture. */
export interface MarketAnalysis {
  /** Total Addressable Market. */
  tam: MarketSizeEstimate;
  /** Serviceable Addressable Market. */
  sam: MarketSizeEstimate;
  /** Serviceable Obtainable Market (realistic first-3-years capture). */
  som: MarketSizeEstimate;
  /** Estimated annual market growth rate, 0..1 (e.g. 0.18 = 18%). */
  cagr: number;
  /** Key assumptions the sizing depends on — surfaced for scrutiny. */
  assumptions: string[];
  /** Notable tailwinds / trends favouring the venture. */
  tailwinds: string[];
  /** Narrative summary of market attractiveness. */
  summary: string;
}

/* ------------------------------------------------------------------ */
/* Competitors                                                         */
/* ------------------------------------------------------------------ */

export type CompetitorType = "direct" | "indirect" | "substitute";

/** A single competitor identified in the landscape scan. */
export interface Competitor {
  name: string;
  type: CompetitorType;
  /** One-line description of what they do. */
  description: string;
  /** Their main strengths. */
  strengths: string[];
  /** Weaknesses / gaps the venture could exploit. */
  weaknesses: string[];
  /** Rough positioning on price ("low" | "mid" | "premium" | "unknown"). */
  pricePosition: "low" | "mid" | "premium" | "unknown";
}

/* ------------------------------------------------------------------ */
/* Customer segments                                                   */
/* ------------------------------------------------------------------ */

export interface CustomerSegment {
  name: string;
  /** Why this segment feels the pain most acutely. */
  painLevel: "low" | "medium" | "high" | "acute";
  description: string;
  /** Estimated willingness to pay, free text (e.g. "$50–200/mo"). */
  willingnessToPay: string;
}

/* ------------------------------------------------------------------ */
/* Lean Canvas                                                         */
/* ------------------------------------------------------------------ */

/**
 * Ash Maurya's Lean Canvas, nine blocks. Kept as discrete fields so the UI can
 * render the canonical grid layout deterministically.
 */
export interface LeanCanvas {
  problem: string[];
  customerSegments: string[];
  uniqueValueProposition: string;
  solution: string[];
  channels: string[];
  revenueStreams: string[];
  costStructure: string[];
  keyMetrics: string[];
  unfairAdvantage: string;
}

/* ------------------------------------------------------------------ */
/* MVP spec                                                            */
/* ------------------------------------------------------------------ */

export type MvpPriority = "must" | "should" | "could" | "wont";

/** A single MVP feature with MoSCoW priority and rough effort. */
export interface MvpFeature {
  name: string;
  description: string;
  priority: MvpPriority;
  /** Rough build effort in engineer-days. */
  effortDays: number;
  /** The user story this feature satisfies. */
  userStory: string;
}

export interface MvpSpec {
  /** One-sentence framing of what the MVP proves. */
  goal: string;
  /** The single riskiest assumption the MVP must test. */
  riskiestAssumption: string;
  features: MvpFeature[];
  /** Metrics that indicate the MVP is working. */
  successMetrics: string[];
  /** Rough total build estimate in weeks. */
  buildEstimateWeeks: number;
}

/* ------------------------------------------------------------------ */
/* Risks                                                               */
/* ------------------------------------------------------------------ */

export type RiskCategory =
  | "market"
  | "technical"
  | "financial"
  | "regulatory"
  | "team"
  | "competitive";

export interface Risk {
  category: RiskCategory;
  description: string;
  severity: "low" | "medium" | "high";
  /** How the studio would de-risk this. */
  mitigation: string;
}

/* ------------------------------------------------------------------ */
/* Landing page copy                                                   */
/* ------------------------------------------------------------------ */

export interface LandingCopy {
  headline: string;
  subheadline: string;
  /** 3–5 value-prop bullets. */
  valueBullets: string[];
  primaryCta: string;
}

/* ------------------------------------------------------------------ */
/* Validation report (the pipeline output)                             */
/* ------------------------------------------------------------------ */

/** The complete AI-generated validation report for an idea. */
export interface ValidationReport {
  ideaId: string;
  ideaTitle: string;
  /** Overall venture-viability score, 0..100. */
  score: number;
  /** One-line verdict, e.g. "Promising — worth a validation sprint." */
  verdict: string;
  /** Recommendation for the studio operator. */
  recommendation: "pursue" | "investigate" | "pivot" | "pass";
  market: MarketAnalysis;
  competitors: Competitor[];
  segments: CustomerSegment[];
  canvas: LeanCanvas;
  mvp: MvpSpec;
  risks: Risk[];
  landing: LandingCopy;
  /** True when served from the mock fallback (no AI key). */
  mocked: boolean;
  /** Model wall-clock time in ms (0 for mock). */
  latencyMs: number;
  /** ISO timestamp the report was produced. */
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/* API contracts                                                       */
/* ------------------------------------------------------------------ */

export interface ValidateRequest {
  title: string;
  description: string;
  market?: string;
  businessModel?: string;
}

export type ValidateResponse =
  | ValidationReport
  | { error: string; details?: unknown };
