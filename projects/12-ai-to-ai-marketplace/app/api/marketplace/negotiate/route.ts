import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAI } from "@/lib/ai";
import { findListing, SELLER_AGENTS } from "@/lib/listings";
import {
  runNegotiation,
  mockNegotiation,
  type NegotiationConstraints,
} from "@/lib/negotiation";
import {
  buildQuote,
  signContract,
  fundEscrow,
  invokeAndSettle,
  summarize,
  DEFAULT_TAKE_RATE_BPS,
} from "@/lib/ledger";
import type { NegotiateResponse } from "@/lib/types";

// Node.js runtime (Fluid Compute on Vercel).
export const runtime = "nodejs";

const bodySchema = z.object({
  listingId: z.string().min(1),
  /** Capability on the listing the buyer wants; defaults to the first one. */
  capability: z.string().min(1).optional(),
  buyerHandle: z.string().min(1).max(64).default("buyer-agent"),
  buyerId: z.string().min(1).default("agt_buyer_demo"),
  /** Units the buyer wants to purchase. */
  quantity: z.number().int().min(1).max(1_000_000).default(100),
  /**
   * Buyer's private ceiling per unit (micro-units). If omitted we derive an
   * aggressive-but-fair ceiling around the seller's floor so a deal is likely.
   */
  buyerMaxMicros: z.number().int().min(1).optional(),
  maxRounds: z.number().int().min(2).max(8).default(6),
});

/**
 * POST /api/marketplace/negotiate
 *
 * The core value path. Runs an autonomous buyer-vs-seller negotiation for a
 * listing, then drives the full transaction lifecycle:
 *   negotiate → quote → contract → fund escrow → invoke → settle.
 *
 * Uses generateObject to produce each agent's structured turn when a model key
 * is present; otherwise a deterministic mock negotiation keeps the demo live.
 * The take-rate revenue math (platform fee, seller net) is real in both paths.
 */
export async function POST(
  req: Request,
): Promise<NextResponse<NegotiateResponse | { error: string; details?: unknown }>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const body = parsed.data;
  const listing = findListing(body.listingId);
  if (!listing) {
    return NextResponse.json(
      { error: `Listing not found: ${body.listingId}` },
      { status: 404 },
    );
  }

  const capability =
    body.capability && listing.capabilities.some((c) => c.name === body.capability)
      ? body.capability
      : listing.capabilities[0].name;

  // Derive a buyer ceiling that sits between the seller floor and list price,
  // guaranteeing a zone of possible agreement for the demo when not provided.
  const derivedMax = Math.round(
    listing.pricing.floorPriceMicros +
      (listing.pricing.unitPriceMicros - listing.pricing.floorPriceMicros) * 0.7,
  );
  const buyerMaxMicros = body.buyerMaxMicros ?? Math.max(derivedMax, listing.pricing.floorPriceMicros);

  const constraints: NegotiationConstraints = {
    buyerMaxMicros,
    sellerFloorMicros: listing.pricing.floorPriceMicros,
    buyerHandle: body.buyerHandle,
    quantity: body.quantity,
    maxRounds: body.maxRounds,
  };

  const started = Date.now();
  const live = hasAI();

  let result;
  let mocked = false;
  try {
    result = live
      ? await runNegotiation(listing, constraints)
      : mockNegotiation(listing, constraints);
    mocked = !live;
  } catch {
    // Never fail the demo — fall back to the deterministic negotiation.
    result = mockNegotiation(listing, constraints);
    mocked = true;
  }

  // --- Drive the settlement lifecycle on the negotiated terms. ---
  const quote = buildQuote({
    listing,
    capability,
    agreedUnitPriceMicros: result.agreedUnitPriceMicros,
    quantity: body.quantity,
    agreed: result.agreed,
    takeRateBps: DEFAULT_TAKE_RATE_BPS,
  });

  const contract = signContract({
    buyerId: body.buyerId,
    sellerId: listing.sellerId,
    quote,
  });

  // If no deal, short-circuit with a refunded/void settlement.
  const escrow = result.agreed
    ? fundEscrow(contract)
    : {
        id: "esc_void",
        contractId: contract.id,
        buyerId: body.buyerId,
        sellerId: listing.sellerId,
        amountMicros: 0,
        currency: quote.currency,
        status: "refunded" as const,
        createdAt: new Date().toISOString(),
      };

  const transaction = result.agreed
    ? invokeAndSettle({
        contract,
        escrow,
        capability,
        // Simulate metering: buyer consumed ~92% of quoted units.
        unitsConsumed: Math.max(1, Math.round(body.quantity * 0.92)),
        latencyMs: Math.round(
          quote.slaLatencyMsP95 * (0.6 + Math.random() * 0.3),
        ),
      })
    : {
        id: "txn_void",
        contractId: contract.id,
        buyerId: body.buyerId,
        sellerId: listing.sellerId,
        capability,
        unitsConsumed: 0,
        grossMicros: 0,
        platformFeeMicros: 0,
        netToSellerMicros: 0,
        currency: quote.currency,
        status: "refunded" as const,
        latencyMs: 0,
        createdAt: new Date().toISOString(),
      };

  const settlement = summarize({
    listing,
    quote,
    transaction,
    rounds: result.rounds,
  });

  const seller = SELLER_AGENTS.find((a) => a.id === listing.sellerId);

  const res: NegotiateResponse = {
    listing: {
      id: listing.id,
      title: listing.title,
      sellerHandle: seller?.handle ?? listing.sellerHandle,
      pricing: listing.pricing,
      protocol: listing.protocol,
    },
    transcript: result.transcript,
    quote,
    contract,
    escrow,
    transaction,
    settlement,
    mocked,
    latencyMs: Date.now() - started,
  };

  return NextResponse.json(res);
}
