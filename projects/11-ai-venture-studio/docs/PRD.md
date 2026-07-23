# PRD — AI Venture Studio

## Overview

AI Venture Studio is an idea-to-MVP pipeline operated as a studio. A user
submits a startup idea; the system runs an AI-driven validation sprint and
returns a complete, structured report: a viability score, market/TAM sizing with
explicit assumptions, a competitor scan, customer segments, a Lean Canvas, an MVP
feature spec, a risk register, and landing-page copy. The studio spins up many
ventures through the same pipeline and keeps equity or revenue-share in the ones
worth building.

The commercial model has two legs: **productized validation sprints** (fee per
idea) fund operations, and an **equity/revenue-share portfolio** of spun-out
ventures provides the upside.

## Problem

Validating a startup idea well is slow, expensive, and inconsistent. Founders
either skip validation (and build the wrong thing) or spend weeks on desk
research, competitor spreadsheets, and TAM guesswork of uneven quality. Venture
studios face the same problem at scale: their bottleneck is throughput of
*rigorous* validation, not idea supply. There is no fast, repeatable, defensible
way to take an idea from a sentence to a decision-grade validation report.

## Target users & personas

- **Aspiring founder (Maya).** Has an idea and a day job. Wants a credible,
  fast read on whether to pursue it before quitting or raising. Values honesty
  over hype and a concrete MVP plan she can act on.
- **Studio operator (Dev).** Runs the studio's pipeline. Screens dozens of ideas
  per month, needs consistent scoring to compare them, and cares about sprint
  throughput and downstream venture survival rate.
- **Intrapreneur (Priya).** Leads new-product exploration inside a larger
  company. Needs board-ready validation artifacts (TAM, competitors, risks,
  Lean Canvas) to justify budget for an internal venture.

## User stories

1. As a founder, I can submit an idea description and receive a full validation
   report in one pass.
2. As a founder, I can see a viability score with a plain-English verdict and a
   pursue/investigate/pivot/pass recommendation.
3. As a founder, I can read the TAM/SAM/SOM sizing **and the assumptions behind
   it**, so I can judge whether I trust the numbers.
4. As a founder, I can see a competitor table (direct/indirect/substitute) with
   strengths, weaknesses, and price positioning.
5. As a founder, I get a Lean Canvas laid out in the canonical grid.
6. As a founder, I get an MVP feature spec with MoSCoW priorities, effort
   estimates, and user stories I can hand to a builder.
7. As a founder, I get draft landing-page copy to test demand quickly.
8. As a studio operator, I can run many ideas and see them accumulate in a
   pipeline with comparable scores.
9. As any user, the product works end-to-end even without an AI key (mock mode).

## Functional requirements

1. **FR-1 Idea intake.** Accept `title`, `description` (min 20 chars), optional
   `market` and `businessModel`. Validate with zod; reject invalid input with a
   422 and field-level errors.
2. **FR-2 Validation generation.** Produce a `ValidationReport` covering score,
   verdict, recommendation, market analysis, competitors, segments, Lean Canvas,
   MVP spec, risks, and landing copy — in a single structured generation call.
3. **FR-3 Structured output.** All AI output conforms to a zod schema
   (`generateObject`); malformed output is rejected by the schema.
4. **FR-4 Scoring.** Overall score 0–100, discriminating (most ideas 40–70),
   mapped deterministically to a recommendation (pursue ≥75, investigate 55–74,
   pivot 35–54, pass <35).
5. **FR-5 Market sizing.** TAM/SAM/SOM each carry a raw value, display string,
   and a stated derivation basis; the report lists explicit assumptions.
6. **FR-6 Lean Canvas.** All nine blocks populated and rendered in the canonical
   grid layout.
7. **FR-7 MVP spec.** 3–10 features with MoSCoW priority, effort in
   engineer-days, and a user story each; plus riskiest-assumption, success
   metrics, and a build estimate.
8. **FR-8 Report view.** Dashboard renders score gauge, TAM cards, competitor
   table, segments, Lean Canvas grid, MVP checklist, risk register, landing copy.
9. **FR-9 Pipeline.** Validated ventures accumulate in a session pipeline list
   with title, score, and recommendation.
10. **FR-10 Graceful fallback.** With no AI key, serve deterministic idea-aware
    mock reports; on model error, degrade to mock rather than failing.

## Non-functional requirements

- **NFR-1 Type safety.** TypeScript `strict`; shared domain types in `lib/`.
- **NFR-2 Input validation.** Every API input validated with zod.
- **NFR-3 Performance.** Mock path responds < 100 ms; real path within the
  route's 60 s `maxDuration` budget.
- **NFR-4 Resilience.** No sprint fails outright — model errors fall back to mock
  with an `x-fallback-reason` header.
- **NFR-5 Portability.** Node.js runtime, no edge-only APIs; deployable on Vercel
  Fluid Compute.
- **NFR-6 Accessibility.** Semantic HTML, labelled controls, wide tables/canvas
  scroll within their own containers (no page-level horizontal scroll).
- **NFR-7 No secrets in repo.** Keys only via env.

## Success metrics / KPIs

- **Ideas validated** — sprints completed (activation of the core value prop).
- **Sprint throughput** — validated ideas per operator per week.
- **Venture survival rate** — % of spun-out ventures still active at 6/12 months.
- Supporting: report-view completion rate, sprint→spin-out conversion,
  self-serve→assisted upgrade rate, model fallback rate.

## Monetization & pricing

Two-leg model:

**1. Validation sprints (services revenue).**

| Tier                  | Price            | What's included                                          |
| --------------------- | ---------------- | -------------------------------------------------------- |
| Self-serve sprint     | $49 / idea       | Full automated validation report.                        |
| Pro (subscription)    | $199 / mo        | 10 sprints/mo, saved pipeline, exports.                  |
| Operator-reviewed     | $1,500 / sprint  | Automated report + human analyst review & interviews.    |
| Studio (team)         | from $2k / mo    | Multi-seat workspace, unlimited sprints, analytics.      |

**2. Equity / revenue-share (portfolio upside).**

Ventures spun out of the pipeline grant the studio **5–15% equity** or a
**3–8% revenue-share** (structure negotiated per venture; sprint fees may be
credited toward the deal). The sprint funnel is the top of the portfolio funnel;
the equity book is where the studio's enterprise value compounds.

## Go-to-market

- **Content-led / SEO** — publish sample validation reports for trending idea
  spaces; each report is a shareable artifact and a lead magnet.
- **Founder communities** — indie hackers, accelerator alumni, build-in-public.
- **Operator wedge** — sell the Studio tier to existing incubators/accelerators
  who need higher validation throughput.
- **Free mock demo** — the zero-key demo removes activation friction; upgrade to
  real reports and human review.

## Competitive landscape

- **AI startup validators** (e.g. idea-validation GPTs, "validate my startup"
  tools). Strength: cheap, instant. Weakness: shallow, generic output, no
  Lean Canvas/MVP depth, no studio workflow or portfolio model. Our wedge:
  schema-grounded, decision-grade multi-section reports + a studio pipeline.
- **Traditional venture studios / incubators.** Strength: hands-on, capital,
  network. Weakness: expensive, low throughput, subjective screening. Our wedge:
  10x cheaper, consistent scoring, and far higher idea throughput before human
  time is spent.
- **DIY (spreadsheets, decks, manual desk research).** Strength: free, flexible.
  Weakness: slow, inconsistent, error-prone. Our wedge: minutes not weeks, and a
  repeatable rubric.

## Risks & mitigations

- **AI sizing/quality is wrong or over-confident.** Mitigation: force explicit
  assumptions and a derivation basis for every number; discriminating scoring
  rubric; roadmap toward grounded market-data integration and human review tier.
- **Commoditization by general LLM chat.** Mitigation: depth (nine-block canvas,
  MVP spec, risk register), studio workflow, and the portfolio flywheel — not a
  single prompt.
- **Equity deals are legally/operationally heavy.** Mitigation: start with
  standardized terms; sprint-fee revenue stands alone regardless of equity.
- **Model cost/latency.** Mitigation: tiered models (frontier for depth, smart
  for cost), single-call generation, caching of common idea spaces (roadmap).
- **GTM: trust.** Mitigation: transparent assumptions, mock demo, and published
  example reports build credibility before purchase.

## Out of scope (v1)

- Persistent multi-user accounts and billing.
- Live third-party market-data grounding (stubbed; roadmap).
- Auto-deploying real landing pages / waitlists.
- Cap-table / equity-agreement management.
- Team collaboration, comments, and section-level editing.

## Milestones / roadmap

- **M1 (this scaffold).** Idea intake → single-call structured validation report
  → dashboard render → mock fallback. Runnable end-to-end.
- **M2.** Persistence (DB), multi-user studio workspaces, saved pipeline.
- **M3.** Live market-data grounding for TAM; section-level regeneration + edits.
- **M4.** One-click landing-page + waitlist deploy per venture.
- **M5.** Portfolio analytics (survival rate, throughput) and equity-deal
  tooling.
