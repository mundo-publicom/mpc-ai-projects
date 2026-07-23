# PRD — AI Lead Generation

## Overview

AI Lead Generation turns a plain-English **Ideal Customer Profile (ICP)** into a prioritized,
ready-to-contact list of B2B leads. The operator describes who they want to sell to; the system
finds matching accounts, enriches company and contact data from multiple sources, scores each lead
for fit, prioritizes them, and drafts a personalized first-touch outreach opener for each. Leads
export to CRM or CSV in one click.

The product compresses the multi-tool, multi-hour workflow that SDRs and founders run today
(list-building in Apollo/ZoomInfo → enrichment in Clay → scoring in a spreadsheet → copywriting by
hand) into a single guided flow with AI doing the research, scoring, and first-draft copy.

## Problem

Outbound sales teams spend the majority of their time **not selling**. Industry benchmarks put SDR
time-on-research and list-building at 40–60% of the working day. The pain compounds:

- **Fragmented tooling.** Prospecting, enrichment, scoring, and copywriting live in 3–5 disconnected
  tools. Data is copy-pasted between them and goes stale.
- **Low-quality lists.** Buying raw contact lists yields high bounce rates and poor fit. Reps burn
  sender reputation on prospects who were never a match.
- **Generic outreach.** Under time pressure, reps send templated messages that convert poorly.
  Personalization is the single biggest lever on reply rate, and it is the first thing that gets cut.
- **No shared definition of "good."** "Fit" lives in a senior rep's head. Scoring is inconsistent,
  so prioritization is guesswork.

The result is a high **cost per qualified lead** and a low **lead-to-meeting rate**.

## Target users & personas

1. **Sasha — SDR / BDR (primary).** Owns a daily quota of qualified conversations. Wants a warm,
   scored list every morning and a personalized opener she can send in seconds. Success = more
   booked meetings per hour worked.
2. **Devin — Founder / founder-led seller (primary).** Runs sales themselves at an early-stage
   startup. Has no RevOps, no data budget for enterprise tools, and no time. Wants to type who they
   sell to and get a credible list with copy today.
3. **Mara — Agency owner (secondary).** Runs outbound for multiple clients. Needs to spin up a new
   ICP-driven campaign per client fast, keep data siloed per client, and prove ROI. Values
   per-seat and volume economics.

## User stories

1. As an SDR, I want to describe my ICP in plain English so I don't have to translate it into
   dozens of filter fields.
2. As an SDR, I want each lead scored 0–100 with a one-line reason so I can work the best-fit
   accounts first.
3. As an SDR, I want a personalized first-touch opener per lead so I can send outreach without
   rewriting from scratch.
4. As a founder, I want the tool to run with zero setup and show me sample leads immediately so I
   can evaluate it in under two minutes.
5. As a founder, I want to export leads to CSV so I can load them into whatever CRM I already use.
6. As an agency owner, I want to save an ICP as a reusable campaign so I can re-run it per client.
7. As an agency owner, I want to see how many credits a campaign consumed so I can bill the client.
8. As any user, I want verified vs. guessed email status flagged so I protect sender reputation.
9. As any user, I want exclusion rules (e.g. "no agencies") honored so bad-fit accounts are
   deprioritized automatically.
10. As a compliance-conscious buyer, I want a record of which source provided each data field so I
    can respond to a data-subject request.

## Functional requirements

1. **ICP capture.** Accept a free-text ICP plus optional structured fields: industries, company
   sizes, regions, target titles, buying signals, value proposition, exclusions.
2. **ICP parsing.** Use AI to normalize free-text ICP into structured fields when the operator
   leaves them blank (validated against a zod schema).
3. **Lead discovery.** Return N candidate accounts matching the ICP (N configurable, capped at 25
   per request in the sample tier).
4. **Enrichment.** For each candidate, attach company firmographics and a contact (name, title,
   email, LinkedIn) with an email-deliverability status and per-field source provenance.
5. **Scoring.** Produce a 0–100 fit score per lead with sub-scores (industry, size, title, signal)
   and a one-sentence rationale. AI scoring is reconciled against a deterministic rule-based scorer.
6. **Prioritization.** Sort leads by score descending; assign a band (hot/warm/cool/cold).
7. **Outreach generation.** Draft a personalized ≤40-word first-touch opener per lead referencing
   the account's context and the seller's value proposition.
8. **Export.** Export the working list to RFC-4180 CSV; provide CRM push (HubSpot/Salesforce) as a
   roadmap integration.
9. **Credit accounting.** Track credits consumed per generation (1 credit per enriched+scored lead).
10. **Graceful degradation.** With no AI/enrichment key configured, return realistic deterministic
    mock leads so the product is fully demoable.

## Non-functional requirements

- **Performance.** Sample generation (≤8 leads) returns in < 6 s p95 on the AI path; < 500 ms on the
  mock path.
- **Reliability.** A model or enrichment failure never fails the request — the system degrades to
  the deterministic path and flags it in the response metadata.
- **Type safety.** All API inputs/outputs validated with zod; TypeScript `strict`.
- **Privacy & compliance.** GDPR/CCPA data-subject support via per-field source provenance; CAN-SPAM
  and GDPR-compliant outreach (no purchased-list sending inside the product; unsubscribe handling is
  the sending tool's responsibility, documented in Risks).
- **Portability.** Runs on Node.js (Vercel Fluid Compute); no edge-only APIs.
- **Observability.** Structured logs on every generation with model, credits, and fallback status.

## Success metrics / KPIs

- **Lead-to-meeting rate** (north-star outcome): meetings booked ÷ leads contacted. Target: lift a
  customer's baseline by ≥ 30% within 60 days.
- **Cost per qualified lead (CPQL):** total spend (subscription + credits) ÷ qualified leads.
  Target: < $4 CPQL at the Growth tier, undercutting blended Apollo+Clay+manual workflows.
- **Time-to-first-list:** median time from signup to first exported list. Target: < 3 minutes.
- **Activation:** % of new accounts that generate and export ≥ 1 list in week one. Target: > 45%.
- **Reply rate on AI openers** vs. customer's prior templates. Target: +20% relative.
- **Net revenue retention.** Target: > 110% via credit expansion + tier upgrades.

## Monetization & pricing

Hybrid model: a **monthly SaaS subscription** for seats and features, plus **per-lead credits** for
enrichment/scoring volume. One credit = one fully enriched + scored + written lead.

| Tier | Price / mo | Included credits / mo | Overage / credit | Seats | Key features |
|------|-----------:|----------------------:|-----------------:|------:|--------------|
| **Free** | $0 | 50 | — | 1 | CSV export, mock + limited live enrichment |
| **Starter** | $49 | 1,000 | $0.05 | 1 | Full enrichment, AI scoring + openers, CSV |
| **Growth** | $199 | 6,000 | $0.035 | 5 | + CRM sync (HubSpot/Salesforce), saved campaigns, team sharing |
| **Scale** | $699 | 30,000 | $0.02 | 20 | + API access, priority enrichment, custom scoring weights, SSO |
| **Agency** | Custom | Pooled | Volume | Unlimited | Client workspaces, white-label export, usage-based billing passthrough |

Credit packs (top-ups) sold à la carte: 1,000 credits = $40; 10,000 = $300. Gross margin target on
credits ≥ 70% after enrichment COGS.

Unit-economics logic: at Growth, $199 + 6,000 credits supports roughly 6,000 enriched leads. If a
customer converts even 1% of contacted leads to meetings and closes standard B2B deal sizes, CPQL
sits well under the value of a single won deal — the ROI story sells itself.

## Go-to-market

- **Wedge:** founder-led sellers and 1–5 person SDR teams priced out of ZoomInfo/enterprise Clay
  setups. Land with the free tier's instant sample list (zero-key demo removes signup friction).
- **PLG loop:** free ICP → sample list → CSV export → paywall on volume/CRM sync. In-product credit
  meter drives natural upgrade prompts.
- **Content & SEO:** ICP templates by industry, "cost per qualified lead" calculators, outreach
  swipe files — all indexable and gated on signup.
- **Partnerships:** integrations marketplace listings (HubSpot, Instantly, Smartlead) for
  co-marketing and inbound.
- **Sales-assist** for Scale/Agency: outbound to agencies and RevOps leaders with pooled-credit
  economics.

## Competitive landscape

| Competitor | Strength | Gap we exploit |
|-----------|----------|----------------|
| **Apollo** | Huge contact database, low entry price | Weak native scoring + no AI-written personalized copy tied to fit; workflow still manual |
| **Clay** | Powerful enrichment waterfalls, flexible | Steep learning curve, expensive credits, requires building tables yourself; not turnkey |
| **Instantly** | Great sending + deliverability | Thin on lead discovery/scoring; you bring the list |
| **ZoomInfo** | Enterprise-grade data, intent signals | Expensive, long contracts, overkill for SMB/founders; poor time-to-value |

Our position: **turnkey ICP-to-outreach** — the scoring + personalized copy layer that sits on top
of enrichment, priced for SMB, with a zero-friction start. We integrate with senders (Instantly,
Smartlead) rather than compete on deliverability.

## Risks & mitigations

- **Compliance / GDPR & CCPA.** Processing personal data of EU/CA subjects. *Mitigation:* per-field
  source provenance for data-subject access/erasure; DPA with enrichment vendors; honor opt-out and
  suppression lists; store lawful-basis metadata (legitimate interest for B2B contact). Provide a
  data-deletion endpoint on the roadmap.
- **CAN-SPAM & anti-spam law.** The product drafts outreach but should not become a spam cannon.
  *Mitigation:* the product does not send email itself in the MVP — it hands copy to the user's
  compliant sending tool. Guidance surfaced in-app: require accurate sender identity, physical
  address, and one-click unsubscribe in the sending layer. Rate/quality guardrails on copy.
- **Data accuracy / bounce risk.** Guessed emails hurt sender reputation. *Mitigation:* explicit
  verified/guessed/unknown status; recommend verification before send; roadmap verification step.
- **AI hallucination.** Model could fabricate firmographics or inflate scores. *Mitigation:* AI only
  scores and writes copy — factual contact fields come from enrichment; scores reconciled against a
  deterministic rule-based scorer; openers constrained to avoid fabricated claims.
- **Enrichment COGS volatility.** Vendor pricing changes squeeze margin. *Mitigation:* multi-vendor
  waterfall, caching, and credit pricing with headroom.
- **Platform dependence.** Reliance on a single enrichment vendor. *Mitigation:* pluggable
  `EnrichmentSource` abstraction supporting multiple providers.

## Out of scope (MVP)

- Sending email/LinkedIn messages or managing sequences (we integrate with senders, not replace
  them).
- Intent-data / buyer-signal purchasing from third-party intent networks.
- Full CRM two-way sync (MVP is one-way export/push).
- Multi-language outreach generation.
- Phone/dialer and call features.

## Milestones / roadmap

- **M0 — Scaffold (this repo).** ICP form, mock + AI generation path, scoring, CSV export, dashboard.
- **M1 — Live enrichment.** Wire Apollo/Clearbit/Hunter behind the `EnrichmentSource` interface;
  real email verification.
- **M2 — Campaigns & persistence.** Saved ICPs/campaigns, credit ledger, auth, team workspaces.
- **M3 — CRM sync.** One-way push to HubSpot & Salesforce; field mapping.
- **M4 — Sender integrations.** Push lists + openers into Instantly/Smartlead.
- **M5 — Custom scoring & API.** Per-account scoring weights, public API, SSO for Scale/Agency.
- **M6 — Compliance suite.** Data-deletion endpoint, suppression lists, DPA tooling, audit exports.
