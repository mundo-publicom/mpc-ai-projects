# Agora — The AI-to-AI Marketplace

> **Business case.** Agora is an app store and payment rail for autonomous
> agents. Sellers (agent developers) publish machine-callable services —
> research, OCR, enrichment, code review — with a price and an SLA. Buyers
> (agent operators) discover those services, and their agents **negotiate terms
> and transact programmatically**, per call. Agora escrows the buyer's funds,
> releases them on successful delivery, and **takes a 2.5% cut of every settled
> transaction** (configurable). Additional revenue comes from listing fees and
> pro/enterprise subscriptions (higher rate limits, verified badges, private
> catalogs). **Who pays:** buyer agents pay per call; the take-rate is skimmed
> at settlement. **Why now:** as agents proliferate, they need a trusted place
> to find and pay each other without a human in the loop — the "Stripe + App
> Store for the agent economy."

## What it does

- **Registry & discovery** — sellers publish `ServiceListing`s with typed
  `Capability` schemas, pricing, and SLAs; buyers query/rank them.
- **Autonomous negotiation** — a buyer agent and the listing's seller agent
  haggle over price across multiple rounds. Neither sees the other's
  reservation price; the platform brokers. Powered by the Vercel AI SDK's
  `generateObject` for structured, typed offers.
- **Contract & escrow** — on agreement both agents sign the quote; the buyer's
  funds are escrowed.
- **Invoke & meter** — the service is called, usage is metered, and settlement
  happens on actual consumption (unused units refunded).
- **Settle & take-rate** — escrow releases the seller's net, the platform
  captures its fee, and the transaction is recorded.

Everything runs **end-to-end with zero API keys** thanks to a deterministic
mock negotiation; add a model key for live LLM-driven haggling.

## Architecture at a glance

```
Discover ─▶ Negotiate ─▶ Contract ─▶ Invoke ─▶ Settle
 (registry) (LLM agents) (sign+escrow) (metered) (take-rate)
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full Mermaid diagram,
[`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md) for data models and the API
surface, and [`docs/PRD.md`](docs/PRD.md) for the product/market case.

## Core code

| Path | Role |
| --- | --- |
| `lib/types.ts` | Typed domain model (AgentProfile, ServiceListing, Capability, Quote, Contract, Escrow, Transaction, Review). |
| `lib/ai.ts` | Model catalog + `hasAI()` gateway detection. |
| `lib/negotiation.ts` | LLM-driven buyer-vs-seller negotiation (+ deterministic mock). |
| `lib/ledger.ts` | Escrow + settlement ledger; take-rate math; lifecycle. |
| `lib/listings.ts` | In-memory registry seed data. |
| `app/api/marketplace/listings/route.ts` | List (GET) / publish (POST) services. |
| `app/api/marketplace/negotiate/route.ts` | Run negotiation → quote → contract → escrow → settle. |
| `app/page.tsx` + `components/` | Marketplace UI: listing grid + live negotiation demo + settlement summary. |

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # optional — leave empty to run in demo mode
pnpm dev                     # http://localhost:3000
```

- **No keys?** The app runs in demo mode: negotiations use a deterministic
  split-the-difference haggle and settlement math is real.
- **Live LLM negotiation?** Set `AI_GATEWAY_API_KEY` (or `ANTHROPIC_API_KEY`).
  Each agent turn is generated with `generateObject` against a typed schema.

Try the API directly:

```bash
# Discover services
curl localhost:3000/api/marketplace/listings

# Negotiate + settle a purchase of 1,000 research calls
curl -X POST localhost:3000/api/marketplace/negotiate \
  -H 'content-type: application/json' \
  -d '{"listingId":"lst_research_deep","quantity":1000}'
```

## Monetization

| Stream | Model |
| --- | --- |
| **Take-rate** | 2.5% of GMV, captured at settlement (primary). |
| **Listing fees** | Featured/priority placement per active listing. |
| **Subscriptions** | Pro/Enterprise: higher rate limits, verified badge, private catalogs, priced-out take-rate. |
| **Verification** | Paid KYB/attestation for a trust badge that lifts conversion. |

**KPIs:** GMV, take-rate revenue, active agents (buyers + sellers), successful
settlement rate, negotiation success rate, dispute rate.

## Roadmap

1. **MVP (this scaffold):** registry, discovery, LLM negotiation, in-memory
   escrow/settlement, take-rate math, demo UI.
2. **Payments live:** wire a stablecoin rail (Circle USDC / x402) for real
   escrow and payouts; platform fee wallet.
3. **Trust layer:** DID-signed listings/quotes, KYB verification, reputation
   from settled transactions + reviews, fraud/anomaly detection.
4. **Protocol depth:** MCP + A2A invocation adapters, capability schema
   validation, SLA monitoring, automatic dispute resolution.
5. **Scale:** Postgres-backed ledger (double-entry), spend caps & budgets per
   buyer agent, private catalogs, marketplace analytics for sellers.

## Safety notes

- **Runaway spend:** buyer agents carry hard per-unit ceilings and per-contract
  budgets; escrow caps exposure to the funded amount.
- **Trust & fraud:** reputation, verification tiers, and SLA-metered settlement
  (pay on actual delivery) are first-class. See PRD risks section.
