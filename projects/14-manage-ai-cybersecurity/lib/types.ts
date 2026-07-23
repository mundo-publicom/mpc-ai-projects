/**
 * Domain types for the Managed AI Cybersecurity platform.
 *
 * This is a strictly DEFENSIVE (blue-team) product: it ingests security signals,
 * triages alerts with AI, scores security posture, and produces prioritized
 * remediation guidance. It contains no offensive tooling, exploit code, or
 * attacker capabilities of any kind.
 *
 * These types mirror the persisted data models described in
 * docs/TECHNICAL_SPEC.md. Zod schemas that validate API inputs live alongside
 * the routes and AI calls that use them; the canonical TypeScript shapes are
 * defined here so UI, API, and domain logic all speak the same language.
 */

/* ------------------------------------------------------------------ */
/* Enums / unions                                                      */
/* ------------------------------------------------------------------ */

/** Severity ladder used across alerts, triage, and findings. */
export type Severity = "critical" | "high" | "medium" | "low" | "info";

/** Where a raw signal originated. */
export type SignalSource =
  | "edr" // endpoint detection & response (e.g. CrowdStrike, SentinelOne, Defender)
  | "siem" // aggregated logs (e.g. Splunk, Sentinel, Elastic)
  | "firewall" // network / NGFW
  | "identity" // IdP / SSO (e.g. Okta, Entra ID)
  | "cloud" // CSP audit logs (e.g. CloudTrail, GCP audit)
  | "email" // secure email gateway
  | "vuln_scanner" // vulnerability scanner
  | "manual"; // analyst-submitted

/** Category of monitored asset. */
export type AssetType =
  | "endpoint"
  | "server"
  | "cloud_workload"
  | "identity"
  | "network_device"
  | "saas_app";

/** Business criticality of an asset — feeds posture weighting. */
export type AssetCriticality = "crown_jewel" | "high" | "standard" | "low";

/** Lifecycle state of an alert as it moves through the SOC workflow. */
export type AlertStatus =
  | "new"
  | "triaged"
  | "investigating"
  | "contained"
  | "resolved"
  | "false_positive"
  | "suppressed";

/** Verdict produced by the AI triage engine. */
export type TriageVerdict =
  | "true_positive"
  | "likely_true_positive"
  | "likely_false_positive"
  | "false_positive"
  | "needs_investigation";

/** Category buckets for a posture finding. */
export type FindingCategory =
  | "vulnerability"
  | "misconfiguration"
  | "identity"
  | "exposure"
  | "endpoint_hygiene"
  | "backup_recovery"
  | "logging_visibility";

/* ------------------------------------------------------------------ */
/* MITRE ATT&CK mapping                                                */
/* ------------------------------------------------------------------ */

/**
 * Reference to a MITRE ATT&CK technique. Used for classification and reporting
 * only — this is defensive attribution, not an attack playbook.
 */
export interface MitreMapping {
  /** Technique ID, e.g. "T1566" (Phishing) or sub-technique "T1566.001". */
  techniqueId: string;
  /** Human-readable technique name, e.g. "Phishing". */
  techniqueName: string;
  /** ATT&CK tactic phase, e.g. "Initial Access", "Execution". */
  tactic: string;
}

/* ------------------------------------------------------------------ */
/* Core data models                                                    */
/* ------------------------------------------------------------------ */

/** A monitored asset in the customer's environment. */
export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  criticality: AssetCriticality;
  /** Owning team / business unit, used for routing remediation. */
  owner?: string;
  /** Free-form tags (environment, compliance scope, etc.). */
  tags: string[];
  /** Last time a signal referenced this asset (ISO 8601). */
  lastSeen: string;
}

/**
 * A raw, normalized security alert as ingested from a feed. The `raw` field
 * preserves the original vendor payload for audit; the normalizer populates
 * the structured fields the triage engine consumes.
 */
export interface Alert {
  id: string;
  /** ISO 8601 timestamp of the observed event. */
  timestamp: string;
  source: SignalSource;
  /** Short signal title as emitted by the source tool. */
  title: string;
  /** Human-readable description / detection context. */
  description: string;
  /** Vendor-reported severity before AI triage (best-effort). */
  reportedSeverity: Severity;
  /** Asset this alert is associated with, if resolved. */
  assetId?: string;
  assetName?: string;
  /** Structured indicators extracted by the normalizer. */
  indicators: {
    sourceIp?: string;
    destinationIp?: string;
    user?: string;
    host?: string;
    process?: string;
    fileHash?: string;
    domain?: string;
  };
  status: AlertStatus;
  /** Original vendor payload, retained for audit / replay. */
  raw?: Record<string, unknown>;
}

/**
 * Structured output of the AI triage engine for a single alert. Produced via
 * `generateObject` + zod so the shape is guaranteed. In demo mode a
 * deterministic heuristic produces an equivalent result.
 */
export interface TriageResult {
  alertId: string;
  /** AI-assessed severity (may differ from reportedSeverity). */
  severity: Severity;
  verdict: TriageVerdict;
  /** Convenience flag derived from `verdict`. */
  isLikelyFalsePositive: boolean;
  /** Model confidence in the verdict, 0..1. */
  confidence: number;
  /** Primary ATT&CK technique this activity maps to. */
  mitreTechnique: MitreMapping;
  /** Concise analyst-facing explanation of the reasoning. */
  rationale: string;
  /** Ordered, concrete defensive remediation steps. */
  remediationSteps: string[];
  /** Whether a human analyst should review before auto-closing. */
  requiresHumanReview: boolean;
  /** True when produced by the mock engine (no AI key present). */
  mocked: boolean;
  /** End-to-end triage latency in milliseconds. */
  latencyMs: number;
}

/** An alert paired with its triage result for UI consumption. */
export interface TriagedAlert extends Alert {
  triage: TriageResult;
}

/**
 * A single posture finding — a discrete weakness discovered across the
 * environment (from scanners, config checks, or triaged alerts).
 */
export interface Finding {
  id: string;
  category: FindingCategory;
  title: string;
  severity: Severity;
  /** Assets affected by this finding. */
  affectedAssetIds: string[];
  /** True once the customer has remediated it. */
  resolved: boolean;
}

/** Per-category posture breakdown. */
export interface PostureCategoryScore {
  category: FindingCategory;
  /** 0..100, higher is better. */
  score: number;
  openFindings: number;
  /** Weight this category contributes to the overall score. */
  weight: number;
}

/**
 * Aggregate security posture for a customer environment, computed from open
 * findings. Score is 0..100 (higher is better) with a letter grade.
 */
export interface PostureScore {
  /** Overall posture score, 0..100. */
  score: number;
  /** Letter grade derived from the score. */
  grade: "A" | "B" | "C" | "D" | "F";
  categories: PostureCategoryScore[];
  totalFindings: number;
  openFindings: number;
  /** Counts of open findings by severity. */
  severityCounts: Record<Severity, number>;
  /** Change vs. the previous evaluation, in points (optional). */
  trendDelta?: number;
  computedAt: string;
}

/** A prioritized remediation recommendation surfaced to the customer. */
export interface Remediation {
  id: string;
  title: string;
  /** Which finding(s) / alert this addresses. */
  relatedFindingIds: string[];
  severity: Severity;
  /** Ordered steps to fix. */
  steps: string[];
  /** Estimated effort to remediate. */
  effort: "low" | "medium" | "high";
  /** Priority rank (1 = do first), derived from severity + effort + blast radius. */
  priority: number;
  /** Business justification / risk reduced. */
  rationale: string;
}

/* ------------------------------------------------------------------ */
/* API response envelopes                                              */
/* ------------------------------------------------------------------ */

export interface TriageResponse {
  triage: TriageResult;
}

export interface PostureResponse {
  posture: PostureScore;
  remediations: Remediation[];
}

export interface ApiError {
  error: string;
  details?: unknown;
}
