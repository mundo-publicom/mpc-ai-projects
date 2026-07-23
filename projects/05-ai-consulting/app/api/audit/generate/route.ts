import { NextResponse } from "next/server";
import { generateObject, hasAI, MODELS } from "@/lib/ai";
import {
  GenerateAuditRequestSchema,
  GenerateAuditResponseSchema,
  type Client,
  type Intake,
} from "@/lib/types";
import {
  AUDIT_SYSTEM_PROMPT,
  AuditDraftSchema,
  buildAuditPrompt,
  finalizeAudit,
  mockAuditDraft,
} from "@/lib/audit";

/** Domain logic runs on the Node.js runtime (Fluid Compute), never edge-only. */
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/audit/generate
 *
 * Accepts intake answers, returns a structured AI-Readiness Audit: readiness
 * score + dimensions, a prioritized opportunity backlog (impact/effort/ROI),
 * and a phased roadmap. Uses `generateObject` + zod for the AI's judgment and
 * deterministic math (`lib/roi.ts`) for every dollar figure. Falls back to a
 * coherent mock audit when no AI key is configured.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = GenerateAuditRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Normalize IDs/timestamps so downstream code has stable references.
  const now = new Date().toISOString();
  const client: Client = {
    id: parsed.data.client.id ?? `client-${Date.now()}`,
    companyName: parsed.data.client.companyName,
    industry: parsed.data.client.industry,
    size: parsed.data.client.size,
    contactName: parsed.data.client.contactName ?? "",
    contactEmail: parsed.data.client.contactEmail ?? "",
    createdAt: parsed.data.client.createdAt ?? now,
  };
  const intake: Intake = { ...parsed.data.intake, clientId: client.id };

  try {
    if (!hasAI()) {
      const audit = finalizeAudit(mockAuditDraft(client, intake), client, intake);
      return NextResponse.json(
        GenerateAuditResponseSchema.parse({
          audit,
          meta: { usedAI: false, model: null, generatedAt: now },
        }),
      );
    }

    const { object: draft } = await generateObject({
      model: MODELS.smart,
      schema: AuditDraftSchema,
      system: AUDIT_SYSTEM_PROMPT,
      prompt: buildAuditPrompt(client, intake),
      temperature: 0.4,
    });

    const audit = finalizeAudit(draft, client, intake);
    return NextResponse.json(
      GenerateAuditResponseSchema.parse({
        audit,
        meta: { usedAI: true, model: MODELS.smart, generatedAt: now },
      }),
    );
  } catch (err) {
    // Never fail the demo: degrade to the deterministic mock on any AI error.
    console.error("[audit/generate] falling back to mock:", err);
    const audit = finalizeAudit(mockAuditDraft(client, intake), client, intake);
    return NextResponse.json(
      GenerateAuditResponseSchema.parse({
        audit,
        meta: { usedAI: false, model: null, generatedAt: now },
      }),
    );
  }
}
