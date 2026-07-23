# Managed AI Cybersecurity

**A strictly defensive (blue-team) managed detection & response platform for SMBs.** It ingests the
security signals a business already produces (EDR, SIEM, firewall, identity, cloud, email), uses AI to
**triage every alert** — severity, likely true/false positive, MITRE ATT&CK mapping, and rationale —
continuously **scores security posture**, and produces a **prioritized, plain-language remediation
plan**. No offensive tooling of any kind.

## Business case

**Who pays:** small and mid-sized businesses without a SOC, and the MSPs / vCISOs who protect them on
their behalf. **For what:** SOC-grade alert triage, a trending security-posture score, and clear
"fix this first" guidance — without hiring $90k–$150k analysts. **Pricing:** recurring MRR on a
**per-monitored-asset/endpoint** basis inside tiered plans:

| Plan | Price | For |
| --- | --- | --- |
| Essentials | **$6 / asset / mo** (min 20) | Small businesses self-serving |
| Managed | **$12 / asset / mo** (min 50) | Growing SMBs wanting guidance |
| MSP / vCISO | **$9 / asset / mo** (volume, min 500) | MSPs & fractional CISOs (multi-tenant, white-label) |
| Compliance add-on | **+$3 / asset / mo** | SOC 2 / HIPAA / PCI evidence + insurer exports |

Revenue grows automatically as customers add endpoints (land-and-expand); the compliance add-on and
tier upgrades lift ARPU. A 120-endpoint Managed customer ≈ **$1,440 MRR**; a 2,000-asset MSP book ≈
**$18k MRR**. Full detail in [`docs/PRD.md`](docs/PRD.md).

## Features

- **AI alert triage** — structured verdict per alert (severity, true/false-positive, confidence,
  MITRE ATT&CK technique, analyst rationale, ordered defensive remediation) via the Vercel AI SDK
  `generateObject` + zod. Falls back to a deterministic mock engine when no key is set.
- **Security posture score** — transparent, reproducible 0–100 score + letter grade from weighted
  findings, with per-category breakdown, severity histogram, and trend delta.
- **Prioritized remediation** — environment-wide plan ranked by severity × blast radius × effort, plus
  per-alert containment/hardening steps.
- **SOC dashboard** — posture gauge, KPI tiles (alerts triaged, critical/high, false-positive rate,
  awaiting review), a live triaged alert feed with color-coded severity + ATT&CK tags, and a
  remediation panel.
- **Human-in-the-loop** — high-severity / low-confidence alerts are flagged for analyst review and
  never silently auto-closed.
- **Zero-key demo** — realistic seed environment (assets, alerts, findings) runs the full experience
  with no configuration.

## Why defensive-only

This platform exists to *defend*. The AI system prompt pins a blue-team SOC-analyst role and refuses
offensive requests; remediation output is limited to containment, investigation, and hardening. There
is no exploit generation, pen-test automation, C2, or detection-evasion capability — see
[`docs/PRD.md` §12 Out of scope](docs/PRD.md).

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # optional — the demo runs with zero keys
pnpm dev                     # http://localhost:3000
```

- **No keys:** the dashboard triages the seed alert feed with the deterministic mock engine and scores
  the demo environment — fully functional.
- **With AI:** set `AI_GATEWAY_API_KEY` (or `ANTHROPIC_API_KEY`) in `.env.local` to route real triage
  through `anthropic/claude-sonnet-5` via the Vercel AI Gateway.

### Try the API

```bash
# Triage a raw alert
curl -s localhost:3000/api/triage -H 'content-type: application/json' -d '{
  "source": "identity",
  "title": "Multiple failed logins then success",
  "description": "42 failed sign-ins from one IP over 6 minutes, then a success. Possible brute force.",
  "reportedSeverity": "medium"
}' | jq

# Score the demo environment
curl -s localhost:3000/api/posture | jq

# Score arbitrary findings
curl -s localhost:3000/api/posture -H 'content-type: application/json' -d '{
  "findings": [
    { "id": "f1", "category": "identity", "title": "MFA missing for admins", "severity": "critical", "affectedAssetIds": ["a1"], "resolved": false }
  ]
}' | jq
```

## Project layout

```
app/
  page.tsx                 # SOC dashboard (posture gauge + alert feed + remediation panel)
  api/triage/route.ts      # AI triage (generateObject + zod) with mock fallback
  api/posture/route.ts     # posture scoring + remediation plan
components/                # PostureGauge, AlertFeed, TriageCard, RemediationPanel
lib/
  ai.ts                    # model catalog, triage schema/prompt, mock triage engine
  types.ts                 # canonical domain types
  posture.ts               # deterministic posture scoring + remediation prioritization
  ui.ts                    # severity/verdict presentational helpers
  mock-data.ts             # realistic seed assets, alerts, findings
docs/                      # PRD, TECHNICAL_SPEC, ARCHITECTURE
```

## Tech

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS · Vercel AI SDK v5 (`generateObject`,
`"provider/model"` via AI Gateway) · zod · Node.js runtime (Fluid Compute).

## Roadmap

- **M1** Live EDR/SIEM/identity connectors + normalizer + persistence.
- **M2** Slack + Jira/ServiceNow routing; tuned suppression; case management.
- **M3** Multi-tenancy + MSP white-label console + RBAC + API access.
- **M4** Posture trend history + compliance evidence packs (SOC 2 / HIPAA / PCI) + insurer export.
- **M5** Opt-in guarded auto-response (human-confirmed containment, full audit).
- **M6** Per-tenant detection-tuning loop from analyst verdict feedback.

See [`docs/PRD.md`](docs/PRD.md) for personas, KPIs, competitive landscape, and risks;
[`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for design.
