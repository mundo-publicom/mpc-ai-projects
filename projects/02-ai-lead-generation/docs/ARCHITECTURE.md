# Architecture — AI Lead Generation

## System diagram

```mermaid
flowchart TD
    subgraph Client["Browser — Dashboard (app/page.tsx)"]
      Form["IcpForm\n(ICP capture)"]
      Table["LeadsTable\n(scored leads + export)"]
    end

    subgraph Server["Next.js API routes — Node.js runtime"]
      Gen["POST /api/leads/generate"]
      Exp["POST /api/leads/export"]
    end

    subgraph Domain["lib/ — domain logic"]
      Types["types.ts\n(zod schemas)"]
      Orch["leads.ts\n(orchestrator)"]
      Score["scoring.ts\n(deterministic scorer)"]
      Mock["mock.ts\n(seed enrichment)"]
      CSV["csv.ts"]
    end

    subgraph External["External services"]
      GW["Vercel AI Gateway\nanthropic/claude-sonnet-5"]
      Enrich["Enrichment APIs\n(Apollo/Clearbit/Hunter…)"]
      CRM["CRM\n(HubSpot/Salesforce)"]
    end

    Form -->|ICP JSON| Gen
    Gen --> Orch
    Orch --> Mock
    Orch --> Score
    Orch -->|hasAI()| GW
    Orch -.->|M1| Enrich
    Gen -->|Lead[] + meta| Table
    Table -->|Lead[]| Exp
    Exp --> CSV
    CSV -->|CSV file| Table
    Table -.->|M3 push| CRM
    Types -.-> Gen
    Types -.-> Orch
    Types -.-> Exp
```

## Data flow: ICP → search → enrich → score → export

1. **ICP capture.** `IcpForm` collects free-text + structured fields and posts a typed `Icp` to
   `/api/leads/generate`.
2. **Validate.** The route validates the body against `GenerateLeadsRequestSchema` (zod). Invalid →
   `422` with flattened issues.
3. **Discover.** `lib/leads.ts` builds `count` candidate accounts. In the MVP these come from
   `lib/mock.ts` seeds; in M1 they come from live discovery/enrichment providers.
4. **Enrich.** Each candidate gets company firmographics + a contact with an email-deliverability
   status and `EnrichmentSource` provenance records.
5. **Score.**
   - **AI path (`hasAI()`):** one `generateObject` call (`anthropic/claude-sonnet-5`, temp 0.4)
     scores every candidate against the ICP and writes a personalized opener, filling a zod schema.
     AI scores are reconciled with the deterministic scorer (`reconcileScore`).
   - **Fallback path:** `computeScore` (pure rule-based) produces scores; openers/why-a-fit come
     from templates. Chosen when no key is set or the model call throws.
6. **Prioritize.** `prioritize` sorts leads by score descending; each gets a band
   (hot/warm/cool/cold).
7. **Return.** The route responds with `Lead[]` + `meta` (`usedAI`, `model`, `creditsUsed`,
   `generatedAt`). The dashboard renders the table.
8. **Export.** The user clicks Export; the dashboard posts the working `Lead[]` to
   `/api/leads/export`, which serializes RFC-4180 CSV and streams it back as a file download. CRM
   push is the M3 extension of this step.

## Request lifecycle (generate)

```
Browser fetch POST /api/leads/generate
  → Next.js Node.js function invoked
    → parse JSON            (400 on failure)
    → zod validate          (422 on failure)
    → generateLeads(icp, count)
        → buildMockCandidates()            [discovery + enrichment]
        → hasAI() ?
            yes → generateObject(...)      [AI scoring + openers]
                    → reconcileScore()     [clamp vs. rule-based]
                  (throws → catch → deterministic path)
            no  → computeScore() + templates
        → prioritize()                     [sort by score desc]
    → NextResponse.json({ leads, meta })   (200)
  → dashboard sets state → LeadsTable renders
```

The lifecycle is fail-safe: JSON/validation errors return typed 4xx; any model or enrichment failure
is caught inside `generateLeads` and degrades to the deterministic path rather than returning 5xx.

## Deployment topology

- **Platform:** Vercel. Next.js App Router deployed as serverless functions on **Fluid Compute**
  (Node.js runtime) — no edge-only APIs so enrichment SDKs and streaming work uniformly.
- **Static assets / dashboard:** served from Vercel's CDN; the dashboard is a client component that
  talks to same-origin API routes.
- **Secrets:** injected as Vercel environment variables (AI Gateway, enrichment, CRM). None in the
  repo.
- **Persistence (M2+):** a Postgres/Neon store for campaigns, leads, and the credit ledger; Redis
  (Upstash) for enrichment result caching. Not required for the MVP scaffold, which is stateless.
- **Scaling:** stateless functions scale horizontally; one batched `generateObject` call per
  request bounds model cost; `count` capped per request.

## Environment & config

| Variable | Required | Purpose |
|----------|:--------:|---------|
| `AI_GATEWAY_API_KEY` | No* | Enables the AI scoring/outreach path via Vercel AI Gateway |
| `ANTHROPIC_API_KEY` | No* | Alternative key that also enables the AI path |
| `APOLLO_API_KEY` | No | Live account/contact discovery + enrichment (M1) |
| `CLEARBIT_API_KEY` | No | Company firmographic enrichment (M1) |
| `HUNTER_API_KEY` | No | Email finding + verification (M1) |
| `PEOPLEDATALABS_API_KEY` | No | Person/company enrichment (M1) |
| `BUILTWITH_API_KEY` | No | Tech-stack buying signals (M1) |
| `HUBSPOT_ACCESS_TOKEN` | No | CRM push (M3) |
| `SALESFORCE_CLIENT_ID` / `SALESFORCE_CLIENT_SECRET` | No | CRM push (M3) |

\* With no AI key set, the app runs the deterministic mock path end-to-end — every feature is
demoable with zero configuration. `hasAI()` (in `lib/ai.ts`) is the single switch that selects the
path. Copy `.env.example` → `.env.local` to enable live behavior.
