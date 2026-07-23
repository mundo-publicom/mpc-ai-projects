# AI Lead Generation

> **Business case.** B2B sales teams pay to stop wasting 40–60% of their day on list-building,
> enrichment, and copywriting. This product turns a plain-English Ideal Customer Profile into a
> prioritized, scored, ready-to-contact lead list with an AI-written first-touch opener for each —
> then exports to CRM/CSV. **Who pays:** SDRs, founder-led sellers, and outbound agencies. **For
> what:** qualified, enriched leads and personalized outreach. **Pricing:** hybrid — a monthly SaaS
> subscription for seats/features plus per-lead credits for enrichment volume (Free → $49 Starter →
> $199 Growth → $699 Scale → custom Agency; 1 credit = 1 enriched + scored + written lead). The
> north-star metrics are **lead-to-meeting rate** and **cost per qualified lead**.

## What it does

1. **Define an ICP** in plain English (plus optional industries, sizes, regions, titles, buying
   signals, value proposition, exclusions).
2. **Find & enrich** matching B2B accounts and contacts (email + deliverability status + source
   provenance).
3. **Score & prioritize** each lead 0–100 with transparent sub-scores and a one-line rationale.
4. **Write outreach** — a personalized ≤40-word first-touch opener per lead.
5. **Export** the list to CSV (CRM push on the roadmap).

## Features

- Plain-English ICP capture with structured overrides.
- AI scoring + personalized openers via the Vercel AI SDK (`generateObject`, zod-validated,
  `anthropic/claude-sonnet-5`).
- Deterministic rule-based scorer that reconciles/clamps AI output so scores stay explainable.
- **Zero-key demo:** with no API key set, the app returns realistic mock leads end-to-end.
- One batched model call per generation for cost control; hot/warm/cool/cold prioritization.
- RFC-4180 CSV export; typed, zod-validated API surface throughout.
- Compliance-minded design: per-field enrichment provenance for GDPR/CCPA; drafts copy but doesn't
  send (CAN-SPAM boundary documented).

## Quickstart

```bash
# from the monorepo root (pnpm workspaces)
pnpm install

# run this project
pnpm --filter @mmai/ai-lead-generation dev
# → http://localhost:3000
```

The app runs immediately with **no keys** (deterministic mock leads). To enable the AI path:

```bash
cp projects/02-ai-lead-generation/.env.example projects/02-ai-lead-generation/.env.local
# set AI_GATEWAY_API_KEY (or ANTHROPIC_API_KEY)
```

Scripts: `dev`, `build`, `start`, `lint`, `typecheck`.

### Try the API directly

```bash
curl -s http://localhost:3000/api/leads/generate \
  -H 'content-type: application/json' \
  -d '{"icp":{"description":"Series A SaaS in North America","industries":["SaaS"],"companySizes":["51-200"],"regions":["North America"],"targetTitles":["VP of Sales"],"buyingSignals":["hiring SDRs"],"valueProposition":"cut cost per qualified lead","exclusions":["agencies"]},"count":5}'
```

## Project layout

```
app/                       Dashboard + API routes
  api/leads/generate       Enrich + score + write outreach (AI or mock)
  api/leads/export         CSV download
components/                IcpForm, LeadsTable
lib/                       types (zod) · ai · scoring · leads (orchestration) · mock · csv
docs/                      PRD.md · TECHNICAL_SPEC.md · ARCHITECTURE.md
```

## How the AI is used

A single `generateObject` call (`anthropic/claude-sonnet-5`, temperature 0.4) scores the whole
candidate batch against the ICP and drafts a personalized opener per lead, filling a zod schema. The
model only does judgement + copy — factual contact fields come from enrichment, and its scores are
reconciled against a deterministic scorer so a hallucinated score can't win. If no key is present or
the call fails, the request degrades to the deterministic path and flags it in the response `meta`.

## Roadmap

- **M1** Live enrichment (Apollo/Clearbit/Hunter) + email verification behind the `EnrichmentSource`
  interface.
- **M2** Saved campaigns, credit ledger, auth, team workspaces.
- **M3** One-way CRM sync (HubSpot, Salesforce).
- **M4** Sender integrations (Instantly, Smartlead).
- **M5** Custom scoring weights, public API, SSO.
- **M6** Compliance suite: data-deletion endpoint, suppression lists, audit exports.

See [`docs/PRD.md`](docs/PRD.md), [`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md), and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full product and system detail.
