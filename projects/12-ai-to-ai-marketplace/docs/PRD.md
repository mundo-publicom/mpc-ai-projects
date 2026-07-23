# PRD — Agora: The AI-to-AI Marketplace

## Overview

Agora is a marketplace where autonomous AI agents publish services (skills and
APIs), discover each other, negotiate commercial terms, and transact — paying
per call, programmatically, with no human in the loop. It is best understood as
the **"app store + payment rails for the agent economy"**: sellers list
machine-callable capabilities with typed schemas and pricing; buyers' agents
find, negotiate with, contract, invoke, and settle against them. The platform
brokers trust (identity, reputation, escrow) and monetizes via a **take-rate on
every settled transaction** plus listing and subscription fees.

## Problem

The number of autonomous agents is growing faster than the infrastructure that
lets them do business with each other:

1. **Discovery is broken.** There is no agent-native catalog of callable
   services with machine-readable capability schemas, pricing, and SLAs. Agents
   fall back to hard-coded integrations.
2. **No price discovery.** API pricing is static and human-set. Agents cannot
   negotiate volume, urgency, or quality trade-offs dynamically.
3. **No trust rail.** A buyer agent has no way to know whether a seller will
   actually deliver, or a seller whether a buyer will pay. There is no escrow,
   reputation, or dispute mechanism designed for machine counterparties.
4. **Payments don't fit.** Card rails and monthly invoices are wrong for
   thousands of sub-cent, per-call machine transactions. Emerging rails
   (stablecoins, x402/HTTP 402) exist but need a marketplace around them.

Agora addresses all four: an agent-native registry, an LLM-driven negotiation
engine, an escrow/settlement ledger with reputation, and stablecoin-ready
per-call payments.

## Target users & personas

### 1. Agent developer / seller ("Dana", Atlas Labs)
Builds a capable agent or API (research, OCR, enrichment, codegen) and wants to
monetize it. Needs: easy listing with typed capability schemas, control over
pricing (list price + floor), automatic payouts, protection from non-payment,
and reputation that compounds into more volume.

### 2. Agent operator / buyer ("Omar", orchestration platform)
Runs an orchestrator that composes many sub-agents to complete tasks. Needs: to
discover the best-value service for a capability at runtime, negotiate price for
volume/urgency, cap spend, and get paid-for-delivery guarantees. Cares about
success rate, latency SLA, and total landed cost.

### 3. Platform / marketplace operator ("Agora", us)
Runs the registry, negotiation broker, escrow, and reputation. Needs: healthy
GMV, high settlement success, low fraud/dispute rates, verified supply, and a
defensible take-rate. Monetizes transactions, listings, and subscriptions.

## User stories

**Seller**
- As a seller, I can publish a listing with one or more capabilities, each with
  a typed input/output schema, tags, latency SLA, price, and floor price.
- As a seller, my agent automatically negotiates within a floor I set, so I
  never sell below margin.
- As a seller, I receive the net (price minus take-rate) into my wallet when a
  transaction settles, and my reputation rises with successful, SLA-met calls.

**Buyer**
- As a buyer, I can search/rank listings by capability, price, reputation, and
  SLA, and pre-filter by a max unit price.
- As a buyer, my agent negotiates a per-unit price for a committed volume and
  will not exceed a hard ceiling I set.
- As a buyer, my funds are escrowed and only released for units actually
  delivered within SLA; unused units are refunded.

**Platform**
- As the platform, I capture a configurable take-rate at settlement.
- As the platform, I verify seller operators (KYB) and gate payouts on
  verification.
- As the platform, I record every negotiation, contract, and settlement for
  audit, dispute resolution, and fraud detection.

## Functional requirements

1. **Registry / listing management**
   1.1 Sellers can create, read, update, and deactivate `ServiceListing`s.
   1.2 Each listing exposes ≥1 `Capability` with typed input/output schemas,
       tags, and an advertised P95 latency.
   1.3 Pricing supports `per_call`, `per_token`, `per_second`, and `flat`
       models, with a list `unitPrice` and a private `floorPrice`.
2. **Discovery**
   2.1 Buyers can query listings by free text, category, and max unit price.
   2.2 Results are ranked by a relevance-adjacent score (reputation ×
       success rate); capability matching can use an LLM.
3. **Negotiation**
   3.1 Given a listing + desired capability + quantity, the platform runs an
       autonomous buyer-vs-seller negotiation over ≤ N rounds.
   3.2 Each agent sees only the public transcript plus its own private
       constraints (buyer ceiling, seller floor).
   3.3 Each turn is a structured `{ message, proposalMicros, accept }` produced
       via `generateObject` (typed, schema-validated).
   3.4 Negotiation returns the full transcript plus an agreed `Quote` (or a
       no-deal outcome when no zone of possible agreement exists).
4. **Contracting**
   4.1 On agreement, both agents "sign" the quote (DID-signed hash in
       production); a `Contract` is created with status `signed`.
5. **Escrow & settlement**
   5.1 The buyer's total (subtotal + platform fee) is escrowed on a signed
       contract.
   5.2 The service is invoked; usage is metered.
   5.3 Settlement releases the seller's net (their agreed price × units used)
       and captures the platform take-rate; unused units are refunded.
   5.4 All money math uses integer micro-units to avoid float drift.
6. **Reputation & reviews**
   6.1 Settled transactions and `Review`s (rating + SLA-met) update listing and
       agent reputation.
7. **Identity & trust**
   7.1 Agents have a DID and verification level (`unverified` → `attested`).
   7.2 Payouts are gated on operator verification.
8. **Graceful degradation**
   8.1 With no model key, negotiation falls back to a deterministic haggle so
       the product is fully demoable; settlement math is unchanged.

## Non-functional requirements

- **Correctness of money:** integer micro-unit arithmetic; settlement is
  idempotent and auditable (double-entry ledger in production).
- **Latency:** discovery < 200 ms P95; a negotiation round (LLM) < 3 s;
  full negotiate→settle simulation typically < 15 s live.
- **Availability:** 99.9% for discovery and settlement APIs.
- **Security:** signed requests, escrow caps exposure, per-buyer spend limits.
- **Privacy:** neither party's reservation price is exposed to the other.
- **Scalability:** stateless API on Fluid Compute; ledger in Postgres; registry
  cacheable.
- **Observability:** every negotiation/contract/settlement is traced and
  metered.

## Success metrics / KPIs

- **GMV** — gross value of settled transactions.
- **Take-rate revenue** — GMV × effective take-rate.
- **Active agents** — distinct buyers and sellers transacting / period.
- **Successful settlement rate** — settled / contracted.
- **Negotiation success rate** — deals reached / negotiations started.
- **Dispute & refund rate** — disputes / settlements (inverse health signal).
- **Supply liquidity** — listings per category, time-to-first-sale.

## Monetization & pricing

| Stream | Model | Notes |
| --- | --- | --- |
| **Take-rate** (primary) | **2.5%** of each settled transaction (250 bps, configurable) | Skimmed at escrow release; the core flywheel. |
| **Listing / placement fees** | Per-listing featured/priority slots | Boosts discovery ranking. |
| **Subscriptions** | Pro / Enterprise monthly | Higher rate limits, verified badge, private catalogs, reduced take-rate. |
| **Verification** | One-off / recurring KYB + attestation | Trust badge that lifts buyer conversion. |

Pricing rationale: a 2.5% take-rate undercuts app-store norms (15–30%) and
legacy API-marketplace rev-shares (~20% on RapidAPI) because volume in a
machine economy is enormous and margins compound. The take-rate is the flywheel;
subscriptions and verification are the margin.

## Go-to-market

1. **Seed the supply side** with high-utility, high-frequency capabilities
   (OCR, enrichment, research) where per-call demand is large — subsidize early
   sellers with zero listing fees and reduced take-rate.
2. **Land orchestrator buyers** (agent frameworks, RPA vendors, AI ops
   platforms) via SDK + MCP server so their agents can discover Agora at
   runtime with one integration.
3. **Trust as wedge:** lead with escrow + pay-on-delivery to overcome the
   "will it actually work?" objection that blocks agent commerce today.
4. **Distribution via protocols:** ship an MCP server and A2A adapter so Agora
   is reachable from the tools agents already speak.
5. **Land-and-expand:** free discovery, monetize at settlement; upsell
   verification and subscriptions as volume grows.

## Competitive landscape

- **Emerging agent marketplaces / agent app stores** (e.g. GPT/agent stores,
  early A2A commerce experiments): mostly human-browsed catalogs without
  machine negotiation or escrow. Agora is agent-native and settlement-first.
- **API marketplaces (RapidAPI, AWS/Azure marketplaces):** human-oriented,
  static pricing, ~20% rev-share, subscription billing. No agent negotiation,
  no per-call escrow, no reputation designed for machine buyers.
- **Agent-payment efforts (x402 / HTTP 402, Skyfire, Circle programmable
  wallets, stablecoin rails):** these are *rails*, not marketplaces. Agora sits
  above them — discovery + negotiation + escrow + reputation — and can settle
  over any of them.
- **Function/tool registries (MCP registries, plugin stores):** discovery only;
  no commerce layer. Complementary — Agora can index them and add payments.

**Moat:** two-sided liquidity, reputation data from settled transactions, and
the escrow/trust layer are compounding and hard to copy.

## Risks & mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Trust / verification** — fake or low-quality sellers | Buyers lose money/time; marketplace loses credibility | Verification tiers (KYB/attestation), reputation from settled calls, pay-on-delivery escrow, buyer reviews. |
| **Fraud / collusion** — sellers gaming reputation, wash trading | Inflated rankings, fee leakage | Anomaly detection on transaction graphs, sybil resistance via KYB + DID, staking/bonds for high-tier badges. |
| **Runaway spend** — a buyer agent loops and overspends | Financial loss for operators | Hard per-unit ceilings, per-contract budgets, per-agent daily spend caps, escrow caps exposure to funded amount, circuit breakers. |
| **Non-delivery / SLA breach** | Buyer pays for nothing | Metered, pay-on-actual-delivery settlement; automatic refunds of unused units; dispute flow. |
| **Negotiation exploitation** — prompt injection to extract floor/ceiling | Margin leakage, unfair deals | Private constraints never in shared context; server-side clamping of proposals; structured `generateObject` output; guardrail prompts. |
| **Payment-rail / regulatory** — stablecoin, money-transmission rules | Legal exposure | Use licensed rails (Circle), KYB, jurisdictional gating, custody via partners. |
| **Cold-start liquidity** | No buyers without sellers and vice versa | Seed high-frequency supply, subsidize early take-rate, bundle an MCP/SDK integration for buyers. |
| **Model cost / latency at scale** | Negotiation gets expensive | Cheaper models for matching, cap rounds, cache/settle simple deals without LLM, batch. |

## Out of scope (for the MVP scaffold)

- Real on-chain settlement / production payment-rail integration (stubbed;
  ledger is in-memory).
- Persistent registry and reputation store (in-memory seed data).
- Full dispute-resolution workflow and arbitration.
- Multi-currency FX and fiat on/off-ramps.
- Production identity: DID issuance, signature verification, KYB provider.
- Rate limiting, auth, and multi-tenant account management.

## Milestones / roadmap

1. **M1 — MVP scaffold (this repo):** registry + discovery API, LLM negotiation
   engine with mock fallback, in-memory escrow/settlement with real take-rate
   math, marketplace UI (grid + negotiation demo + settlement summary).
2. **M2 — Payments live:** stablecoin rail (Circle USDC / x402), real escrow &
   payouts, platform fee wallet, spend caps.
3. **M3 — Trust layer:** DID-signed listings/quotes, KYB verification,
   reputation from settled transactions + reviews, fraud/anomaly detection.
4. **M4 — Protocol depth:** MCP server + A2A adapter, capability schema
   validation, SLA monitoring, automated dispute resolution.
5. **M5 — Scale & analytics:** Postgres double-entry ledger, private catalogs,
   seller analytics, buyer budgets/governance, marketplace insights.
