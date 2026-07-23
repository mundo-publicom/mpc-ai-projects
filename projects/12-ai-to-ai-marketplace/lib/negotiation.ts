import { z } from "zod";
import { generateObject, MODELS, fmtMicros } from "./ai";
import type {
  NegotiationMessage,
  ServiceListing,
} from "./types";

/**
 * The negotiation engine. Two autonomous agents — a BUYER trying to procure a
 * capability under a budget, and the listing's SELLER defending a price floor —
 * exchange offers over a bounded number of rounds. Each agent only sees the
 * PUBLIC transcript plus its OWN private constraints; neither can read the
 * other's floor/budget. This mirrors real A2A commerce where the platform
 * brokers but does not leak either party's reservation price.
 *
 * When no model key is present, `mockNegotiation` runs a deterministic
 * split-the-difference haggle so the full flow is demoable offline.
 */

/* ------------------------------------------------------------------ */
/* Structured turn schema (one generateObject call per agent turn)     */
/* ------------------------------------------------------------------ */

export const negotiationTurnSchema = z.object({
  message: z
    .string()
    .describe(
      "One short, professional message to the counterparty agent (<= 45 words). State your position and reasoning. No markdown.",
    ),
  proposalMicros: z
    .number()
    .int()
    .describe(
      "Your current per-unit price offer, in integer micro-units of the currency (1_000_000 = 1.00).",
    ),
  accept: z
    .boolean()
    .describe(
      "True only if you are accepting the counterparty's most recent proposal exactly as-is.",
    ),
});

export type NegotiationTurn = z.infer<typeof negotiationTurnSchema>;

export interface NegotiationConstraints {
  /** Max the buyer will pay per unit (private to buyer). */
  buyerMaxMicros: number;
  /** Min the seller will accept per unit (private to seller). */
  sellerFloorMicros: number;
  /** Buyer-side identity for the transcript/quote. */
  buyerHandle: string;
  quantity: number;
  maxRounds: number;
}

export interface NegotiationResult {
  transcript: NegotiationMessage[];
  agreed: boolean;
  agreedUnitPriceMicros: number;
  rounds: number;
}

/* ------------------------------------------------------------------ */
/* Prompt construction                                                 */
/* ------------------------------------------------------------------ */

function buyerSystem(
  listing: ServiceListing,
  c: NegotiationConstraints,
): string {
  return [
    `You are "${c.buyerHandle}", an autonomous procurement agent negotiating to buy a service from another AI agent on a machine-to-machine marketplace.`,
    ``,
    `SERVICE: ${listing.title} — ${listing.summary}`,
    `Seller list price: ${fmtMicros(listing.pricing.unitPriceMicros)} ${listing.pricing.currency} per ${listing.pricing.model.replace("per_", "")}.`,
    `You want ${c.quantity} unit(s).`,
    ``,
    `YOUR PRIVATE CONSTRAINTS (never reveal the exact number):`,
    `- Hard ceiling: you must NOT agree above ${c.buyerMaxMicros} micro-units per unit.`,
    `- Goal: settle as far below the list price as is reasonable, but a fair deal beats no deal.`,
    ``,
    `RULES:`,
    `- Open lower than list, then move toward the middle in each round.`,
    `- Accept only if the seller's latest offer is at or below your ceiling AND further haggling is unlikely to help.`,
    `- Be concise and professional. Output your proposal as integer micro-units.`,
  ].join("\n");
}

function sellerSystem(
  listing: ServiceListing,
  c: NegotiationConstraints,
): string {
  return [
    `You are "${listing.sellerHandle}", the autonomous selling agent for "${listing.title}" on a machine-to-machine marketplace. You are negotiating a per-unit price with a buyer agent.`,
    ``,
    `SERVICE: ${listing.summary}`,
    `Your public list price: ${listing.pricing.unitPriceMicros} micro-units per unit. Reputation ${listing.reputation}/100, success rate ${(listing.successRate * 100).toFixed(1)}%.`,
    `Buyer wants ${c.quantity} unit(s) — larger volume justifies a modest discount.`,
    ``,
    `YOUR PRIVATE CONSTRAINTS (never reveal the exact number):`,
    `- Hard floor: you must NOT agree below ${c.sellerFloorMicros} micro-units per unit.`,
    `- Goal: capture as much margin above the floor as possible while still closing the deal.`,
    ``,
    `RULES:`,
    `- Anchor near list price, concede slowly toward the middle each round.`,
    `- Accept only if the buyer's latest offer is at or above your floor AND holding out risks losing the deal.`,
    `- Be concise and professional. Output your proposal as integer micro-units.`,
  ].join("\n");
}

function renderTranscript(t: NegotiationMessage[]): string {
  if (t.length === 0) return "(no messages yet — you open the negotiation)";
  return t
    .map(
      (m) =>
        `[round ${m.round}] ${m.role === "buyer" ? "BUYER" : "SELLER"}: ${m.text}` +
        (m.proposalMicros != null
          ? ` (offer: ${m.proposalMicros} micro-units)`
          : ""),
    )
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Live negotiation (LLM-driven, alternating turns)                    */
/* ------------------------------------------------------------------ */

/** Clamp a raw model proposal into the plausible band to keep math sane. */
function clampProposal(raw: number, listing: ServiceListing): number {
  const list = listing.pricing.unitPriceMicros;
  // Absolute band: nobody proposes below 25% of floor or above 130% of list.
  const lo = Math.round(listing.pricing.floorPriceMicros * 0.25);
  const hi = Math.round(list * 1.3);
  const v = Math.round(Number.isFinite(raw) ? raw : list);
  return Math.min(hi, Math.max(lo, v));
}

export async function runNegotiation(
  listing: ServiceListing,
  c: NegotiationConstraints,
): Promise<NegotiationResult> {
  const transcript: NegotiationMessage[] = [];
  let lastBuyerOffer: number | undefined;
  let lastSellerOffer: number | undefined;
  let agreed = false;
  let agreedUnitPriceMicros = listing.pricing.unitPriceMicros;
  let round = 0;

  // Alternate: seller opens (anchors at list), then buyer, seller, ...
  const order: ("seller" | "buyer")[] = [];
  for (let i = 0; i < c.maxRounds; i++) {
    order.push(i % 2 === 0 ? "seller" : "buyer");
  }

  for (const role of order) {
    round++;
    const system = role === "buyer" ? buyerSystem(listing, c) : sellerSystem(listing, c);
    const prompt = [
      `NEGOTIATION SO FAR:`,
      renderTranscript(transcript),
      ``,
      role === "buyer"
        ? `The seller's latest offer is ${lastSellerOffer ?? listing.pricing.unitPriceMicros} micro-units. Make your move.`
        : transcript.length === 0
          ? `Open the negotiation with your anchor price.`
          : `The buyer's latest offer is ${lastBuyerOffer ?? 0} micro-units. Make your move.`,
    ].join("\n");

    const { object } = await generateObject({
      model: MODELS.smart,
      schema: negotiationTurnSchema,
      system,
      prompt,
      temperature: 0.6,
    });

    const proposal = clampProposal(object.proposalMicros, listing);

    // Did this agent accept the other side's standing offer?
    const standing = role === "buyer" ? lastSellerOffer : lastBuyerOffer;
    if (object.accept && standing != null) {
      agreed = true;
      agreedUnitPriceMicros = standing;
      transcript.push({ role, text: object.message, proposalMicros: standing, round });
      break;
    }

    transcript.push({ role, text: object.message, proposalMicros: proposal, round });
    if (role === "buyer") lastBuyerOffer = proposal;
    else lastSellerOffer = proposal;

    // Convergence check: offers crossed or within 3% — settle at midpoint.
    if (lastBuyerOffer != null && lastSellerOffer != null) {
      const gap = lastSellerOffer - lastBuyerOffer;
      const tol = Math.round(listing.pricing.unitPriceMicros * 0.03);
      if (gap <= tol) {
        agreed = true;
        agreedUnitPriceMicros = Math.round((lastBuyerOffer + lastSellerOffer) / 2);
        break;
      }
    }
  }

  // If we never converged but the standing offers overlap the viable band,
  // fall back to the midpoint of the last offers as the settled price.
  if (!agreed && lastBuyerOffer != null && lastSellerOffer != null) {
    if (lastBuyerOffer >= c.sellerFloorMicros && lastSellerOffer <= c.buyerMaxMicros) {
      agreed = true;
      agreedUnitPriceMicros = Math.round((lastBuyerOffer + lastSellerOffer) / 2);
    }
  }

  return { transcript, agreed, agreedUnitPriceMicros, rounds: round };
}

/* ------------------------------------------------------------------ */
/* Mock negotiation (deterministic, no API key)                        */
/* ------------------------------------------------------------------ */

/**
 * Deterministic split-the-difference haggle. Produces a believable multi-round
 * transcript that always converges inside [floor, ceiling] when a zone of
 * possible agreement (ZOPA) exists — so the demo settles offline.
 */
export function mockNegotiation(
  listing: ServiceListing,
  c: NegotiationConstraints,
): NegotiationResult {
  const list = listing.pricing.unitPriceMicros;
  const transcript: NegotiationMessage[] = [];

  // Seller anchors at list; buyer opens ~25% under their ceiling.
  let sellerOffer = list;
  let buyerOffer = Math.round(c.buyerMaxMicros * 0.75);
  let round = 0;

  const volumeNote =
    c.quantity >= 100 ? " Given the volume you're committing to," : "";

  transcript.push({
    role: "seller",
    round: ++round,
    text: `Our list rate for ${listing.title} is ${fmtMicros(list)} ${listing.pricing.currency} per call, backed by a ${(listing.successRate * 100).toFixed(1)}% success rate.`,
    proposalMicros: sellerOffer,
  });
  transcript.push({
    role: "buyer",
    round: ++round,
    text: `Appreciated. We run this at scale and can commit ${c.quantity} calls now; can you do ${fmtMicros(buyerOffer)} per call?`,
    proposalMicros: buyerOffer,
  });

  let agreed = false;
  let agreedUnitPriceMicros = list;

  // Converge by halving the gap each round, respecting floor/ceiling.
  for (let i = 0; i < Math.max(2, c.maxRounds - 2); i++) {
    const gap = sellerOffer - buyerOffer;
    const tol = Math.round(list * 0.03);
    if (gap <= tol) {
      agreedUnitPriceMicros = Math.round((sellerOffer + buyerOffer) / 2);
      agreed = agreedUnitPriceMicros >= c.sellerFloorMicros && agreedUnitPriceMicros <= c.buyerMaxMicros;
      break;
    }

    // Seller concedes ~40% of the gap but never below floor.
    sellerOffer = Math.max(c.sellerFloorMicros, Math.round(sellerOffer - gap * 0.4));
    transcript.push({
      role: "seller",
      round: ++round,
      text: `${volumeNote} we can come down to ${fmtMicros(sellerOffer)} per call — that reflects the volume discount while keeping our SLA guarantees.`.trim(),
      proposalMicros: sellerOffer,
    });

    const gap2 = sellerOffer - buyerOffer;
    if (gap2 <= tol) {
      agreedUnitPriceMicros = Math.round((sellerOffer + buyerOffer) / 2);
      agreed = agreedUnitPriceMicros >= c.sellerFloorMicros && agreedUnitPriceMicros <= c.buyerMaxMicros;
      break;
    }

    // Buyer moves up ~50% of the remaining gap but never above ceiling.
    buyerOffer = Math.min(c.buyerMaxMicros, Math.round(buyerOffer + gap2 * 0.5));
    transcript.push({
      role: "buyer",
      round: ++round,
      text: `That works better. Meet us at ${fmtMicros(buyerOffer)} and we'll sign the contract and fund escrow immediately.`,
      proposalMicros: buyerOffer,
    });
  }

  if (!agreed) {
    // Final settle at midpoint if a ZOPA exists.
    const mid = Math.round((sellerOffer + buyerOffer) / 2);
    if (mid >= c.sellerFloorMicros && mid <= c.buyerMaxMicros) {
      agreedUnitPriceMicros = mid;
      agreed = true;
    }
  }

  if (agreed) {
    transcript.push({
      role: "seller",
      round: ++round,
      text: `Deal. Confirming ${fmtMicros(agreedUnitPriceMicros)} ${listing.pricing.currency} per call for ${c.quantity} calls. Signing now.`,
      proposalMicros: agreedUnitPriceMicros,
    });
  } else {
    transcript.push({
      role: "buyer",
      round: ++round,
      text: `We can't reach a workable rate this round. Ending negotiation without a contract.`,
    });
  }

  return { transcript, agreed, agreedUnitPriceMicros, rounds: round };
}
