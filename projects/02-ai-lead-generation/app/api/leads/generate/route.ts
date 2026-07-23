import { NextResponse } from "next/server";
import { generateLeads } from "@/lib/leads";
import {
  GenerateLeadsRequestSchema,
  type GenerateLeadsResponse,
} from "@/lib/types";

// Domain logic runs on the Node.js runtime (Fluid Compute), not edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leads/generate
 * Body: { icp: Icp, count?: number }
 * Returns enriched + scored + prioritized sample leads. Uses the AI SDK
 * `generateObject` path when a key is present; realistic mocks otherwise.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = GenerateLeadsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { icp, count } = parsed.data;

  try {
    const result = await generateLeads(icp, count);
    const payload: GenerateLeadsResponse = {
      leads: result.leads,
      meta: {
        usedAI: result.usedAI,
        model: result.model,
        creditsUsed: result.creditsUsed,
        generatedAt: new Date().toISOString(),
      },
    };
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[/api/leads/generate] fatal:", err);
    return NextResponse.json(
      { error: "Lead generation failed." },
      { status: 500 },
    );
  }
}
