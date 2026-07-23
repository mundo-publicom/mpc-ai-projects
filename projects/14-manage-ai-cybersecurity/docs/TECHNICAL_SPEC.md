# Technical Spec — Managed AI Cybersecurity

> **Defensive posture:** every component and AI prompt in this system is oriented toward detection,
> triage, hardening, and remediation. There is no offensive tooling. The AI system prompt hard-codes a
> blue-team SOC-analyst role and refuses offensive requests.

## 1. System overview

A pipeline that turns raw security signals into prioritized, explainable defensive action:

```
ingest → normalize → AI triage → posture scoring → remediation advisor → alerting/UI
```

The scaffold in this repo implements the value-critical core for real: the **AI triage engine**
(`generateObject` + zod) and the **posture scorer + remediation advisor** (deterministic domain
logic), surfaced through a **SOC dashboard**. Ingestion connectors and persistence are specified here
and stubbed with realistic seed data so the product is demoable with zero configuration.

## 2. Component breakdown

| Component | Location | Responsibility |
| --- | --- | --- |
| **Signal ingestion** | `app/api/*` (M1 connectors) + manual `POST /api/triage` | Receive alerts/events from EDR, SIEM, firewall, IdP, cloud, email, scanners via webhook/API. |
| **Normalizer** | `lib/` (canonical shapes today; connector mappers in M1) | Map vendor payloads → canonical `Alert`, extract indicators, resolve the associated `Asset`. |
| **AI triage engine** | `lib/ai.ts`, `app/api/triage/route.ts` | Produce a structured `TriageResult` via `generateObject` + zod. Deterministic `mockTriage` fallback. |
| **Posture scorer** | `lib/posture.ts`, `app/api/posture/route.ts` | Transparent 0–100 score from weighted findings; per-category + severity breakdown. |
| **Remediation advisor** | `lib/posture.ts` (`buildRemediations`) + triage steps | Priority-ranked environment plan (severity × blast radius × effort) + per-alert steps. |
| **Alerting** | M2 (`lib/notify.ts`) | Route high-severity/high-confidence alerts to Slack + ticketing. |
| **Dashboard** | `app/page.tsx`, `components/*` | SOC console: posture gauge, KPIs, triaged alert feed, remediation panel. |

## 3. Data models (typed)

Canonical TypeScript shapes live in [`lib/types.ts`](../lib/types.ts). Summary:

```ts
type Severity = "critical" | "high" | "medium" | "low" | "info";

interface Asset {
  id: string; name: string;
  type: "endpoint" | "server" | "cloud_workload" | "identity" | "network_device" | "saas_app";
  criticality: "crown_jewel" | "high" | "standard" | "low";
  owner?: string; tags: string[]; lastSeen: string;
}

interface Alert {
  id: string; timestamp: string;
  source: "edr" | "siem" | "firewall" | "identity" | "cloud" | "email" | "vuln_scanner" | "manual";
  title: string; description: string; reportedSeverity: Severity;
  assetId?: string; assetName?: string;
  indicators: { sourceIp?; destinationIp?; user?; host?; process?; fileHash?; domain? };
  status: "new" | "triaged" | "investigating" | "contained" | "resolved" | "false_positive" | "suppressed";
  raw?: Record<string, unknown>;
}

interface MitreMapping { techniqueId: string; techniqueName: string; tactic: string; }

interface TriageResult {
  alertId: string; severity: Severity;
  verdict: "true_positive" | "likely_true_positive" | "likely_false_positive" | "false_positive" | "needs_investigation";
  isLikelyFalsePositive: boolean; confidence: number;         // 0..1
  mitreTechnique: MitreMapping; rationale: string;
  remediationSteps: string[]; requiresHumanReview: boolean;
  mocked: boolean; latencyMs: number;
}

interface Finding {
  id: string;
  category: "vulnerability" | "misconfiguration" | "identity" | "exposure" | "endpoint_hygiene" | "backup_recovery" | "logging_visibility";
  title: string; severity: Severity; affectedAssetIds: string[]; resolved: boolean;
}

interface PostureScore {
  score: number; grade: "A"|"B"|"C"|"D"|"F";
  categories: PostureCategoryScore[]; totalFindings: number; openFindings: number;
  severityCounts: Record<Severity, number>; trendDelta?: number; computedAt: string;
}

interface Remediation {
  id: string; title: string; relatedFindingIds: string[]; severity: Severity;
  steps: string[]; effort: "low"|"medium"|"high"; priority: number; rationale: string;
}
```

## 4. API surface

All routes run on the **Node.js runtime**, return typed JSON, and validate inputs with `zod`.

### `POST /api/triage`
Triage one raw alert.

- **Body:** an `Alert`-shaped object (or `{ alert: {...} }`). Only `title` + `description` are strictly
  required; other fields default. Validated by `alertSchema`.
- **200:** `{ triage: TriageResult }`.
- **400/422:** invalid JSON / validation failure (`{ error, details }`).
- **Behavior:** if `hasAI()` → `generateObject({ model: anthropic/claude-sonnet-5, schema: triageSchema, temperature: 0.2 })`. Else, or on model error → deterministic `mockTriage` with an `x-fallback-reason` header on error.

```jsonc
// → { "triage": { "severity": "critical", "verdict": "likely_true_positive",
//     "isLikelyFalsePositive": false, "confidence": 0.92,
//     "mitreTechnique": { "techniqueId": "T1486", "techniqueName": "Data Encrypted for Impact", "tactic": "Impact" },
//     "rationale": "…", "remediationSteps": ["Isolate the host…", …],
//     "requiresHumanReview": true, "mocked": true, "latencyMs": 3 } }
```

### `POST /api/posture`
Score an arbitrary set of findings.

- **Body:** `{ findings: Finding[], previousScore?: number }` (validated by `bodySchema`).
- **200:** `{ posture: PostureScore, remediations: Remediation[] }`.

### `GET /api/posture`
Scores the built-in demo environment (seed findings) so the dashboard renders on first load with zero
setup. **200:** `{ posture, remediations }`.

## 5. AI / model usage

- **SDK:** Vercel AI SDK v5 (`ai`), models addressed as `"provider/model"` strings routed through the
  **Vercel AI Gateway** (`lib/ai.ts` → `MODELS`). No provider SDK wired directly.
- **Primary call — alert triage:** `generateObject` with `triageSchema` (zod). The schema encodes the
  full contract — severity, verdict, confidence (0–1), MITRE technique object, rationale, remediation
  steps (1–8), `requiresHumanReview` — and field `.describe()` text doubles as inline instruction.
  `temperature: 0.2` for consistency. Model tier `smart` (`anthropic/claude-sonnet-5`) balances quality
  and latency; escalate to `frontier` for complex investigations.
- **System prompt (`TRIAGE_SYSTEM_PROMPT`):** pins a senior blue-team SOC-analyst role, mandates
  defensive-only output, honest uncertainty, false-positive awareness, and least-disruptive
  containment. This is the product's core safety surface.
- **Remediation:** per-alert steps come from the same `generateObject` triage call (kept in one
  round-trip); environment-wide remediation is generated deterministically by `buildRemediations` from
  vetted templates, so recommendations are reproducible and cannot hallucinate.
- **Determinism / fallback:** `hasAI()` gates real calls. `mockTriage` is a keyword-rule engine that
  returns the identical `GeneratedTriage` shape, so UI and API behave the same with zero keys. Model
  errors degrade to the mock — an alert is never dropped.
- **Posture scoring is NOT AI:** it is a transparent weighted calculation (`lib/posture.ts`) so scores
  are auditable and stable.

## 6. Third-party integrations

- **EDR:** CrowdStrike Falcon, SentinelOne, Microsoft Defender for Endpoint (OAuth2 / API tokens).
- **SIEM:** Splunk HEC, Microsoft Sentinel / Log Analytics, Elastic.
- **Identity:** Okta, Microsoft Entra ID (audit-log APIs).
- **Cloud:** AWS CloudTrail, GCP audit logs, Azure activity logs.
- **Email security:** M365 / secure email gateways.
- **Vulnerability scanners:** for `Finding` ingestion.
- **Alerting/ticketing:** Slack incoming webhooks; Jira / ServiceNow.
- All credentials via env (`.env.example`); feed scopes are **read-only least-privilege**.

## 7. Security & privacy

- **Tenant isolation:** logical isolation per customer; row-level scoping on all queries (M3).
- **Encryption:** TLS 1.2+ in transit; AES-256 at rest for stored alerts/findings/reports.
- **Credential handling:** integration secrets in a secrets manager, never in code or logs; read-only
  scopes; rotation supported.
- **PII / data minimization:** ingest only fields needed for triage; redact secrets from `raw`
  payloads; configurable retention; **no customer data used to train models**.
- **Audit:** immutable audit log of every triage verdict, status change, and suppression, with actor
  and timestamp — supports compliance evidence and incident review.
- **Compliance:** designed to **SOC 2 Type II** (security, availability, confidentiality) and **GDPR**
  (DPA, data-residency options, subject-rights support). Compliance evidence packs are a paid add-on.
- **Defensive-only invariant:** enforced in the system prompt and covered by tests (§9); offensive
  requests are refused.

## 8. Observability

- **Structured logs** per triage: alert id, tenant, model/mock, latency, verdict, confidence,
  fallback reason.
- **Metrics:** triage latency (p50/p95), throughput, mock-vs-AI ratio, verdict distribution,
  false-positive rate, model error/fallback rate, posture score per tenant over time.
- **Tracing:** ingestion → normalize → triage → alert spans for pipeline latency.
- **Alerting on the platform itself:** model error-rate and ingestion-lag thresholds page on-call.
- **Cost tracking:** per-tenant token spend via the AI Gateway to protect per-asset margins.

## 9. Scaling considerations

- **Stateless routes on Fluid Compute** scale horizontally; heavy ingestion goes through a queue
  (e.g. SQS/Redis) with batched triage to smooth bursts (target 10k alerts/hr/tenant).
- **Batching & caching:** deduplicate near-identical alerts; cache triage for recurring signatures;
  suppression rules short-circuit known-benign noise before hitting the model.
- **Model tiering:** default to `smart`; route obvious/low-risk signals to `fast`; reserve `frontier`
  for complex cases — controls latency and cost.
- **Posture scoring** is O(findings) and cheap; recompute on finding change or schedule.
- **Persistence (M1+):** Postgres for assets/alerts/findings/scores; time-series store for posture
  trend; object storage for reports.

## 10. Testing strategy

- **Unit — posture:** `computePosture` (weighting, clamping, grade thresholds, severity histogram,
  trend delta) and `buildRemediations` (priority ordering by severity × blast radius × effort).
- **Unit — triage mock:** `mockTriage` rule matching and `toTriageResult` derivation of
  `isLikelyFalsePositive`.
- **Schema/contract:** `triageSchema` accepts valid model output and rejects malformed; route input
  validation (400/422) paths.
- **Integration:** `POST /api/triage` in both AI and mock modes (mock deterministic); `GET/POST
  /api/posture` shapes.
- **Safety tests:** adversarial prompts attempting to elicit offensive output must be refused — the
  defensive-only invariant is a first-class test.
- **E2E:** dashboard loads, triages the seed feed, renders badges + ATT&CK tags, and shows the
  prioritized remediation plan with zero keys.
