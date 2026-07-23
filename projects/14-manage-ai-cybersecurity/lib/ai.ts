import { generateText, generateObject } from "ai";
import { z } from "zod";
import type { Alert, Severity, TriageResult, TriageVerdict } from "./types";

// Re-export so routes can import the SDK helpers from one place.
export { generateText, generateObject };

/**
 * Model catalog. Calls are routed through the Vercel AI Gateway using plain
 * "provider/model" strings — no provider SDK is wired directly.
 */
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * True when a gateway/provider key is present. When false, API routes serve
 * realistic, deterministic mock data so the demo runs end-to-end with zero
 * configuration.
 */
export const hasAI = () =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

/* ------------------------------------------------------------------ */
/* Triage output schema (generateObject + zod)                         */
/* ------------------------------------------------------------------ */

const severityEnum = z.enum(["critical", "high", "medium", "low", "info"]);

const verdictEnum = z.enum([
  "true_positive",
  "likely_true_positive",
  "likely_false_positive",
  "false_positive",
  "needs_investigation",
]);

/**
 * The structured contract the triage model must return. Kept tight so the UI
 * can render badges, ATT&CK tags, and a remediation panel with no post-hoc
 * parsing. Descriptions double as inline instructions to the model.
 */
export const triageSchema = z.object({
  severity: severityEnum.describe(
    "Your independent assessment of severity based on the evidence — this may differ from the vendor-reported severity.",
  ),
  verdict: verdictEnum.describe(
    "Overall judgement of whether this is a real threat. Use 'needs_investigation' when evidence is genuinely ambiguous.",
  ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Your confidence in the verdict, from 0 (guess) to 1 (certain)."),
  mitreTechnique: z
    .object({
      techniqueId: z
        .string()
        .describe("MITRE ATT&CK technique ID, e.g. 'T1566' or 'T1110.001'."),
      techniqueName: z
        .string()
        .describe("The technique name, e.g. 'Phishing' or 'Brute Force'."),
      tactic: z
        .string()
        .describe("The ATT&CK tactic phase, e.g. 'Initial Access', 'Credential Access'."),
    })
    .describe("Best-fit MITRE ATT&CK classification for defensive attribution and reporting."),
  rationale: z
    .string()
    .describe("A concise (2-4 sentence) analyst-facing explanation of your reasoning."),
  remediationSteps: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe(
      "Ordered, concrete DEFENSIVE remediation actions a blue-team analyst can take (contain, investigate, harden). Never include offensive actions.",
    ),
  requiresHumanReview: z
    .boolean()
    .describe("True if a human analyst should confirm before this alert is auto-closed."),
});

export type GeneratedTriage = z.infer<typeof triageSchema>;

/* ------------------------------------------------------------------ */
/* Prompt construction                                                 */
/* ------------------------------------------------------------------ */

/**
 * System prompt that constrains the model to a defensive SOC-analyst role.
 * The guardrails (defensive-only, no fabrication, confidence honesty) are the
 * critical safety surface of this product.
 */
export const TRIAGE_SYSTEM_PROMPT = [
  "You are a senior SOC (Security Operations Center) analyst working for a managed",
  "detection & response provider that protects small and mid-sized businesses.",
  "Your role is strictly DEFENSIVE (blue-team): you triage security alerts, assess",
  "risk, map activity to MITRE ATT&CK for reporting, and recommend defensive",
  "remediation. You NEVER provide offensive tooling, exploit code, attack",
  "instructions, or ways to evade detection.",
  "",
  "Triage principles:",
  "- Weigh the evidence in the alert; do not assume malice or benignity without cause.",
  "- Be honest about uncertainty — use 'needs_investigation' and lower confidence when the signal is ambiguous.",
  "- Consider common false-positive patterns (admin tooling, backups, scanners, known service accounts).",
  "- Recommendations must be concrete, prioritized, and purely defensive: contain, investigate, harden, monitor.",
  "- Prefer the least-disruptive effective containment first.",
].join("\n");

/** Renders a single alert into a compact prompt block for the model. */
export function renderAlert(alert: Alert): string {
  const ind = alert.indicators;
  const indicatorLines = Object.entries(ind)
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join("\n");

  return [
    `Source: ${alert.source}`,
    `Title: ${alert.title}`,
    `Description: ${alert.description}`,
    `Vendor-reported severity: ${alert.reportedSeverity}`,
    alert.assetName ? `Affected asset: ${alert.assetName}` : null,
    `Observed at: ${alert.timestamp}`,
    indicatorLines ? `Indicators:\n${indicatorLines}` : "Indicators: (none extracted)",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildTriagePrompt(alert: Alert): string {
  return [
    "Triage the following security alert. Return your assessment as structured data.",
    "",
    "--- ALERT ---",
    renderAlert(alert),
    "--- END ALERT ---",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Mock triage engine (no API key present)                             */
/* ------------------------------------------------------------------ */

const VERDICT_FP: Record<TriageVerdict, boolean> = {
  true_positive: false,
  likely_true_positive: false,
  likely_false_positive: true,
  false_positive: true,
  needs_investigation: false,
};

/** Convenience: is a verdict a (likely) false positive? */
export function verdictIsFalsePositive(v: TriageVerdict): boolean {
  return VERDICT_FP[v];
}

interface MockRule {
  match: RegExp;
  severity: Severity;
  verdict: TriageVerdict;
  confidence: number;
  technique: { techniqueId: string; techniqueName: string; tactic: string };
  rationale: string;
  remediationSteps: string[];
  requiresHumanReview: boolean;
}

/**
 * Deterministic keyword-driven rules so the product is fully demoable with no
 * keys. Ordered by specificity; first match wins. This mirrors the shape the
 * real model returns so the UI is identical in both modes.
 */
const MOCK_RULES: MockRule[] = [
  {
    match: /ransomware|encrypt|shadow copy|vssadmin|lockbit/i,
    severity: "critical",
    verdict: "likely_true_positive",
    confidence: 0.92,
    technique: {
      techniqueId: "T1486",
      techniqueName: "Data Encrypted for Impact",
      tactic: "Impact",
    },
    rationale:
      "Behavior consistent with ransomware pre-encryption staging (shadow-copy deletion / mass file writes). High impact if confirmed; contain immediately.",
    remediationSteps: [
      "Isolate the affected host from the network via EDR containment.",
      "Disable the involved user account and rotate its credentials.",
      "Verify integrity and offline availability of the latest backups.",
      "Preserve volatile evidence and open an incident ticket for IR.",
    ],
    requiresHumanReview: true,
  },
  {
    match: /brute.?force|failed login|password spray|multiple failed|lockout/i,
    severity: "high",
    verdict: "likely_true_positive",
    confidence: 0.78,
    technique: {
      techniqueId: "T1110",
      techniqueName: "Brute Force",
      tactic: "Credential Access",
    },
    rationale:
      "Repeated authentication failures against one or more accounts indicate credential-guessing. Elevated risk given exposure of the identity provider.",
    remediationSteps: [
      "Temporarily lock or step-up MFA on the targeted account(s).",
      "Block the source IP at the identity provider / firewall.",
      "Confirm MFA is enforced for all affected users.",
      "Review sign-in logs for any successful authentication from the source.",
    ],
    requiresHumanReview: true,
  },
  {
    match: /phish|malicious link|spoof|credential harvest|suspicious email/i,
    severity: "high",
    verdict: "likely_true_positive",
    confidence: 0.74,
    technique: {
      techniqueId: "T1566",
      techniqueName: "Phishing",
      tactic: "Initial Access",
    },
    rationale:
      "Message characteristics match known phishing patterns (spoofed sender / credential-harvesting link). Risk of account compromise if a user interacted.",
    remediationSteps: [
      "Quarantine the message and purge identical copies across mailboxes.",
      "Block the sender domain and any linked URLs at the email gateway.",
      "Check whether any recipient clicked or submitted credentials.",
      "Reset credentials for any user who interacted with the link.",
    ],
    requiresHumanReview: false,
  },
  {
    match: /powershell|encoded command|lolbin|living off the land|mshta|rundll32/i,
    severity: "high",
    verdict: "needs_investigation",
    confidence: 0.6,
    technique: {
      techniqueId: "T1059.001",
      techniqueName: "Command and Scripting Interpreter: PowerShell",
      tactic: "Execution",
    },
    rationale:
      "Encoded / obfuscated script execution can be malicious or legitimate admin automation. Evidence is ambiguous and warrants investigation of the parent process.",
    remediationSteps: [
      "Decode and review the executed command line.",
      "Identify the parent process and initiating user.",
      "Correlate with change tickets or known admin automation.",
      "If unrecognized, isolate the host and escalate.",
    ],
    requiresHumanReview: true,
  },
  {
    match: /exfil|data transfer|large upload|unusual outbound|c2|beacon/i,
    severity: "high",
    verdict: "needs_investigation",
    confidence: 0.66,
    technique: {
      techniqueId: "T1041",
      techniqueName: "Exfiltration Over C2 Channel",
      tactic: "Exfiltration",
    },
    rationale:
      "Anomalous outbound volume or periodic beaconing may indicate exfiltration or C2, but could also be a backup/sync job. Validate the destination and data classification.",
    remediationSteps: [
      "Identify the destination host/domain and its reputation.",
      "Determine what data and process drove the transfer.",
      "If unsanctioned, block the destination and isolate the source host.",
      "Review DLP and proxy logs for related activity.",
    ],
    requiresHumanReview: true,
  },
  {
    match: /new admin|privilege|role assignment|added to group|sudo|elevation/i,
    severity: "medium",
    verdict: "needs_investigation",
    confidence: 0.55,
    technique: {
      techniqueId: "T1098",
      techniqueName: "Account Manipulation",
      tactic: "Persistence",
    },
    rationale:
      "A privilege or role change can be legitimate provisioning or an attacker establishing persistence. Confirm against approved change requests.",
    remediationSteps: [
      "Verify the change against an approved ticket or provisioning event.",
      "Confirm the actor performing the change is authorized.",
      "If unauthorized, revert the grant and disable the actor.",
      "Enable alerting on future privileged role changes.",
    ],
    requiresHumanReview: true,
  },
  {
    match: /scan|nmap|port sweep|reconnaissance|probe/i,
    severity: "low",
    verdict: "likely_true_positive",
    confidence: 0.7,
    technique: {
      techniqueId: "T1595",
      techniqueName: "Active Scanning",
      tactic: "Reconnaissance",
    },
    rationale:
      "External scanning is constant background internet noise and rarely actionable on its own, but confirm no exposed services responded.",
    remediationSteps: [
      "Confirm no unintended services are exposed on the scanned ports.",
      "Ensure the perimeter firewall is dropping unsolicited probes.",
      "Add the source to a watchlist if scanning persists.",
    ],
    requiresHumanReview: false,
  },
  {
    match: /test|benign|expected|maintenance|known good|approved/i,
    severity: "info",
    verdict: "likely_false_positive",
    confidence: 0.82,
    technique: {
      techniqueId: "T1078",
      techniqueName: "Valid Accounts",
      tactic: "Defense Evasion",
    },
    rationale:
      "Activity matches known-good / maintenance patterns and lacks corroborating malicious indicators. Likely benign; suppress with a documented reason.",
    remediationSteps: [
      "Confirm the activity aligns with a scheduled maintenance window.",
      "Create a tuned suppression rule to reduce future noise.",
      "Document the false-positive rationale for audit.",
    ],
    requiresHumanReview: false,
  },
];

/** Fallback rule when nothing matches — conservative, needs a human. */
const DEFAULT_RULE: Omit<MockRule, "match"> = {
  severity: "medium",
  verdict: "needs_investigation",
  confidence: 0.5,
  technique: {
    techniqueId: "T1027",
    techniqueName: "Obfuscated Files or Information",
    tactic: "Defense Evasion",
  },
  rationale:
    "Insufficient corroborating context to classify confidently. Treat as needing investigation and gather related telemetry before closing.",
  remediationSteps: [
    "Enrich the alert with asset owner, user, and recent activity context.",
    "Correlate against other signals from the same host/user in the last 24h.",
    "Escalate to a human analyst for a verdict.",
  ],
  requiresHumanReview: true,
};

/**
 * Produce a deterministic triage result from an alert using keyword rules.
 * Severity is nudged up if the alert affects a crown-jewel asset context in
 * its text. Shape matches `GeneratedTriage` exactly.
 */
export function mockTriage(alert: Alert): GeneratedTriage {
  const haystack = `${alert.title} ${alert.description} ${alert.source}`;
  const rule = MOCK_RULES.find((r) => r.match.test(haystack));
  const base = rule ?? DEFAULT_RULE;

  return {
    severity: base.severity,
    verdict: base.verdict,
    confidence: base.confidence,
    mitreTechnique: base.technique,
    rationale: base.rationale,
    remediationSteps: base.remediationSteps,
    requiresHumanReview: base.requiresHumanReview,
  };
}

/**
 * Assemble a full `TriageResult` from a generated/mock core plus alert id and
 * timing metadata. Single place that derives `isLikelyFalsePositive`.
 */
export function toTriageResult(
  alertId: string,
  core: GeneratedTriage,
  meta: { mocked: boolean; latencyMs: number },
): TriageResult {
  return {
    alertId,
    severity: core.severity,
    verdict: core.verdict,
    isLikelyFalsePositive: verdictIsFalsePositive(core.verdict),
    confidence: core.confidence,
    mitreTechnique: core.mitreTechnique,
    rationale: core.rationale,
    remediationSteps: core.remediationSteps,
    requiresHumanReview: core.requiresHumanReview,
    mocked: meta.mocked,
    latencyMs: meta.latencyMs,
  };
}
