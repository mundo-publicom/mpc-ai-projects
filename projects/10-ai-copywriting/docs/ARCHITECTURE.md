# Architecture — AI Copywriting Studio

## System diagram

```mermaid
flowchart TD
  subgraph Client["Browser — Studio (app/page.tsx)"]
    BVF[BrandVoiceForm]
    BF[BriefForm]
    CTS[Copy-type selector + count]
    VC[VariantCard grid]
  end

  subgraph Server["Next.js API (Node.js runtime)"]
    R[/POST /api/copy/generate/]
    V{zod validate}
    K{hasAI?}
    G1[Pass 1: generate drafts\ngenerateObject @ temp 0.8]
    G2[Pass 2: critique + score\ngenerateObject @ temp 0.2]
    H[Heuristic critique\nlib/mock.ts]
    RC[reconcileCritique\nblend + safety override]
    RK[rank by score]
    M[Mock engine\nbuildMockVariants]
  end

  subgraph Lib["lib/"]
    AI[ai.ts — MODELS, prompts]
    TY[types.ts — zod models]
    FW[frameworks.ts — AIDA/PAS/FAB/BAB/4Ps]
    MK[mock.ts — heuristics]
  end

  GW[[Vercel AI Gateway\nanthropic/claude-sonnet-5]]

  BVF & BF & CTS -->|JSON| R
  R --> V
  V -->|invalid| ERR[422 error]
  V -->|valid| K
  K -->|no key| M --> RK
  K -->|key| G1 --> G2
  G1 -. draft fail .-> M
  G2 -. critique fail .-> H
  G1 --> H
  G2 --> RC
  H --> RC
  RC --> RK
  RK -->|Variant[] + meta| VC
  G1 & G2 --> GW
  R --- AI & TY & FW & MK
```

## Data flow

**brand voice + brief → generate variants → score → export**

1. **Collect.** The studio holds `BrandVoice`, `Brief`, `copyType`, and `count` in client state.
   Array fields (tone, benefits, forbidden words…) are entered comma-separated and split into lists.
2. **Submit.** The studio POSTs the payload to `/api/copy/generate`.
3. **Validate.** The route parses the body with `GenerateCopyRequestSchema` (zod). Invalid → `422`.
4. **Branch on capability.** `hasAI()` decides live vs. mock.
5. **Generate (live).** `frameworkRotation(copyType, count)` assigns a distinct framework per draft.
   Pass 1 (`generateObject`, temp 0.8) returns `count` framework-shaped drafts.
6. **Score.** Pass 2 (`generateObject`, temp 0.2) returns one critique per draft. In parallel the
   deterministic `heuristicCritique` scores each draft. `reconcileCritique` blends them (60/40) and
   lets any heuristic brand-safety failure override the AI and cap the score.
7. **Rank.** Variants are sorted by `overallScore` descending; the top one is tagged "Recommended".
8. **Render.** `VariantCard`s show content, score badge, framework tag, sub-scores, critique,
   suggestions, and safety/plagiarism flags.
9. **Export.** One-click copy to clipboard today; CSV / ad-platform / ESP export on the roadmap
   (`CopyContent.altHeadlines/altDescriptions` map to Google RSA assets).

Every failure path (no key, empty generation, critique error, thrown error) degrades to a fully
formed result rather than an error, so the flow always completes.

## Request lifecycle

```
POST /api/copy/generate
  → parse JSON            (400 on malformed)
  → zod validate          (422 on invalid)
  → hasAI() ? live : mock
      live:
        generateObject(drafts)         ─ fail → mock
        generateObject(critiques)      ─ fail → heuristic-only
        heuristicCritique(each)
        reconcileCritique(ai, rule)
      mock:
        buildMockVariants(...)         (drafts + heuristic critique)
  → sort by overallScore
  → 200 { variants, meta }   (x-fallback-reason header if degraded)
```

## Deployment topology

- **Platform:** Vercel. Next.js App Router; the API route runs on the **Node.js runtime**
  (Fluid Compute) — no edge-only APIs.
- **Stateless:** no database in v1; each request is self-contained → trivial horizontal scale.
- **Model access:** outbound to the **Vercel AI Gateway** using `"provider/model"` strings; the
  gateway handles provider routing, keys, and usage/cost tracking.
- **Static assets & client bundle:** served by Vercel's CDN; the studio is a client component.
- **Roadmap infra:** Postgres (profiles, briefs, credit ledger), Stripe (billing), queue for
  large batch generations, plus ad-platform/ESP connectors.

## Environment & configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | for live AI | Routes `generateObject` calls through the Vercel AI Gateway. |
| `ANTHROPIC_API_KEY` | optional | Accepted as an alternate credential (`hasAI()` checks both). |
| `GOOGLE_ADS_*`, `META_*` | roadmap | Ad-platform export. |
| `SENDGRID_API_KEY` / `CUSTOMERIO_API_KEY` / `KLAVIYO_API_KEY` | roadmap | ESP sync. |

When no key is set, `hasAI()` is `false` and the app runs entirely on the deterministic mock
engine — the whole studio is demoable offline. Config constants (default model, credits per
variant, variant caps) live in `lib/ai.ts`, `lib/types.ts`, and the route.
