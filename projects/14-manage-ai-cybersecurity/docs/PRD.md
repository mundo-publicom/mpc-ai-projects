# PRD — Managed AI Cybersecurity

> **Framing: strictly defensive (blue-team).** This product detects, triages, and helps remediate
> threats. It contains no offensive tooling, exploit development, red-team automation, or
> detection-evasion capabilities of any kind. Every AI output is oriented toward *defending* an
> environment: containing threats, hardening controls, and reducing risk.

## 1. Overview

Managed AI Cybersecurity is a managed detection & response (MDR) platform built for small and
mid-sized businesses (SMBs) that cannot staff a 24/7 Security Operations Center (SOC). It ingests
security signals from the tools a business already runs (EDR, SIEM, firewall, identity provider,
cloud audit logs, email security), uses AI to **triage every alert** — assessing severity, likely
true/false-positive status, and MITRE ATT&CK mapping — continuously **scores the organization's
security posture**, and produces a **prioritized, plain-language remediation plan**.

The result: an SMB gets SOC-grade alert triage and guidance at a fraction of the cost of hiring
analysts, and an MSP/vCISO can protect many clients from a single console.

## 2. Problem

- SMBs are now primary ransomware and business-email-compromise targets, but **73% have no
  dedicated security staff**. Security tools generate thousands of alerts nobody has time to read.
- Alert fatigue is real: analysts (where they exist) ignore or rubber-stamp alerts, so real threats
  hide in the noise. False-positive rates of 90%+ are common.
- Hiring a SOC analyst costs $90k–$150k/yr; a 24/7 team is out of reach. Existing MDR vendors are
  expensive and enterprise-shaped.
- SMBs don't know their own risk posture, can't prioritize fixes, and fail compliance audits
  (SOC 2, HIPAA, PCI, cyber-insurance questionnaires) for lack of evidence.

**Core pain:** too many alerts, too little expertise, no clear sense of "what do I fix first?"

## 3. Target users & personas

### Persona A — SMB IT Lead ("Dana")
Runs all of IT for a 40–300 person company. Wears every hat. Has an EDR and M365 but no security
specialist. Needs someone/something to tell her which of today's 400 alerts actually matter and
exactly what to do about the ones that do. Buyer and daily user.

### Persona B — vCISO / MSP Security Lead ("Marcus")
Provides fractional security leadership or managed IT to 5–50 client companies. Needs a
multi-tenant console to triage across clients, demonstrate value with posture trends, and scale
without hiring an analyst per client. Buyer, power user, and reseller.

### Persona C — Compliance Owner ("Priya")
Owns SOC 2 / HIPAA / cyber-insurance obligations. Doesn't operate tools day-to-day but needs
defensible evidence: posture scores over time, alert-handling records, and remediation audit
trails. Influencer and reporting consumer.

## 4. User stories

1. As Dana, I want every incoming alert automatically triaged with a severity and a true/false-positive
   verdict, so I only spend time on what's real.
2. As Dana, I want each real alert to come with concrete, ordered steps to contain and fix it, so I
   don't have to be a security expert.
3. As Dana, I want a single posture score that trends over time, so I can show leadership we're
   improving.
4. As Marcus, I want one console across all my clients with per-client posture and alert queues, so
   I can protect more clients per hour.
5. As Marcus, I want AI triage to explain its reasoning and cite the ATT&CK technique, so I can trust
   and defend the verdict to a client.
6. As Priya, I want exportable posture and alert-handling reports, so I can satisfy auditors and
   insurers.
7. As any user, I want high-severity alerts pushed to Slack/ticketing in real time, so nothing waits
   for someone to log in.
8. As any user, I want the system to flag when a human should review before auto-closing, so we never
   silently dismiss a real threat.

## 5. Functional requirements

1. **FR-1 Signal ingestion.** Ingest alerts/events from EDR, SIEM, firewall, identity provider, cloud
   audit logs, email security, and vulnerability scanners via API/webhook, plus manual submission.
2. **FR-2 Normalization.** Map heterogeneous vendor payloads into a canonical `Alert` shape with
   extracted indicators (IP, user, host, process, hash, domain) and an associated asset.
3. **FR-3 AI triage.** For each alert produce a structured `TriageResult`: independent severity,
   verdict (true/likely-true/likely-false/false/needs-investigation), confidence 0–1, MITRE ATT&CK
   technique, analyst-facing rationale, and ordered defensive remediation steps.
4. **FR-4 False-positive suppression.** Derive `isLikelyFalsePositive` and support tuned suppression
   rules so recurring benign signals stop generating noise.
5. **FR-5 Human-in-the-loop.** Flag `requiresHumanReview`; never auto-close a high-severity or
   low-confidence alert without review.
6. **FR-6 Asset inventory.** Maintain assets with type, business criticality, owner, and tags; use
   criticality to weight triage and posture.
7. **FR-7 Posture scoring.** Compute a transparent 0–100 posture score (+ letter grade) from open
   findings across weighted categories, with per-category breakdown and severity histogram.
8. **FR-8 Posture trend.** Persist scores over time and expose the delta vs. the previous evaluation.
9. **FR-9 Remediation advisor.** Produce an environment-wide, priority-ranked remediation plan from
   findings (severity × blast radius × effort), with rationale per item.
10. **FR-10 Alerting & routing.** Push high-severity/high-confidence alerts to Slack and create
    tickets (Jira/ServiceNow) with the triage summary attached.
11. **FR-11 Alert lifecycle.** Track status: new → triaged → investigating → contained → resolved /
    false_positive / suppressed.
12. **FR-12 Dashboard.** SOC console: posture gauge, KPI tiles, live triaged alert feed with
    color-coded severity + ATT&CK tags, and a remediation panel.
13. **FR-13 Reporting/export.** Exportable posture and alert-handling reports for compliance/insurance.
14. **FR-14 Graceful degradation.** With no AI key configured, deterministic mock triage and
    posture scoring keep the product fully demoable.

## 6. Non-functional requirements

- **Defensive-only guardrail.** System prompts and product surface forbid offensive output; this is a
  hard product invariant, tested.
- **Latency.** Per-alert triage p95 < 4 s; dashboard first paint < 1.5 s.
- **Throughput.** Handle bursts of 10k alerts/hour per tenant via queue + batching.
- **Availability.** 99.9% for ingestion and alerting paths.
- **Security.** Tenant isolation, encryption in transit and at rest, least-privilege feed credentials,
  full audit log. SOC 2 Type II and GDPR aligned (see §11 Risks and TECHNICAL_SPEC §Security).
- **Explainability.** Every AI verdict includes a rationale and confidence; no unexplained
  auto-closures.
- **Determinism where it matters.** Posture scoring is a transparent, reproducible calculation, not an
  LLM guess.

## 7. Success metrics / KPIs

- **MTTR** (mean time to respond to true-positive alerts) — target ↓ 50% within 90 days of onboarding.
- **False-positive reduction** — % of alerts auto-classified as (likely) false positive and safely
  suppressed; target ≥ 60% noise reduction while maintaining < 1% false-negative rate on validated
  incidents.
- **Posture score trend** — median customer posture score improvement over 6 months (target +20 pts).
- **Alerts triaged** — % of ingested alerts auto-triaged without human touch (target ≥ 85%).
- **Coverage** — monitored assets/endpoints per tenant (also the billing unit).
- **Net revenue retention** — target ≥ 115% via asset growth + tier upgrades.

## 8. Monetization & pricing

**Model:** recurring MRR = per-monitored-asset/endpoint fee within a tiered plan. Assets are the
natural unit of value and scale with the customer.

| Plan | Price | Included | Best for |
| --- | --- | --- | --- |
| **Essentials** | **$6 / asset / mo** (min 20 assets) | AI triage, posture score, email + Slack alerts, weekly report | Small businesses self-serving |
| **Managed** | **$12 / asset / mo** (min 50) | Essentials + ticketing integrations, custom suppression, posture trend history, monthly review | Growing SMBs wanting guidance |
| **MSP / vCISO** | **$9 / asset / mo** (volume, min 500 across clients) | Multi-tenant console, white-label reports, API access, priority support | MSPs & fractional CISOs |
| **Compliance add-on** | **+$3 / asset / mo** | Audit-ready evidence packs (SOC 2/HIPAA/PCI), insurer questionnaire export | Regulated / insured customers |

- Annual prepay = 2 months free. Onboarding/integration one-time fee for Managed+.
- Land-and-expand: revenue grows automatically as customers add endpoints; tier upgrades and the
  compliance add-on lift ARPU.
- Illustrative unit economics: a 120-endpoint Managed customer = ~$1,440 MRR / ~$17k ARR; an MSP with
  2,000 assets across clients = ~$18k MRR.

## 9. Go-to-market

1. **Wedge:** free posture assessment — connect read-only feeds, get a scored report in minutes. High
   perceived value, low friction, produces the "what do I fix first?" answer instantly.
2. **Channel-first:** recruit MSPs/vCISOs as resellers; they bring books of SMB clients and want a
   scalable tool. Revenue-share + white-label.
3. **Content & compliance hook:** SEO around "cyber-insurance requirements", "SOC 2 for startups",
   "MFA enforcement" — pair each with the assessment CTA.
4. **Integrations marketplace:** listings in CrowdStrike, SentinelOne, Microsoft, Okta, and Splunk
   marketplaces for distribution.
5. **Insurance partnerships:** co-sell with cyber-insurers who want insureds to demonstrate posture;
   posture score can influence premiums.

## 10. Competitive landscape

| Competitor | Positioning | Our differentiation |
| --- | --- | --- |
| **Arctic Wolf** | Human-led SOC + concierge; enterprise-priced, long contracts | AI-first triage at SMB price; transparent per-asset pricing; self-serve wedge |
| **Huntress** | SMB/MSP-focused MDR, strong EDR + human ThreatOps | AI triage across *all* signal types (not just endpoint) + explicit posture scoring & remediation planning |
| **Blumira** | SMB SIEM + detection, easy setup | We add AI triage verdicts + confidence + prioritized remediation, not just detections; MSP multi-tenancy |
| **SentinelOne** | EDR/XDR platform + Purple AI | We're vendor-neutral: ingest *their* signals and others; posture + remediation layer on top rather than a competing agent |

**Whitespace:** vendor-neutral, AI-first triage + posture + remediation, priced and packaged for SMBs
and the MSPs who serve them.

## 11. Risks & mitigations

- **False negatives (missed real threat) — liability.** *Mitigation:* human-in-the-loop for
  high-severity/low-confidence; conservative default to `needs_investigation`; never auto-close
  without review; contractual scope limits; recommend defense-in-depth, not sole reliance.
- **False positives / alert fatigue.** *Mitigation:* confidence scoring, tuned suppression, continuous
  precision/recall monitoring on validated incidents.
- **Data sensitivity.** Security telemetry is highly sensitive (credentials, internal topology).
  *Mitigation:* tenant isolation, encryption, least-privilege read-only feed scopes, PII minimization,
  data-residency options, SOC 2 / GDPR alignment, no training on customer data.
- **AI hallucination in remediation.** *Mitigation:* structured `generateObject` outputs constrained
  by schema; remediation drawn from vetted templates where possible; rationale + confidence surfaced;
  destructive actions require human confirmation.
- **Over-trust / automation bias.** *Mitigation:* explainability, "mock/AI" and confidence badges,
  analyst-review flags, clear docs that this augments (not replaces) judgment.
- **Liability & contracts.** *Mitigation:* clear SLAs, shared-responsibility model, insurance, and
  scoping that the platform is a defensive aid.

## 12. Out of scope

- **Any offensive / red-team capability:** exploit generation, penetration testing automation, C2,
  payload creation, phishing-campaign tooling, or detection-evasion guidance. **Explicitly prohibited.**
- Active automated response that takes destructive action without human confirmation (v1 recommends;
  it does not auto-isolate/auto-disable without opt-in and guardrails).
- Being the system of record for endpoints (we integrate with EDRs, we are not an EDR agent).
- Full GRC/compliance management suite (we produce evidence, not the whole program).
- Forensic malware reverse-engineering.

## 13. Milestones / roadmap

- **M0 — Scaffold (this repo):** AI triage engine (`generateObject` + zod), posture scoring, SOC
  dashboard, mock fallback, docs.
- **M1 — Real ingestion:** live EDR/SIEM/identity connectors + normalizer; persistence; alert
  lifecycle.
- **M2 — Alerting & workflow:** Slack + Jira/ServiceNow routing; suppression rules; per-alert case
  management.
- **M3 — Multi-tenancy & MSP console:** tenant isolation, white-label reports, RBAC, API access.
- **M4 — Posture trend & compliance:** historical scoring, evidence packs (SOC 2/HIPAA/PCI), insurer
  export.
- **M5 — Guarded auto-response:** opt-in containment actions with human confirmation and full audit.
- **M6 — Detection tuning loop:** feedback from analyst verdicts improves triage precision per tenant.
