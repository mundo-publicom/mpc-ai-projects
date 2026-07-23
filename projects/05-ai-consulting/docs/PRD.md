# PRD — AI Consulting (Productized)

## Overview

A platform that productizes AI consulting. A client (or the consultant on their behalf) completes a
structured intake describing the company's processes, tech stack, goals, and budget. The system then
generates an **AI-Readiness Audit**: an overall readiness score with a six-dimension breakdown, an
opportunity map, a prioritized use-case backlog with ROI estimates, and a phased implementation
roadmap. The same artifact serves as the sales collateral that wins the engagement, the delivery
document that fulfills it, and the client-facing portal that hosts it.

The wedge: turn a bespoke, weeks-long, expert-dependent deliverable into a repeatable product that
takes minutes to draft and is standardized enough to scale, while keeping the economics defensible
(ROI is computed from the client's own numbers, not invented by a model).

## Problem

- **Consulting doesn't scale.** Senior consultant time is the bottleneck; every audit is rebuilt from
  scratch, so margins are thin and turnaround is slow (2–6 weeks is common).
- **Inconsistent quality.** Output depends on which consultant ran it; there's no shared method,
  scoring rubric, or ROI model.
- **Buyers can't compare.** SMBs receive dense slide decks with hand-waved ROI and no clear "do this
  first" sequencing, making it hard to say yes.
- **Weak fulfillment loop.** The winning proposal and the delivered work live in different tools, so
  there's no single portal that carries a client from audit → roadmap → implementation → re-audit.

## Target users & personas

1. **Independent AI consultant ("Sam").** Solo operator or fractional CTO. Sells 2–5 audits/month,
   wants to 3× throughput without hiring. Values speed, a credible ROI model, and a branded artifact.
   Pain: spends nights rebuilding decks.
2. **Boutique agency ("Nova AI Partners").** 5–20 person shop. Needs standardization across
   consultants, multi-client management, and a portal clients log into. Pain: quality variance and
   onboarding new consultants to "the method."
3. **SMB buyer ("Jordan," Ops/GM at a 50–200-person company").** Not technical, has a budget and a
   backlog of frustrations. Wants a clear, prioritized plan with numbers they can take to their CEO.
   Pain: doesn't know where AI actually helps or what it will cost.

## User stories

- As **Sam**, I complete a client's intake and get a full draft audit in minutes so I can spend my
  time on judgment and relationship, not formatting.
- As **Sam**, I trust the ROI figures because they're computed from the client's stated hours and
  costs, and I can explain exactly how each number was derived.
- As **Nova**, every consultant produces audits with the same scoring rubric and structure, so
  quality is consistent and new hires ramp fast.
- As **Nova**, I manage many clients and their deliverables from one dashboard and give each client
  portal access.
- As **Jordan**, I see a readiness score, a plain-language executive summary, a prioritized backlog
  with payback periods, and a phased roadmap — so I can approve a first phase with confidence.
- As **Jordan**, I can book a readout call and later see implementation progress in the same portal.

## Functional requirements

1. **Intake capture.** Collect client profile (name, industry, size, contact) and intake (goals,
   pain points, tech stack, AI maturity, data readiness, annual budget, notes) plus a list of key
   **processes** with hours/week, headcount, blended hourly cost, and repetitiveness.
2. **Audit generation.** `POST /api/audit/generate` accepts the intake and returns a structured
   audit via AI (`generateObject` + zod). The AI supplies readiness scoring, the use-case backlog
   (impact/effort/risk ratings, categories, approaches), and roadmap sequencing.
3. **Deterministic ROI.** Every dollar figure — implementation cost, annual run cost, annual net
   benefit, payback months, first-year ROI — is computed in `lib/roi.ts` from intake numbers, never
   from the model. Portfolio ROI aggregates the backlog.
4. **Prioritization.** The backlog is ranked by a transparent score blending impact, ROI, effort,
   and risk; each opportunity is classified into a 2×2 quadrant (quick-win / big-bet / fill-in /
   deprioritize).
5. **Readiness scoring.** Six dimensions (strategy, data, technology, talent, process, governance),
   each 0–100 with a rationale, plus an overall score and band (nascent → advanced).
6. **Report view.** Render readiness gauge, dimension bars, opportunity matrix, prioritized backlog
   table, strengths/gaps, roadmap timeline, and portfolio ROI.
7. **Graceful fallback.** With no AI key, the endpoint returns a coherent, client-specific mock audit
   so the product is fully demoable offline.
8. **Deliverables model.** Audits and their sub-artifacts (readiness audit, opportunity map, backlog,
   roadmap, ROI model, proposal) are represented as `Deliverable` records with status
   (draft → in-review → delivered → accepted). *(scaffold: typed; persistence in v0.2.)*
9. **Export.** Deliverables can be exported to branded PDF. *(integration hook in v0.2.)*
10. **Monetization hooks.** Fixed-price package checkout and monthly retainer subscriptions via
    Stripe; scheduling for readouts. *(env + typed hooks; wired in v0.3.)*

## Non-functional requirements

- **Performance.** Audit generation returns within ~30s (single `generateObject` call); mock path is
  effectively instant.
- **Reliability.** AI errors never fail the request — the route degrades to the deterministic mock.
- **Type safety.** TypeScript `strict`; one zod schema validates API input, structures AI output, and
  types the UI.
- **Security & privacy.** Client business data is sensitive; see TECHNICAL_SPEC. No secrets in the
  repo; all keys via env.
- **Portability.** Node.js runtime (Fluid Compute), no edge-only APIs.
- **Accessibility.** Semantic form controls, labels, and sufficient contrast.

## Success metrics / KPIs

- **Audit turnaround time** — median time from intake submitted to draft audit ready (target: < 5 min
  drafting; < 24h consultant-reviewed vs. 2–6 week baseline).
- **Proposal win rate** — % of generated audits that convert to a paid engagement (target: > 35%).
- **Retainer conversion** — % of one-off audit clients who convert to a monthly retainer
  (target: > 25%).
- **Audits per consultant per month** — throughput (target: 3× the manual baseline).
- **ROI credibility** — % of clients who accept the ROI model without dispute (proxy: acceptance
  sign-offs).

## Monetization & pricing

**Buyer of the platform:** consultants/agencies (SaaS + usage). **End payer of engagements:** SMB
clients, billed by the consultant.

Audit packages (fixed price, billed by consultant to client):

| Package | Price | Includes |
| --- | --- | --- |
| Starter Audit | $2,500 | Readiness audit, top-5 opportunity map, ROI model |
| Growth Audit | $7,500 | Full backlog, roadmap, exec readout, proposal deck |
| Enterprise Audit | $15,000 | Multi-department, governance review, board-ready pack |
| Retainer | $3k–$12k/mo | Implementation, portal access, quarterly re-audit |

Platform pricing (agency → us): per-seat SaaS (e.g. $99/consultant/mo) + usage-based audit credits.

## Go-to-market

- **Beachhead:** independent AI consultants and fractional CTOs who already sell audits manually —
  sell them 3× throughput.
- **Channels:** consultant communities (Slack/Discord, LinkedIn), fractional-exec networks, and a
  free "AI-Readiness score" lead magnet that upsells into a full audit.
- **Land-and-expand:** solo consultant → boutique agency team seats → white-labeled portal.
- **Content:** publish the scoring rubric and ROI methodology as a credibility anchor.

## Competitive landscape

- **Boutique AI consultancies** — deliver bespoke work; high quality, no productization, expensive
  and slow. We compete on speed/standardization, and many are *customers*, not just competitors.
- **Big-4 / large SI AI offerings** (Deloitte, Accenture, McKinsey QuantumBlack) — enterprise-grade,
  six-figure engagements. We serve the underserved SMB/mid-market below their minimums.
- **Generic AI strategy templates / GPT prompts** — cheap but unstructured, no ROI math, no portal.
- **Horizontal proposal tools** (PandaDoc, Qwilr) — document polish without the AI domain method or
  ROI engine.

Our edge: a repeatable method + defensible ROI + delivery portal, purpose-built for AI adoption at
SMB/mid-market scale.

## Risks & mitigations

- **Hallucinated ROI erodes trust.** → ROI is computed deterministically from client inputs; the AI
  never emits dollar figures. Confidence levels are surfaced.
- **Generic, non-actionable output.** → Prompt grounds every opportunity in the client's named
  processes and actual stack; backlog demands concrete approaches.
- **Client data sensitivity.** → Minimize collection, encrypt at rest, per-client isolation, clear
  retention/deletion; no training on client data.
- **Consultant sees it as a threat, not a tool.** → Position as leverage (3× throughput), keep the
  human in the loop for review and relationship.
- **Model/provider variance & cost.** → Route via AI Gateway (swap models), single call per audit,
  cache-friendly structure.

## Out of scope (v0.1)

- Actual implementation/build of the recommended AI solutions.
- Live data-source connectors / automated stack discovery (intake is manual).
- Multi-user auth, roles, and persistence (typed models exist; DB comes later).
- Real PDF export, Stripe checkout, and scheduling (env + hooks only).
- Benchmarking against a cohort dataset.

## Milestones / roadmap

- **v0.1 (this scaffold):** intake → AI audit → report view; deterministic ROI; mock fallback.
- **v0.2:** Postgres persistence, multi-client dashboard, PDF export of deliverables.
- **v0.3:** Stripe checkout (packages + retainers), scheduling for readouts.
- **v0.4:** client portal auth, deliverable versioning, acceptance sign-off.
- **v0.5:** cohort benchmarking, re-audit deltas over time.
