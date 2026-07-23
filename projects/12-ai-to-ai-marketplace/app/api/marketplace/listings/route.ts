import { NextResponse } from "next/server";
import { z } from "zod";
import { listingStore } from "@/lib/listings";
import type { ListingsResponse, ServiceListing } from "@/lib/types";

// Node.js runtime (Fluid Compute on Vercel).
export const runtime = "nodejs";

/**
 * GET /api/marketplace/listings
 *
 * The discovery endpoint agents query to find services. Supports lightweight
 * filtering by category, free-text q (title/summary/tags), and a max unit
 * price so a buyer agent can pre-filter before negotiating. Results are ranked
 * by a simple relevance-adjacent score: reputation * successRate.
 */
export function GET(req: Request): NextResponse<ListingsResponse> {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.toLowerCase().trim();
  const category = url.searchParams.get("category")?.toLowerCase().trim();
  const maxPrice = url.searchParams.get("maxUnitPriceMicros");
  const maxPriceMicros = maxPrice ? Number(maxPrice) : undefined;

  let results = listingStore.filter((l) => l.active);

  if (category) {
    results = results.filter((l) => l.category.toLowerCase() === category);
  }
  if (q) {
    results = results.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q)) ||
        l.capabilities.some((c) =>
          c.tags.some((t) => t.toLowerCase().includes(q)),
        ),
    );
  }
  if (maxPriceMicros != null && Number.isFinite(maxPriceMicros)) {
    results = results.filter(
      (l) => l.pricing.unitPriceMicros <= maxPriceMicros,
    );
  }

  results = [...results].sort(
    (a, b) => b.reputation * b.successRate - a.reputation * a.successRate,
  );

  return NextResponse.json({ listings: results, count: results.length });
}

/* ------------------------------------------------------------------ */
/* POST — publish a new listing                                        */
/* ------------------------------------------------------------------ */

const capabilitySchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().min(1).max(2000),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  inputSchema: z.record(z.string()).default({}),
  outputSchema: z.record(z.string()).default({}),
  latencyMsP95: z.number().int().min(1).max(600000).default(5000),
});

const createSchema = z.object({
  sellerId: z.string().min(1),
  sellerHandle: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(2000),
  category: z.string().min(1).max(60),
  capabilities: z.array(capabilitySchema).min(1).max(20),
  pricing: z.object({
    model: z.enum(["per_call", "per_token", "per_second", "flat"]),
    unitPriceMicros: z.number().int().min(0),
    currency: z.enum(["USD", "USDC", "EURC"]),
    floorPriceMicros: z.number().int().min(0),
  }),
  protocol: z.enum(["http", "mcp", "a2a"]).default("http"),
  endpoint: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(40)).max(30).default([]),
});

let created = 0;

/**
 * POST /api/marketplace/listings — a seller agent publishes a service.
 * Validates the capability schema and pricing, then adds it to the in-memory
 * registry (visible to subsequent GETs within the same process).
 */
export async function POST(
  req: Request,
): Promise<NextResponse<{ listing: ServiceListing } | { error: string; details?: unknown }>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const d = parsed.data;
  if (d.pricing.floorPriceMicros > d.pricing.unitPriceMicros) {
    return NextResponse.json(
      { error: "floorPriceMicros cannot exceed unitPriceMicros" },
      { status: 422 },
    );
  }

  created += 1;
  const listing: ServiceListing = {
    id: `lst_new_${Date.now().toString(36)}${created}`,
    sellerId: d.sellerId,
    sellerHandle: d.sellerHandle,
    title: d.title,
    summary: d.summary,
    category: d.category,
    capabilities: d.capabilities,
    pricing: d.pricing,
    protocol: d.protocol,
    endpoint: d.endpoint,
    successRate: 1, // no history yet
    reputation: 50, // neutral starting reputation
    totalCalls: 0,
    tags: d.tags,
    active: true,
    createdAt: new Date().toISOString(),
  };

  listingStore.unshift(listing);
  return NextResponse.json({ listing }, { status: 201 });
}
