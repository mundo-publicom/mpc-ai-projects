import { applyBps } from "./ai";
import type {
  Contract,
  Escrow,
  Quote,
  ServiceListing,
  SettlementSummary,
  Transaction,
} from "./types";

/**
 * In-memory escrow + settlement ledger for the scaffold. Production replaces
 * these maps with a double-entry ledger in Postgres and moves value over a
 * stablecoin payment rail (see TECHNICAL_SPEC.md → Settlement). The lifecycle
 * and the money math here are the real thing; only the persistence + on-chain
 * transfer are stubbed.
 *
 * Lifecycle: quote → contract (signed) → escrow (funded) → transaction
 * (invoked) → settle (release to seller, capture platform fee).
 */

/** Platform take-rate in basis points. 250 bps = 2.5%. */
export const DEFAULT_TAKE_RATE_BPS = 250;

/** Quotes are valid for this long after issuance. */
const QUOTE_TTL_MS = 5 * 60 * 1000;

// Process-local stores (best-effort for the scaffold).
export const contractStore = new Map<string, Contract>();
export const escrowStore = new Map<string, Escrow>();
export const transactionStore = new Map<string, Transaction>();

let seq = 0;
function id(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Quote                                                               */
/* ------------------------------------------------------------------ */

export function buildQuote(input: {
  listing: ServiceListing;
  capability: string;
  agreedUnitPriceMicros: number;
  quantity: number;
  agreed: boolean;
  takeRateBps?: number;
}): Quote {
  const { listing, capability, agreedUnitPriceMicros, quantity, agreed } = input;
  const takeRateBps = input.takeRateBps ?? DEFAULT_TAKE_RATE_BPS;

  const subtotalMicros = agreedUnitPriceMicros * quantity;
  const platformFeeMicros = applyBps(subtotalMicros, takeRateBps);
  const totalMicros = subtotalMicros + platformFeeMicros;

  return {
    listingId: listing.id,
    capability,
    unitPriceMicros: agreedUnitPriceMicros,
    currency: listing.pricing.currency,
    quantity,
    subtotalMicros,
    takeRateBps,
    platformFeeMicros,
    totalMicros,
    slaLatencyMsP95:
      listing.capabilities.find((c) => c.name === capability)?.latencyMsP95 ??
      listing.capabilities[0]?.latencyMsP95 ??
      5000,
    agreed,
    expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Contract → escrow → transaction → settlement                        */
/* ------------------------------------------------------------------ */

export function signContract(input: {
  buyerId: string;
  sellerId: string;
  quote: Quote;
}): Contract {
  const now = new Date().toISOString();
  const contract: Contract = {
    id: id("ctr"),
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    quote: input.quote,
    status: input.quote.agreed ? "signed" : "cancelled",
    // Signatures are deterministic stand-ins for the DID-signed quote hash.
    signatures: input.quote.agreed
      ? {
          buyer: `sig:${input.buyerId}:${input.quote.totalMicros}`,
          seller: `sig:${input.sellerId}:${input.quote.totalMicros}`,
        }
      : {},
    createdAt: now,
  };
  contractStore.set(contract.id, contract);
  return contract;
}

export function fundEscrow(contract: Contract): Escrow {
  const escrow: Escrow = {
    id: id("esc"),
    contractId: contract.id,
    buyerId: contract.buyerId,
    sellerId: contract.sellerId,
    amountMicros: contract.quote.totalMicros,
    currency: contract.quote.currency,
    status: "held",
    createdAt: new Date().toISOString(),
  };
  escrowStore.set(escrow.id, escrow);
  contract.status = "funded";
  return escrow;
}

/**
 * Simulate the buyer's agent invoking the seller's endpoint, then settle:
 * release the seller's net (subtotal) from escrow, capture the platform fee,
 * and mark the transaction settled. Metering may report fewer units consumed
 * than quoted; we settle on actual usage and refund the difference.
 */
export function invokeAndSettle(input: {
  contract: Contract;
  escrow: Escrow;
  capability: string;
  /** Actual units metered by the invocation (defaults to quoted quantity). */
  unitsConsumed?: number;
  /** Measured latency of the invocation (ms). */
  latencyMs?: number;
}): Transaction {
  const { contract, escrow, capability } = input;
  const q = contract.quote;
  const units = Math.min(input.unitsConsumed ?? q.quantity, q.quantity);

  const grossMicros = q.unitPriceMicros * units;
  const platformFeeMicros = applyBps(grossMicros, q.takeRateBps);
  const netToSellerMicros = grossMicros; // seller receives gross of their price
  const buyerChargedMicros = grossMicros + platformFeeMicros;

  const tx: Transaction = {
    id: id("txn"),
    contractId: contract.id,
    buyerId: contract.buyerId,
    sellerId: contract.sellerId,
    capability,
    unitsConsumed: units,
    grossMicros,
    platformFeeMicros,
    netToSellerMicros,
    currency: q.currency,
    status: "settled",
    latencyMs: input.latencyMs ?? q.slaLatencyMsP95,
    createdAt: new Date().toISOString(),
    settledAt: new Date().toISOString(),
  };
  transactionStore.set(tx.id, tx);

  // Escrow accounting: release what was actually used, refund the remainder.
  if (buyerChargedMicros >= escrow.amountMicros) {
    escrow.status = "released";
  } else {
    escrow.status = "partial"; // partial release + refund of unused units
  }
  escrow.releasedAt = new Date().toISOString();
  contract.status = "settled";

  return tx;
}

/* ------------------------------------------------------------------ */
/* Human-readable settlement summary for the UI                        */
/* ------------------------------------------------------------------ */

export function summarize(input: {
  listing: ServiceListing;
  quote: Quote;
  transaction: Transaction;
  rounds: number;
}): SettlementSummary {
  const { listing, quote, transaction, rounds } = input;
  const list = listing.pricing.unitPriceMicros;
  const buyerSavingsPct =
    list > 0 ? ((list - quote.unitPriceMicros) / list) * 100 : 0;

  const agreed = quote.agreed;

  const stages: SettlementSummary["stages"] = [
    {
      label: "Discover",
      detail: `Buyer matched "${listing.title}" from ${listing.sellerHandle}.`,
      status: "done",
    },
    {
      label: "Negotiate",
      detail: agreed
        ? `${rounds} rounds → agreed ${quote.unitPriceMicros} µ/unit (${buyerSavingsPct.toFixed(1)}% under list).`
        : `${rounds} rounds → no agreement (outside ZOPA).`,
      status: "done",
    },
    {
      label: "Contract",
      detail: agreed
        ? `Both agents signed the quote hash; contract funded.`
        : `No contract signed.`,
      status: agreed ? "done" : "skipped",
    },
    {
      label: "Invoke",
      detail: agreed
        ? `${transaction.unitsConsumed} unit(s) of ${transaction.capability} served in ${transaction.latencyMs}ms.`
        : `Invocation skipped.`,
      status: agreed ? "done" : "skipped",
    },
    {
      label: "Settle",
      detail: agreed
        ? `Escrow released: seller +${transaction.netToSellerMicros} µ, platform +${transaction.platformFeeMicros} µ.`
        : `Escrow refunded to buyer.`,
      status: agreed ? "done" : "skipped",
    },
  ];

  return {
    agreed,
    rounds,
    listPriceMicros: list,
    agreedUnitPriceMicros: quote.unitPriceMicros,
    buyerSavingsPct: Number(buyerSavingsPct.toFixed(1)),
    quantity: quote.quantity,
    subtotalMicros: quote.subtotalMicros,
    platformFeeMicros: transaction.platformFeeMicros,
    totalMicros: quote.totalMicros,
    netToSellerMicros: transaction.netToSellerMicros,
    currency: quote.currency,
    takeRateBps: quote.takeRateBps,
    stages,
  };
}
