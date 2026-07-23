import type { AgentProfile, ServiceListing } from "./types";

/**
 * In-memory seed data. In production these live in Postgres behind the
 * registry service; here they back the /api/marketplace/listings route and
 * give the negotiation demo real counterparties to trade with.
 *
 * The module keeps mutable arrays so POSTing a new listing in one request is
 * visible to the next GET within the same server process (best-effort for a
 * scaffold; serverless cold starts reset it — see TECHNICAL_SPEC.md).
 */

export const SELLER_AGENTS: AgentProfile[] = [
  {
    id: "agt_research",
    handle: "atlas-research",
    displayName: "Atlas Research Agent",
    operator: "Atlas Labs",
    did: "did:key:z6MkAtlasResearch01",
    verification: "kyb",
    reputation: 94,
    walletAddress: "0xA71a5Research000000000000000000000000001",
    createdAt: "2026-01-12T09:00:00.000Z",
  },
  {
    id: "agt_vision",
    handle: "iris-vision",
    displayName: "Iris Vision Agent",
    operator: "Iris AI",
    did: "did:key:z6MkIrisVision02",
    verification: "attested",
    reputation: 88,
    walletAddress: "0x1215Vision0000000000000000000000000000002",
    createdAt: "2026-02-03T11:30:00.000Z",
  },
  {
    id: "agt_data",
    handle: "quill-enrichment",
    displayName: "Quill Data Enrichment",
    operator: "Quill Data Co.",
    did: "did:key:z6MkQuillData03",
    verification: "kyb",
    reputation: 91,
    walletAddress: "0xdA7aQuill00000000000000000000000000000003",
    createdAt: "2026-01-28T14:15:00.000Z",
  },
  {
    id: "agt_code",
    handle: "forge-codegen",
    displayName: "Forge Codegen Agent",
    operator: "Forge Systems",
    did: "did:key:z6MkForgeCode04",
    verification: "email",
    reputation: 79,
    walletAddress: "0xF0a6eForge0000000000000000000000000000004",
    createdAt: "2026-03-19T08:45:00.000Z",
  },
];

export const SEED_LISTINGS: ServiceListing[] = [
  {
    id: "lst_research_deep",
    sellerId: "agt_research",
    sellerHandle: "atlas-research",
    title: "Deep Web Research & Synthesis",
    summary:
      "Multi-source research: crawls, deduplicates, and synthesizes a cited brief on any topic. Returns structured claims with source URLs and confidence.",
    category: "Research",
    capabilities: [
      {
        name: "research_brief",
        description:
          "Produce a cited research brief for a query with N sources.",
        tags: ["research", "web", "synthesis", "citations"],
        inputSchema: { query: "string", maxSources: "number", depth: "enum" },
        outputSchema: {
          brief: "string",
          claims: "Claim[]",
          sources: "Source[]",
        },
        latencyMsP95: 18000,
      },
    ],
    pricing: {
      model: "per_call",
      unitPriceMicros: 120_000, // $0.12 / call
      currency: "USDC",
      floorPriceMicros: 80_000, // $0.08 floor
    },
    protocol: "mcp",
    endpoint: "mcp://atlas-research/research_brief",
    successRate: 0.987,
    reputation: 94,
    totalCalls: 41230,
    tags: ["research", "rag", "citations", "web"],
    active: true,
    createdAt: "2026-01-12T09:05:00.000Z",
  },
  {
    id: "lst_vision_ocr",
    sellerId: "agt_vision",
    sellerHandle: "iris-vision",
    title: "Document OCR + Layout Extraction",
    summary:
      "High-accuracy OCR for scanned docs, invoices, and forms. Returns structured key/value pairs, tables, and bounding boxes.",
    category: "Vision",
    capabilities: [
      {
        name: "extract_document",
        description: "OCR + layout parse of a PDF/image page.",
        tags: ["ocr", "vision", "documents", "extraction"],
        inputSchema: { fileUrl: "string", language: "string" },
        outputSchema: { text: "string", fields: "KeyValue[]", tables: "Table[]" },
        latencyMsP95: 4200,
      },
    ],
    pricing: {
      model: "per_call",
      unitPriceMicros: 9_000, // $0.009 / page
      currency: "USDC",
      floorPriceMicros: 5_000,
    },
    protocol: "http",
    endpoint: "https://api.iris.ai/v1/extract",
    successRate: 0.995,
    reputation: 88,
    totalCalls: 512400,
    tags: ["ocr", "vision", "documents"],
    active: true,
    createdAt: "2026-02-03T11:35:00.000Z",
  },
  {
    id: "lst_data_enrich",
    sellerId: "agt_data",
    sellerHandle: "quill-enrichment",
    title: "Company & Contact Enrichment",
    summary:
      "Enrich a domain or email into a full firmographic + contact profile: headcount, funding, tech stack, and verified role emails.",
    category: "Data",
    capabilities: [
      {
        name: "enrich_company",
        description: "Resolve a domain to a firmographic profile.",
        tags: ["enrichment", "b2b", "firmographics", "leads"],
        inputSchema: { domain: "string" },
        outputSchema: { company: "Company", contacts: "Contact[]" },
        latencyMsP95: 1400,
      },
      {
        name: "verify_email",
        description: "Deliverability + role check on an email address.",
        tags: ["email", "verification", "deliverability"],
        inputSchema: { email: "string" },
        outputSchema: { valid: "boolean", role: "string", risk: "number" },
        latencyMsP95: 600,
      },
    ],
    pricing: {
      model: "per_call",
      unitPriceMicros: 25_000, // $0.025 / call
      currency: "USDC",
      floorPriceMicros: 15_000,
    },
    protocol: "http",
    endpoint: "https://api.quill.co/v2/enrich",
    successRate: 0.978,
    reputation: 91,
    totalCalls: 203980,
    tags: ["enrichment", "b2b", "data", "leads"],
    active: true,
    createdAt: "2026-01-28T14:20:00.000Z",
  },
  {
    id: "lst_code_review",
    sellerId: "agt_code",
    sellerHandle: "forge-codegen",
    title: "Automated Code Review & Patch",
    summary:
      "Reviews a diff or repo path, flags bugs and security issues, and returns a ready-to-apply patch with explanations.",
    category: "Engineering",
    capabilities: [
      {
        name: "review_diff",
        description: "Review a unified diff and return findings + a patch.",
        tags: ["code", "review", "security", "patch"],
        inputSchema: { diff: "string", language: "string" },
        outputSchema: { findings: "Finding[]", patch: "string" },
        latencyMsP95: 9000,
      },
    ],
    pricing: {
      model: "per_call",
      unitPriceMicros: 60_000, // $0.06 / review
      currency: "USDC",
      floorPriceMicros: 40_000,
    },
    protocol: "a2a",
    endpoint: "a2a://forge-codegen/review_diff",
    successRate: 0.961,
    reputation: 79,
    totalCalls: 18760,
    tags: ["code", "review", "engineering", "security"],
    active: true,
    createdAt: "2026-03-19T08:50:00.000Z",
  },
];

/** Live, mutable store for the scaffold (see note above). */
export const listingStore: ServiceListing[] = [...SEED_LISTINGS];

export function findListing(id: string): ServiceListing | undefined {
  return listingStore.find((l) => l.id === id);
}
