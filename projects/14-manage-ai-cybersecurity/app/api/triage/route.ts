import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateObject,
  hasAI,
  MODELS,
  triageSchema,
  buildTriagePrompt,
  TRIAGE_SYSTEM_PROMPT,
  mockTriage,
  toTriageResult,
} from "@/lib/ai";
import type { Alert, ApiError, TriageResponse } from "@/lib/types";

// Node.js runtime (Fluid Compute on Vercel) — avoids edge-only limitations.
export const runtime = "nodejs";

/* Input validation: a raw, normalized alert to triage. */
const indicatorsSchema = z
  .object({
    sourceIp: z.string().optional(),
    destinationIp: z.string().optional(),
    user: z.string().optional(),
    host: z.string().optional(),
    process: z.string().optional(),
    fileHash: z.string().optional(),
    domain: z.string().optional(),
  })
  .default({});

const alertSchema = z.object({
  id: z.string().min(1).default(() => `alt-${Date.now()}`),
  timestamp: z.string().default(() => new Date().toISOString()),
  source: z
    .enum([
      "edr",
      "siem",
      "firewall",
      "identity",
      "cloud",
      "email",
      "vuln_scanner",
      "manual",
    ])
    .default("manual"),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(8000),
  reportedSeverity: z
    .enum(["critical", "high", "medium", "low", "info"])
    .default("medium"),
  assetId: z.string().optional(),
  assetName: z.string().optional(),
  indicators: indicatorsSchema,
});

/**
 * POST /api/triage
 *
 * Core value path: accept a raw security alert and return a structured triage
 * verdict — severity, likely true/false positive, MITRE ATT&CK mapping,
 * rationale, and prioritized DEFENSIVE remediation steps.
 *
 * Uses `generateObject` + zod for a guaranteed shape. When no AI key is
 * present (or the model call fails), a deterministic mock engine returns an
 * equivalent result so the demo runs end-to-end with zero configuration.
 */
export async function POST(
  req: Request,
): Promise<NextResponse<TriageResponse | ApiError>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Accept either a bare alert or { alert: {...} }.
  const candidate =
    json && typeof json === "object" && "alert" in json
      ? (json as { alert: unknown }).alert
      : json;

  const parsed = alertSchema.safeParse(candidate);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const alert: Alert = { ...parsed.data, status: "new" };
  const started = Date.now();

  // --- Mock fallback: fully functional demo without any keys. ---
  if (!hasAI()) {
    const core = mockTriage(alert);
    const triage = toTriageResult(alert.id, core, {
      mocked: true,
      latencyMs: Date.now() - started,
    });
    return NextResponse.json({ triage });
  }

  // --- Real model call through the AI Gateway. ---
  try {
    const { object } = await generateObject({
      // Sonnet balances triage quality and latency; escalate to frontier for
      // complex investigations if desired.
      model: MODELS.smart,
      schema: triageSchema,
      system: TRIAGE_SYSTEM_PROMPT,
      prompt: buildTriagePrompt(alert),
      temperature: 0.2,
    });

    const triage = toTriageResult(alert.id, object, {
      mocked: false,
      latencyMs: Date.now() - started,
    });
    return NextResponse.json({ triage });
  } catch (err) {
    // Never drop an alert — degrade to the deterministic mock on model error.
    const core = mockTriage(alert);
    const triage = toTriageResult(alert.id, core, {
      mocked: true,
      latencyMs: Date.now() - started,
    });
    return NextResponse.json(
      { triage },
      { headers: { "x-fallback-reason": err instanceof Error ? err.name : "unknown" } },
    );
  }
}
