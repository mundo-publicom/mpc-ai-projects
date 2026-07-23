import { NextResponse } from "next/server";
import { z } from "zod";
import { computePosture, buildRemediations } from "@/lib/posture";
import { MOCK_FINDINGS, MOCK_PREVIOUS_POSTURE_SCORE } from "@/lib/mock-data";
import type { ApiError, Finding, PostureResponse } from "@/lib/types";

// Node.js runtime (Fluid Compute on Vercel).
export const runtime = "nodejs";

const findingSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    "vulnerability",
    "misconfiguration",
    "identity",
    "exposure",
    "endpoint_hygiene",
    "backup_recovery",
    "logging_visibility",
  ]),
  title: z.string().min(1).max(300),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  affectedAssetIds: z.array(z.string()).default([]),
  resolved: z.boolean().default(false),
});

const bodySchema = z.object({
  findings: z.array(findingSchema).max(1000),
  previousScore: z.number().min(0).max(100).optional(),
});

/**
 * POST /api/posture
 *
 * Computes a 0..100 security posture score plus a prioritized remediation plan
 * from a set of findings. This is a deterministic, transparent calculation
 * (no AI required) so scores are reproducible and auditable.
 *
 * Body: { findings: Finding[], previousScore?: number }
 */
export async function POST(
  req: Request,
): Promise<NextResponse<PostureResponse | ApiError>> {
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

  const findings: Finding[] = parsed.data.findings;
  const posture = computePosture(findings, parsed.data.previousScore);
  const remediations = buildRemediations(findings);

  return NextResponse.json({ posture, remediations });
}

/**
 * GET /api/posture
 *
 * Convenience endpoint that scores the built-in demo environment, so the
 * dashboard can render on first load with zero setup.
 */
export async function GET(): Promise<NextResponse<PostureResponse>> {
  const posture = computePosture(MOCK_FINDINGS, MOCK_PREVIOUS_POSTURE_SCORE);
  const remediations = buildRemediations(MOCK_FINDINGS);
  return NextResponse.json({ posture, remediations });
}
