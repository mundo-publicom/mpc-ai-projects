/**
 * Posture scoring engine.
 *
 * Computes a 0..100 security posture score from a set of findings. The model
 * is transparent and deterministic (no AI required): each open finding
 * deducts points from its category, categories are weighted by how much they
 * move real-world risk, and the weighted average becomes the overall score.
 *
 * Higher score = stronger posture. This is the metric SMB customers watch
 * trend upward over the life of the engagement.
 */

import type {
  Finding,
  FindingCategory,
  PostureCategoryScore,
  PostureScore,
  Remediation,
  Severity,
} from "./types";

/* ------------------------------------------------------------------ */
/* Weights & penalties                                                 */
/* ------------------------------------------------------------------ */

/**
 * Relative weight of each finding category in the overall score. These sum to
 * 1.0. Identity and vulnerability management carry the most weight because
 * they are the most common SMB breach vectors.
 */
export const CATEGORY_WEIGHTS: Record<FindingCategory, number> = {
  identity: 0.22,
  vulnerability: 0.2,
  misconfiguration: 0.16,
  endpoint_hygiene: 0.14,
  exposure: 0.12,
  backup_recovery: 0.1,
  logging_visibility: 0.06,
};

/** Points deducted from a category's 100 for each open finding of a severity. */
export const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 45,
  high: 25,
  medium: 12,
  low: 5,
  info: 1,
};

const ALL_CATEGORIES = Object.keys(CATEGORY_WEIGHTS) as FindingCategory[];
const ALL_SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

/** Numeric rank for sorting severities (higher = worse). */
const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export function severityRank(s: Severity): number {
  return SEVERITY_RANK[s];
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function scoreToGrade(score: number): PostureScore["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/**
 * Compute the full posture score from a list of findings. Only OPEN findings
 * (resolved === false) deduct points; resolved ones are counted for reporting
 * but do not penalize the score.
 *
 * @param findings   The environment's current findings.
 * @param prevScore  Optional previous overall score, to compute trendDelta.
 */
export function computePosture(
  findings: Finding[],
  prevScore?: number,
): PostureScore {
  const open = findings.filter((f) => !f.resolved);

  // Per-category penalty accumulation.
  const categoryScores: PostureCategoryScore[] = ALL_CATEGORIES.map((category) => {
    const inCategory = open.filter((f) => f.category === category);
    const penalty = inCategory.reduce(
      (sum, f) => sum + SEVERITY_PENALTY[f.severity],
      0,
    );
    return {
      category,
      score: Math.round(clamp(100 - penalty)),
      openFindings: inCategory.length,
      weight: CATEGORY_WEIGHTS[category],
    };
  });

  // Weighted average across categories → overall score.
  const overall = categoryScores.reduce(
    (sum, c) => sum + c.score * c.weight,
    0,
  );
  const score = Math.round(clamp(overall));

  // Severity histogram over open findings.
  const severityCounts = ALL_SEVERITIES.reduce(
    (acc, sev) => {
      acc[sev] = open.filter((f) => f.severity === sev).length;
      return acc;
    },
    {} as Record<Severity, number>,
  );

  return {
    score,
    grade: scoreToGrade(score),
    categories: categoryScores.sort((a, b) => a.score - b.score),
    totalFindings: findings.length,
    openFindings: open.length,
    severityCounts,
    trendDelta: prevScore === undefined ? undefined : score - prevScore,
    computedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Remediation prioritization                                          */
/* ------------------------------------------------------------------ */

const EFFORT_FOR_CATEGORY: Record<FindingCategory, Remediation["effort"]> = {
  identity: "low",
  misconfiguration: "low",
  endpoint_hygiene: "medium",
  exposure: "medium",
  vulnerability: "medium",
  logging_visibility: "medium",
  backup_recovery: "high",
};

const REMEDIATION_TEMPLATES: Record<
  FindingCategory,
  { steps: string[]; rationale: string }
> = {
  identity: {
    steps: [
      "Enforce MFA on all accounts, prioritizing admins and remote access.",
      "Disable or right-size stale and over-privileged accounts.",
      "Enable conditional-access / impossible-travel policies at the IdP.",
    ],
    rationale:
      "Identity is the most common SMB breach vector; closing these gaps yields the largest immediate risk reduction.",
  },
  vulnerability: {
    steps: [
      "Patch internet-facing and critical systems on a defined SLA.",
      "Prioritize CVEs with known exploitation (CISA KEV) first.",
      "Schedule recurring authenticated vulnerability scans.",
    ],
    rationale:
      "Unpatched, exploitable vulnerabilities are directly actionable by attackers and often the initial foothold.",
  },
  misconfiguration: {
    steps: [
      "Apply CIS-benchmark baseline configurations to cloud and endpoints.",
      "Remove default credentials and disable unused services.",
      "Enable drift detection to catch future misconfigurations.",
    ],
    rationale:
      "Misconfigurations are low-effort, high-impact fixes that shrink the attack surface quickly.",
  },
  endpoint_hygiene: {
    steps: [
      "Ensure EDR is installed and reporting on every managed endpoint.",
      "Enforce disk encryption and OS/browser auto-updates.",
      "Remove unauthorized or end-of-life software.",
    ],
    rationale:
      "Consistent endpoint coverage removes blind spots where intrusions go undetected.",
  },
  exposure: {
    steps: [
      "Inventory and close unnecessary internet-facing services.",
      "Place remote-access services behind VPN / zero-trust access.",
      "Continuously monitor the external attack surface.",
    ],
    rationale:
      "Reducing external exposure limits what an attacker can even attempt to reach.",
  },
  backup_recovery: {
    steps: [
      "Ensure backups follow the 3-2-1 rule with at least one offline/immutable copy.",
      "Test restoration end-to-end on a regular cadence.",
      "Document and rehearse the recovery runbook.",
    ],
    rationale:
      "Reliable, tested, immutable backups are the ultimate defense against ransomware impact.",
  },
  logging_visibility: {
    steps: [
      "Forward endpoint, identity, and cloud logs to the SIEM.",
      "Set retention to meet compliance and IR needs (>= 90 days).",
      "Validate that critical detections are firing as expected.",
    ],
    rationale:
      "Without telemetry, threats cannot be detected or investigated — visibility underpins every other control.",
  },
};

/**
 * Turn open findings into a prioritized remediation plan. Findings are grouped
 * by category; each group becomes one recommendation. Priority is derived from
 * the worst severity in the group, the blast radius (assets affected), and the
 * estimated effort — so customers see the highest-leverage, lowest-effort work
 * first.
 */
export function buildRemediations(findings: Finding[]): Remediation[] {
  const open = findings.filter((f) => !f.resolved);
  const byCategory = new Map<FindingCategory, Finding[]>();

  for (const f of open) {
    const list = byCategory.get(f.category) ?? [];
    list.push(f);
    byCategory.set(f.category, list);
  }

  const scored: Array<{ remediation: Remediation; score: number }> = [];

  for (const [category, group] of byCategory) {
    const worst = group.reduce<Severity>(
      (acc, f) => (severityRank(f.severity) > severityRank(acc) ? f.severity : acc),
      "info",
    );
    const blastRadius = new Set(group.flatMap((f) => f.affectedAssetIds)).size;
    const effort = EFFORT_FOR_CATEGORY[category];
    const template = REMEDIATION_TEMPLATES[category];

    // Priority score: severity dominates, blast radius amplifies, effort is a
    // mild tie-breaker (lower effort ranks slightly higher).
    const effortBonus = effort === "low" ? 1.15 : effort === "medium" ? 1.0 : 0.85;
    const score =
      severityRank(worst) * 10 + Math.min(blastRadius, 10) * 2 * effortBonus;

    scored.push({
      score,
      remediation: {
        id: `rem-${category}`,
        title: titleForCategory(category),
        relatedFindingIds: group.map((f) => f.id),
        severity: worst,
        steps: template.steps,
        effort,
        priority: 0, // assigned after sort
        rationale: template.rationale,
      },
    });
  }

  // Sort by computed score (desc), then assign 1-based priority ranks.
  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ remediation }, i) => ({ ...remediation, priority: i + 1 }));
}

function titleForCategory(category: FindingCategory): string {
  const map: Record<FindingCategory, string> = {
    identity: "Harden identity & access controls",
    vulnerability: "Remediate exploitable vulnerabilities",
    misconfiguration: "Fix security misconfigurations",
    endpoint_hygiene: "Close endpoint coverage gaps",
    exposure: "Reduce external attack surface",
    backup_recovery: "Strengthen backup & recovery",
    logging_visibility: "Improve logging & visibility",
  };
  return map[category];
}
