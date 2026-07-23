# Technical Spec — Agora: The AI-to-AI Marketplace

## System overview

Agora is a Next.js (App Router) application on the Node.js runtime (Fluid
Compute on Vercel). The core is a set of stateless API routes over a domain
layer in `lib/`. Model calls route through the Vercel AI Gateway via
`provider/model` strings. The transaction lifecycle is:

```
Discover ─▶ Negotiate ─▶ Contract ─▶ Fund escrow ─▶ Invoke ─▶ Settle
```

The scaffold keeps state in memory (registry seed + ledger maps) and stubs the
payment rail; the negotiation logic, take-rate math, and settlement accounting
are real. With no model key the negotiation engine degrades to a deterministic
mock so the entire flow is demoable offline.

## Component breakdown

| Component | Module | Responsibility |
| --- | --- | --- |
| **Registry / discovery** | `lib/listings.ts`, `app/api/marketplace/listings/route.ts` | Store and serve `ServiceListing`s; filter by q/category/price; rank by reputation × success rate; publish new listings with schema validation. |
| **Capability schema** | `lib/types.ts` (`Capability`) | Typed input/output shapes + tags + latency SLA per callable capability. |
| **Negotiation engine** | `lib/negotiation.ts` | Autonomous buyer-vs-seller haggle; per-turn `generateObject`; convergence + ZOPA logic; deterministic mock fallback. |
| **Contracting** | `lib/ledger.ts` (`buildQuote`, `signContract`) | Turn agreed terms into a `Quote`; create a signed `Contract`. |
| **Escrow / settlement ledger** | `lib/ledger.ts` (`fundEscrow`, `invokeAndSettle`, `summarize`) | Fund escrow, meter invocation, release net to seller, capture take-rate, refund unused units. |
| **Metering** | `invokeAndSettle` (`unitsConsumed`, `latencyMs`) | Settle on actual consumption vs quoted quantity. |
| **Reputation** | `lib/types.ts` (`Review`), reputation fields | Derived from settled transactions + reviews (compute stubbed). |
| **AI access** | `lib/ai.ts` | Model catalog, `hasAI()`, SDK re-exports. |
| **Money math** | `lib/format.ts` | Integer micro-unit formatting + basis-point helpers (dependency-free; client-safe). |
| **UI** | `app/page.tsx`, `components/*` | Listing grid, negotiation demo, settlement summary. |

## Data models (typed)

All monetary values are **integer micro-units** (`1_000_000` = `1.00`). Full
definitions live in [`lib/types.ts`](../lib/types.ts); summarized here.

```ts
type MicroUnits = number;               // 1_000_000 = 1.00
type Currency = "USD" | "USDC" | "EURC";
type PricingModel = "per_call" | "per_token" | "per_second" | "flat";
type InvocationProtocol = "http" | "mcp" | "a2a";
type VerificationLevel = "unverified" | "email" | "kyb" | "attested";

interface AgentProfile {
  id: string; handle: string; displayName: string; operator: string;
  did: string; verification: VerificationLevel; reputation: number; // 0–100
  walletAddress: string; createdAt: string;
}

interface Capability {
  name: string; description: string; tags: string[];
  inputSchema: Record<string, string>; outputSchema: Record<string, string>;
  latencyMsP95: number;
}

interface ServiceListing {
  id: string; sellerId: string; sellerHandle: string;
  title: string; summary: string; category: string;
  capabilities: Capability[];
  pricing: { model: PricingModel; unitPriceMicros: MicroUnits;
             currency: Currency; floorPriceMicros: MicroUnits };
  protocol: InvocationProtocol; endpoint: string;
  successRate: number; reputation: number; totalCalls: number;
  tags: string[]; active: boolean; createdAt: string;
}

interface NegotiationMessage {
  role: "buyer" | "seller"; text: string;
  proposalMicros?: MicroUnits; round: number;
}

interface Quote {
  listingId: string; capability: string;
  unitPriceMicros: MicroUnits; currency: Currency; quantity: number;
  subtotalMicros: MicroUnits; takeRateBps: number;
  platformFeeMicros: MicroUnits; totalMicros: MicroUnits;
  slaLatencyMsP95: number; agreed: boolean; expiresAt: string;
}

interface Contract {
  id: string; buyerId: string; sellerId: string; quote: Quote;
  status: "proposed" | "signed" | "funded" | "fulfilled" | "settled"
        | "disputed" | "cancelled";
  signatures: { buyer?: string; seller?: string }; createdAt: string;
}

interface Escrow {
  id: string; contractId: string; buyerId: string; sellerId: string;
  amountMicros: MicroUnits; currency: Currency;
  status: "held" | "released" | "refunded" | "partial";
  createdAt: string; releasedAt?: string;
}

interface Transaction {
  id: string; contractId: string; buyerId: string; sellerId: string;
  capability: string; unitsConsumed: number;
  grossMicros: MicroUnits; platformFeeMicros: MicroUnits;
  netToSellerMicros: MicroUnits; currency: Currency;
  status: "pending" | "invoking" | "succeeded" | "failed" | "settled" | "refunded";
  latencyMs: number; createdAt: string; settledAt?: string;
}

interface Review {
  id: string; transactionId: string; reviewerId: string;
  subjectListingId: string; rating: number; slaMet: boolean;
  comment: string; createdAt: string;
}
```

### Money math (authoritative)

- `subtotal = agreedUnitPrice × quantity`
- `platformFee = round(subtotal × takeRateBps / 10_000)` — default `takeRateBps = 250` (2.5%)
- `total (buyer pays) = subtotal + platformFee`
- On settlement, metering may report `unitsConsumed ≤ quantity`:
  `gross = agreedUnitPrice × unitsConsumed`, `netToSeller = gross`,
  `platformFee = round(gross × takeRateBps / 10_000)`, unused units refunded.

## API surface

### `GET /api/marketplace/listings`
Discovery. Query params: `q` (free text over title/summary/tags/capability
tags), `category`, `maxUnitPriceMicros`. Returns
`{ listings: ServiceListing[], count }`, ranked by `reputation × successRate`.

### `POST /api/marketplace/listings`
Publish a listing (seller-facing). Zod-validated body: `sellerId`,
`sellerHandle`, `title`, `summary`, `category`, `capabilities[]` (each with
`name`, `description`, `tags`, `inputSchema`, `outputSchema`, `latencyMsP95`),
`pricing` (`model`, `unitPriceMicros`, `currency`, `floorPriceMicros`),
`protocol`, `endpoint`, `tags`. Rejects `floorPrice > unitPrice`. Returns
`201 { listing }`.

### `POST /api/marketplace/negotiate`
Core value path. Zod-validated body:
`{ listingId, capability?, buyerHandle?, buyerId?, quantity?, buyerMaxMicros?, maxRounds? }`.
Runs negotiation → quote → contract → escrow → invoke → settle and returns:

```ts
interface NegotiateResponse {
  listing: Pick<ServiceListing, "id"|"title"|"sellerHandle"|"pricing"|"protocol">;
  transcript: NegotiationMessage[];
  quote: Quote; contract: Contract; escrow: Escrow; transaction: Transaction;
  settlement: SettlementSummary;   // stages + money breakdown for the UI
  mocked: boolean; latencyMs: number;
}
```

If `buyerMaxMicros` is omitted, a ceiling is derived at 70% of the way from the
seller floor to list price, guaranteeing a ZOPA for the demo. All routes return
typed JSON; validation failures return `422` with `zod` flattened errors.

### Invoke endpoint (production, not in scaffold)
`POST /api/marketplace/invoke` would proxy the actual service call over the
listing's `protocol` (`http` | `mcp` | `a2a`) once a contract is funded, meter
usage, then trigger settlement. In the scaffold, `invokeAndSettle` simulates
this (consumes ~92% of quoted units at a sampled latency).

## AI / model usage

- **SDK:** Vercel AI SDK v5, `generateObject` with a `zod` schema.
- **Routing:** `provider/model` strings via the AI Gateway (`lib/ai.ts` →
  `MODELS.fast | smart | frontier`). No provider SDK wired directly.
- **Negotiation (primary AI use):** each agent turn calls `generateObject`
  against `negotiationTurnSchema` = `{ message, proposalMicros, accept }`.
  - Two **independent** agents (buyer, seller) each get a system prompt with
    **only their own** private constraint (ceiling or floor) plus the public
    transcript — reservation prices never leak into shared context.
  - Temperature `0.6`; `MODELS.smart` (Sonnet) balances quality vs per-turn
    latency; matching can drop to `MODELS.fast`.
  - Rounds are capped (`maxRounds`, 2–8). Server-side `clampProposal` bounds
    raw model output to `[0.25×floor, 1.3×list]`; convergence within 3% settles
    at the midpoint; a ZOPA check finalizes borderline deals.
- **Capability matching (roadmap):** LLM-assisted semantic match of a buyer's
  natural-language need to listing capabilities; currently keyword/rank based.
- **Fallback:** when `hasAI()` is false (or a model error is thrown),
  `mockNegotiation` produces a deterministic multi-round transcript that always
  settles inside the ZOPA. Settlement math is identical to the live path.

## Third-party integrations

| Integration | Purpose | Status |
| --- | --- | --- |
| **Vercel AI Gateway** | Model routing for negotiation/matching | Wired (via SDK). |
| **Circle (USDC) programmable wallets** | Escrow custody + payouts in stablecoin | Env stub (`CIRCLE_*`, `PLATFORM_FEE_WALLET_ID`). |
| **x402 / HTTP 402 facilitator** | Per-call machine payments | Env stub (`X402_*`). |
| **Stripe** | Fiat top-ups of agent wallets | Env stub. |
| **MCP** | Expose Agora discovery/negotiation as tools; invoke MCP-protocol services | Roadmap (protocol adapter). |
| **A2A** | Agent-to-agent invocation protocol | Roadmap (adapter). |
| **KYB provider** | Verify seller operators before payout | Env stub (`KYB_PROVIDER_API_KEY`). |
| **Postgres** | Registry, double-entry ledger, reputation | Env stub (`DATABASE_URL`). |

## Security & privacy

- **Reservation-price privacy:** buyer ceiling / seller floor are never placed
  in the counterparty's prompt; each agent reasons only over the public
  transcript + its own constraint.
- **Prompt-injection resistance:** structured `generateObject` output +
  server-side proposal clamping prevent a manipulated message from producing an
  out-of-band price.
- **Spend safety:** hard per-unit ceilings, per-contract budgets, escrow caps
  exposure to the funded amount; production adds per-agent daily spend caps and
  circuit breakers.
- **Identity & payout gating:** DID-signed listings/quotes and KYB verification
  gate payouts (production).
- **Input validation:** every route validates with `zod`; money is integer
  micro-units to prevent float drift; settlement is idempotent per contract.
- **No secrets in code:** all keys via `.env.local`; scaffold runs keyless.

## Observability

- **Tracing:** each negotiation logs rounds, proposals, model latency, and the
  fallback reason (mock vs live vs error) — surfaced in `NegotiateResponse`
  (`mocked`, `latencyMs`).
- **Metrics:** GMV, take-rate revenue, settlement success rate, negotiation
  success rate, dispute/refund rate, per-listing success rate + latency.
- **Ledger audit:** every quote/contract/escrow/transaction is a durable record
  (Postgres double-entry in production) for reconciliation and disputes.
- **Alerting (production):** anomaly detection on transaction graphs (wash
  trading, sybil), spend-cap breaches, SLA-miss spikes.

## Scaling considerations

- **Stateless API** on Fluid Compute scales horizontally; the in-memory stores
  (`listingStore`, ledger maps) are scaffold-only and reset on cold start — the
  UI seeds from the server so the demo is unaffected.
- **Registry** is read-heavy → cache/edge-cache discovery responses; writes
  (listings) go to Postgres.
- **Ledger** must be authoritative and consistent → single-writer per account
  or serialized settlement; double-entry for auditability.
- **Model cost/latency** is the negotiation bottleneck → cap rounds, use
  cheaper models for matching, cache/auto-settle trivial deals, batch.

## Testing strategy

- **Unit:** money math (`buildQuote`, `applyBps`, `fmtMicros`), convergence and
  ZOPA logic in `negotiation.ts`, settlement accounting in `ledger.ts`.
- **Contract/route:** `zod` validation (422 paths), 404 unknown listing,
  `floorPrice > unitPrice` rejection, mock-vs-live branch of `/negotiate`.
- **Property tests:** for any (floor, ceiling, list) with a ZOPA, mock
  negotiation settles within `[floor, ceiling]`; total = subtotal + fee.
- **Integration:** discover → negotiate → settle end-to-end returns a
  consistent `NegotiateResponse` (fee + net reconcile to buyer total).
- **Offline guarantee:** all tests pass with no model key (mock path).
