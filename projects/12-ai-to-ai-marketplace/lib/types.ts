/**
 * Domain types for the AI-to-AI Marketplace ("Agora").
 *
 * The object graph mirrors the transaction lifecycle:
 *   AgentProfile ─┬─ publishes ─▶ ServiceListing ── exposes ─▶ Capability[]
 *                 │
 *                 └─ (as buyer) requests ─▶ Quote ─▶ Contract ─▶ Transaction
 *                                                        │
 *                                                        └─ funds ─▶ Escrow ─▶ Review
 *
 * Money is represented in integer minor units (e.g. micro-USD, 1e-6 USD) to
 * avoid floating-point drift in settlement math. Per-call prices for agent
 * services are frequently sub-cent, so we go to 6 decimal places.
 */

/** Integer micro-units of the settlement currency (1_000_000 = 1.00). */
export type MicroUnits = number;

export type Currency = "USD" | "USDC" | "EURC";

/** Pricing model a listing charges under. */
export type PricingModel = "per_call" | "per_token" | "per_second" | "flat";

/** Where the service is invoked / how the buyer reaches it. */
export type InvocationProtocol = "http" | "mcp" | "a2a";

/* ------------------------------------------------------------------ */
/* Identity & capability                                               */
/* ------------------------------------------------------------------ */

export type VerificationLevel = "unverified" | "email" | "kyb" | "attested";

export interface AgentProfile {
  id: string;
  /** Human-friendly handle, e.g. "acme-research-agent". */
  handle: string;
  displayName: string;
  /** Owning organization or developer (for payouts + accountability). */
  operator: string;
  /** DID / public key the agent signs its requests and quotes with. */
  did: string;
  verification: VerificationLevel;
  /** 0–100 reputation, derived from settled transactions + reviews. */
  reputation: number;
  /** Settlement wallet / payout address on the payment rail. */
  walletAddress: string;
  createdAt: string;
}

/** A single machine-callable capability a listing exposes. */
export interface Capability {
  /** Stable slug within the listing, e.g. "summarize". */
  name: string;
  description: string;
  /** Free-form tags used for discovery/matching. */
  tags: string[];
  /** JSON-schema-ish shape of the input the capability expects. */
  inputSchema: Record<string, string>;
  /** JSON-schema-ish shape of the output the capability returns. */
  outputSchema: Record<string, string>;
  /** Typical latency budget in milliseconds (advertised, not guaranteed). */
  latencyMsP95: number;
}

export interface ServiceListing {
  id: string;
  sellerId: string;
  sellerHandle: string;
  title: string;
  summary: string;
  category: string;
  capabilities: Capability[];
  pricing: {
    model: PricingModel;
    /** List price in micro-units per unit of the pricing model. */
    unitPriceMicros: MicroUnits;
    currency: Currency;
    /** Floor the seller agent will accept during negotiation. */
    floorPriceMicros: MicroUnits;
  };
  protocol: InvocationProtocol;
  /** Endpoint the buyer's agent invokes after a contract is signed. */
  endpoint: string;
  /** Advertised reliability, 0–1. */
  successRate: number;
  reputation: number;
  /** Total settled calls, for social proof + ranking. */
  totalCalls: number;
  tags: string[];
  active: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Negotiation & contracting                                           */
/* ------------------------------------------------------------------ */

export type NegotiationRole = "buyer" | "seller";

/** One message in the agent-to-agent negotiation transcript. */
export interface NegotiationMessage {
  role: NegotiationRole;
  /** Natural-language rationale the agent "says" to its counterparty. */
  text: string;
  /** The concrete price this message proposes, if any (micro-units). */
  proposalMicros?: MicroUnits;
  /** Round index, starting at 1. */
  round: number;
}

/** The settled commercial terms both agents agreed to. */
export interface Quote {
  listingId: string;
  capability: string;
  /** Agreed unit price (micro-units). */
  unitPriceMicros: MicroUnits;
  currency: Currency;
  /** Number of units (calls/tokens/seconds) the buyer committed to. */
  quantity: number;
  /** unitPriceMicros * quantity. */
  subtotalMicros: MicroUnits;
  /** Platform take-rate applied, in basis points (e.g. 250 = 2.5%). */
  takeRateBps: number;
  /** Platform fee in micro-units (subtotal * takeRateBps / 10_000). */
  platformFeeMicros: MicroUnits;
  /** subtotal + platformFee — what the buyer's escrow is funded with. */
  totalMicros: MicroUnits;
  /** Agreed SLA the seller commits to. */
  slaLatencyMsP95: number;
  /** Whether both agents reached agreement. */
  agreed: boolean;
  /** ISO expiry after which the quote is void. */
  expiresAt: string;
}

export type ContractStatus =
  | "proposed"
  | "signed"
  | "funded"
  | "fulfilled"
  | "settled"
  | "disputed"
  | "cancelled";

export interface Contract {
  id: string;
  buyerId: string;
  sellerId: string;
  quote: Quote;
  status: ContractStatus;
  /** Buyer + seller signatures over the quote hash. */
  signatures: { buyer?: string; seller?: string };
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Settlement                                                          */
/* ------------------------------------------------------------------ */

export type EscrowStatus = "held" | "released" | "refunded" | "partial";

export interface Escrow {
  id: string;
  contractId: string;
  buyerId: string;
  sellerId: string;
  amountMicros: MicroUnits;
  currency: Currency;
  status: EscrowStatus;
  createdAt: string;
  releasedAt?: string;
}

export type TransactionStatus =
  | "pending"
  | "invoking"
  | "succeeded"
  | "failed"
  | "settled"
  | "refunded";

export interface Transaction {
  id: string;
  contractId: string;
  buyerId: string;
  sellerId: string;
  capability: string;
  /** Units actually consumed (may differ from quoted quantity). */
  unitsConsumed: number;
  grossMicros: MicroUnits;
  platformFeeMicros: MicroUnits;
  /** Paid out to the seller after the take-rate. */
  netToSellerMicros: MicroUnits;
  currency: Currency;
  status: TransactionStatus;
  /** Measured latency of the invocation. */
  latencyMs: number;
  createdAt: string;
  settledAt?: string;
}

export interface Review {
  id: string;
  transactionId: string;
  reviewerId: string;
  subjectListingId: string;
  /** 1–5 stars. */
  rating: number;
  /** Whether the SLA was met (drives reputation). */
  slaMet: boolean;
  comment: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* API payloads                                                        */
/* ------------------------------------------------------------------ */

export interface ListingsResponse {
  listings: ServiceListing[];
  count: number;
}

/** Result of a full negotiate → contract → invoke → settle simulation. */
export interface NegotiateResponse {
  listing: Pick<
    ServiceListing,
    "id" | "title" | "sellerHandle" | "pricing" | "protocol"
  >;
  transcript: NegotiationMessage[];
  quote: Quote;
  contract: Contract;
  escrow: Escrow;
  transaction: Transaction;
  /** Human-readable one-liner for each lifecycle stage. */
  settlement: SettlementSummary;
  mocked: boolean;
  latencyMs: number;
}

export interface SettlementSummary {
  agreed: boolean;
  rounds: number;
  listPriceMicros: MicroUnits;
  agreedUnitPriceMicros: MicroUnits;
  /** Percent the buyer saved vs list price. */
  buyerSavingsPct: number;
  quantity: number;
  subtotalMicros: MicroUnits;
  platformFeeMicros: MicroUnits;
  totalMicros: MicroUnits;
  netToSellerMicros: MicroUnits;
  currency: Currency;
  takeRateBps: number;
  stages: { label: string; detail: string; status: "done" | "skipped" }[];
}
