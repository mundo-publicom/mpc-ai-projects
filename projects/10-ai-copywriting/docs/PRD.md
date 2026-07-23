# PRD — AI Copywriting Studio

## Overview

AI Copywriting Studio turns a reusable **brand-voice profile** plus a lightweight **brief** into
multiple **scored copy variants** across the formats marketers actually ship: Google/Meta ads,
cold and nurture email, landing-page sections, product descriptions, and headlines. Each variant
is generated around an explicit copywriting framework (AIDA, PAS, FAB, BAB, 4 Ps) and passed
through a critique/scoring stage that grades quality and flags brand-safety and plagiarism risk.
It is sold as a **credit-based SaaS**: users buy monthly credit bundles and spend credits per
generation.

## Problem

Producing high-converting marketing copy is slow, inconsistent, and hard to scale:

- **Volume tax.** Every campaign needs many variants per channel; writing them by hand is hours
  of work, and generic AI tools produce off-brand, samey output.
- **Brand drift.** Copy written by different people (or naive AI) wanders from the brand voice
  and occasionally uses banned words or claims, creating legal/brand-safety exposure.
- **No quality signal.** Teams ship variants with no objective read on which is strongest, so
  A/B tests waste spend on obviously weak copy.
- **Framework knowledge gap.** Proven persuasion structures exist, but most operators don't
  apply them deliberately or consistently.

## Target users & personas

1. **Priya — Performance Marketer (B2B SaaS).** Runs Google + Meta at scale. Needs *many* ad
   variants fast, keyword-relevant, within character limits, and wants a score to prioritize
   which to launch. Success = higher CTR/CVR per hour of copy work.
2. **Marco — Ecommerce Owner (DTC).** Runs a Shopify store, writes his own product descriptions
   and email. Not a copywriter. Needs on-brand copy that sounds like his store and never uses
   forbidden claims. Success = more PDP conversions and email revenue without hiring.
3. **Dana — Agency Copywriter.** Juggles many client brands. Needs to spin up copy in each
   client's distinct voice, generate options to present, and keep everything on-brand and
   safe. Success = more client output per retainer hour, fewer revisions.

## User stories

- As Priya, I can generate 5 Google RSA variants under the character limits, each scored, so I
  launch the top 3.
- As Priya, I can see which persuasion framework each variant uses so I learn what wins for my
  audience.
- As Marco, I can save my store's brand voice once and reuse it across every product.
- As Marco, I can list forbidden words/claims and trust that flagged copy never ships.
- As Dana, I can switch between client brand voices and generate on-brand options in seconds.
- As Dana, I can read a critique of each variant so I present only the strong ones to clients.
- As any user, I can copy a variant to my clipboard in one click.
- As any user, I can run the whole flow with no API key (mock engine) to evaluate the product.

## Functional requirements

1. **Brand-voice profiles.** Capture name, tone descriptors, audience, reading level, do-list,
   avoid-list, power words, forbidden words, and an on-brand writing sample.
2. **Brief.** Capture product/offer, audience, campaign goal, key benefits, proof points, CTA,
   keywords, and freeform constraints.
3. **Copy-type selection.** Support Google ad (RSA), Meta ad, cold email, nurture email, landing
   section, product description, and headline, each with format guidance.
4. **Variant count.** Generate 1–8 variants per run (UI exposes 1–6; API caps at 8).
5. **Generation pass.** Produce one draft per requested framework via `generateObject`, each
   structured around that framework's beats and obeying all brand-voice rules.
6. **Critique/scoring pass.** For each draft, return a 0-100 overall score plus sub-scores
   (clarity, persuasion, brand fit, brevity, CTA strength), a rationale, and suggestions.
7. **Brand-safety enforcement.** Every variant is checked for forbidden words and avoid-list
   violations; failures are flagged and the score is capped. Heuristic check is authoritative.
8. **Plagiarism risk.** Estimate low/medium/high risk from slogan/cliché proximity.
9. **Ranking.** Return variants sorted by overall score; mark the top one "Recommended".
10. **Copy to clipboard.** One-click copy of a fully assembled variant.
11. **Graceful fallback.** When no API key is present, or a model call fails, return
    deterministic mock variants with real heuristic scores — the request never errors out.
12. **Credit metering.** Report credits consumed per generation in the response metadata.
13. **Typed, validated I/O.** All request bodies validated with zod; all responses typed.

## Non-functional requirements

- **Runnable scaffold:** `pnpm dev` boots; core flow works with zero keys.
- **Performance:** typical 3-variant generation returns within a few seconds on Sonnet;
  mock path is instant.
- **Reliability:** no single model call can fail the request (layered fallback).
- **Type safety:** TypeScript strict; one zod schema per model drives validation, AI output,
  and UI types.
- **Security/privacy:** no secrets in the repo; keys via env; brand voice + brief are user data
  (see Risks).
- **Accessibility:** keyboard-usable forms, sufficient contrast, semantic structure.
- **Runtime:** Node.js (Fluid Compute); no edge-only APIs.

## Success metrics / KPIs

- **Copy acceptance rate** — % of generated variants a user copies/exports (target ≥ 40%).
- **CTR / conversion proxy** — average model+heuristic score of accepted variants, and (once the
  feedback loop ships) real CTR/CVR of shipped variants vs. baseline.
- **Credits per user / month** — usage depth and expansion signal (target ≥ 150 for paid users).
- **Time-to-first-copy** — from brief submit to a usable variant (target < 5s median).
- **Brand-safety catch rate** — % of forbidden-term violations flagged (target 100% on exact
  matches).
- **Activation** — % of new signups who complete a brand voice + first generation in session 1.

## Monetization & pricing (credits)

Credit-based SaaS. **2 credits per variant** (covers generation + critique). Suggested tiers:

| Plan | Price / mo | Credits / mo | ≈ variants | Extra credits |
| --- | --- | --- | --- | --- |
| Free | $0 | 40 | ~20 | — (mock engine unlimited) |
| Starter | $29 | 600 | ~300 | $6 / 100 |
| Growth | $79 | 2,000 | ~1,000 | $5 / 100 |
| Agency | $199 | 6,000 + 3 seats | ~3,000 | $4 / 100, add seats |

Credits reset monthly; top-ups roll over 30 days. Higher tiers unlock saved profiles, export
integrations, and team seats.

## Go-to-market

- **Wedge:** free, no-key mock demo + generous free tier → self-serve activation.
- **Channels:** SEO content ("Meta ad copy generator", "AIDA email template"), performance-
  marketing communities, Shopify App Store listing, agency partnerships/reseller.
- **Expansion:** land with one marketer, expand to team seats (Agency plan); export integrations
  create stickiness (copy lives in their ad/ESP stack).
- **Proof:** publish before/after CTR case studies from the feedback-loop data.

## Competitive landscape

- **Copy.ai** — broad templates, workflow automation. We differ on *scored, framework-explicit*
  variants and enforced brand-safety, not just volume.
- **Jasper** — enterprise brand voice + campaigns. We're leaner, credit-priced, and lead with a
  transparent critique/score per variant.
- **Anyword** — predictive performance scores. Closest on scoring; we add explicit frameworks,
  a two-pass critique with suggestions, and deterministic brand-safety guardrails.
- **Writesonic** — cheap high-volume generation. We compete on quality signal and brand fit
  rather than raw output count.

**Our edge:** framework-structured variants + a reconciled AI-plus-heuristic score + hard
brand-safety enforcement, all credit-priced and demoable with zero setup.

## Risks & mitigations

- **Brand safety / off-brand copy.** *Mitigation:* forbidden-words + avoid-list enforced by a
  deterministic check that overrides the AI; scores capped on failure; violations surfaced.
- **Plagiarism / trademark echo.** *Mitigation:* cliché/slogan heuristic now; integrate a real
  plagiarism/trademark API before enterprise GA; never present risky copy as safe.
- **Hallucinated claims/stats.** *Mitigation:* prompt forbids fabricated proof beyond supplied
  proof points; critique flags unsupported claims; human review encouraged.
- **Model cost/latency at scale.** *Mitigation:* Sonnet default with Haiku option; batch drafts
  in one call; credit pricing aligns cost to revenue.
- **Data privacy.** *Mitigation:* brand voice/brief treated as customer data; no training on
  user content; clear retention policy (roadmap: per-workspace isolation).
- **Model output shape drift.** *Mitigation:* strict zod schemas on `generateObject`; fallback
  to heuristic scoring if the critique pass returns malformed output.

## Out of scope (v1)

- Persistent storage / accounts / billing (mocked; Stripe + credit ledger on roadmap).
- Live ad-platform and ESP publishing (env placeholders only).
- Real plagiarism/trademark API integration.
- Image/creative generation, multi-language, long-form (blog) content.
- Team approval workflows and role-based access.

## Milestones / roadmap

1. **M0 — Scaffold (this repo).** Studio UI, 7 copy types, 5 frameworks, two-pass generation,
   heuristic guardrails, mock fallback.
2. **M1 — Persistence & billing.** Saved brand voices/briefs, credit ledger, Stripe checkout.
3. **M2 — Export & integrations.** CSV/asset export, Google Ads RSA push, Meta Marketing API,
   ESP sync.
4. **M3 — Feedback loop.** Import CTR/CVR, retrain scoring weights, "predicted performance".
5. **M4 — Teams & scale.** Workspaces, seats, approvals, real plagiarism API, multi-language.
