# Architecture — AI Consulting (Productized)

## System diagram

```mermaid
flowchart TD
  subgraph Client["Browser — Consultant / Client portal"]
    UI["app/page.tsx<br/>Dashboard"]
    IF["IntakeForm"]
    AR["AuditReport<br/>+ OpportunityMatrix"]
  end

  subgraph Server["Next.js — Node.js runtime (Fluid Compute)"]
    RT["POST /api/audit/generate<br/>route.ts"]
    subgraph Lib["lib/"]
      T["types.ts<br/>(zod models)"]
      A["audit.ts<br/>prompt • finalize • mock"]
      R["roi.ts<br/>deterministic ROI"]
      AI["ai.ts<br/>MODELS • hasAI()"]
    end
  end

  GW["Vercel AI Gateway<br/>anthropic/claude-sonnet-5"]

  IF -->|"GenerateAuditRequest (JSON)"| RT
  RT -->|validate| T
  RT -->|"hasAI()?"| AI
  AI -->|"generateObject(schema)"| GW
  GW -->|"AuditDraft"| A
  RT -->|"!hasAI() or error"| A
  A -->|"mockAuditDraft"| A
  A -->|"finalizeAudit()"| R
  R -->|"costed Opportunities + portfolioRoi"| A
  A -->|"Audit"| RT
  RT -->|"GenerateAuditResponse (JSON)"| AR

  %% Planned integrations
  RT -. v0.3 .-> PAY["Stripe<br/>packages + retainers"]
  RT -. v0.3 .-> SCH["Cal.com<br/>readout scheduling"]
  RT -. v0.2 .-> PDF["PDF export"]
  RT -. v0.2 .-> DB[("Postgres<br/>clients • audits • deliverables")]
```

## Data flow (intake → analyze → audit → roadmap → portal)

1. **Intake.** `IntakeForm` (client component) collects the client profile and intake, including a
   dynamic list of processes with hours/headcount/cost/repetitiveness. On submit it builds a
   `GenerateAuditRequest` and POSTs it to the API.
2. **Validate.** The route parses the body with `GenerateAuditRequestSchema` (zod). Invalid input →
   `422` with issue details. IDs/timestamps are normalized onto `Client` and `Intake`.
3. **Analyze.** If `hasAI()`, the route calls `generateObject` with `AuditDraftSchema`, the system
   prompt, and a prompt rendered from the intake (`buildAuditPrompt`). The model returns an
   **AuditDraft** — judgment only (readiness, opportunity ratings, roadmap), no dollar figures.
4. **Audit (finalize).** `finalizeAudit()` costs every opportunity through `lib/roi.ts` (matching it
   to a named intake process), classifies its quadrant, ranks the backlog with `prioritize()`, and
   aggregates a `portfolioRoi`. Readiness band and IDs are assigned here.
5. **Roadmap.** Draft phases are sorted by order and each phase's `estimatedCostUsd` is summed from
   its opportunities' implementation costs.
6. **Portal / report.** The route returns `{ audit, meta }`. `AuditReport` renders the readiness
   gauge, dimension bars, opportunity matrix, backlog table, strengths/gaps, roadmap timeline, and
   portfolio ROI. In v0.4 this same view becomes the authenticated client portal, with `Deliverable`
   records tracking status.

**Fallback path:** if `!hasAI()` or the AI call throws, the route runs `mockAuditDraft()` through the
exact same `finalizeAudit()` pipeline, so mock and live audits are structurally identical
(`meta.usedAI` distinguishes them).

## Request lifecycle

```
Browser (IntakeForm.onSubmit)
  → fetch POST /api/audit/generate  { client, intake }
    → route: JSON parse            (400 on failure)
    → route: zod validate          (422 on failure)
    → normalize client/intake ids
    → hasAI() ?
        yes → generateObject(model=smart, schema=AuditDraftSchema, temp=0.4)
        no  → mockAuditDraft(client, intake)
    → finalizeAudit(draft, client, intake)   // deterministic ROI + ranking
    → GenerateAuditResponseSchema.parse({ audit, meta })
  ← 200 { audit, meta }
Browser → setResult → AuditReport renders
```

Any thrown error inside the `try` is caught, logged, and converted to a mock response — the request
never 500s on an AI hiccup.

## Deployment topology

- **Platform:** Vercel. Next.js App Router; API route runs on the **Node.js runtime** (Fluid
  Compute), `maxDuration = 60s` to accommodate a single structured generation. No edge-only APIs.
- **Static/UI:** dashboard and components served as part of the Next build; the only server work is
  the audit route.
- **AI:** outbound to the Vercel AI Gateway using `provider/model` strings — no provider SDK, so the
  model is swappable via config.
- **Future stateful tier (v0.2+):** Postgres (Neon) for clients/intakes/audits/deliverables and blob
  storage for exported PDFs; Stripe + Cal.com reached from server routes.

## Environment / config

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | for live AI | Auth to Vercel AI Gateway. Absent → deterministic mock. |
| `ANTHROPIC_API_KEY` | optional | Direct-Anthropic fallback if gateway key unset. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | v0.3 | Package checkout + retainer subscriptions. |
| `CAL_API_KEY` / `NEXT_PUBLIC_SCHEDULING_URL` | v0.3 | Readout scheduling. |
| `PDF_EXPORT_API_KEY` | v0.2 | Branded deliverable export. |
| `NEXT_PUBLIC_APP_URL` | optional | Absolute URL for links/redirects. |

`hasAI()` gates the live vs. mock path purely on presence of an AI key, so the app boots and fully
demos with an empty `.env.local`. All configuration is environment-driven; nothing secret is
committed.
