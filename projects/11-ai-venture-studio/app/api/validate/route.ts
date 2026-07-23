import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateObject,
  hasAI,
  MODELS,
  validationSchema,
  VALIDATION_SYSTEM_PROMPT,
  buildValidationPrompt,
  mockValidation,
  assembleReport,
} from "@/lib/ai";
import type { ValidateResponse } from "@/lib/types";

// Node.js runtime (Fluid Compute on Vercel) — the AI SDK and future market-data
// SDKs are not edge-compatible.
export const runtime = "nodejs";
// A full multi-section generation can take a while on the frontier model.
export const maxDuration = 60;

const bodySchema = z.object({
  title: z.string().min(1, "Title is required").max(120),
  description: z.string().min(20, "Describe the idea in at least 20 characters").max(6000),
  market: z.string().max(400).optional(),
  businessModel: z.string().max(400).optional(),
});

/**
 * POST /api/validate
 *
 * Core value path: given a startup idea, return a complete, structured
 * validation report — score, TAM/SAM/SOM with assumptions, competitor scan,
 * customer segments, a Lean Canvas, an MVP feature spec, risks, and landing
 * copy — produced in a single generateObject call against a zod schema.
 *
 * Falls back to a deterministic, idea-aware mock report when no AI key is
 * configured, so the studio is fully demoable with zero setup.
 */
export async function POST(
  req: Request,
): Promise<NextResponse<ValidateResponse>> {
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

  const input = parsed.data;
  const ideaId = crypto.randomUUID();

  // --- Mock fallback: fully functional demo without any keys. ---
  if (!hasAI()) {
    const core = mockValidation(input);
    const report = assembleReport(input, ideaId, core, {
      mocked: true,
      latencyMs: 0,
    });
    return NextResponse.json(report);
  }

  // --- Real model call through the AI Gateway. ---
  const started = Date.now();
  try {
    const { object } = await generateObject({
      // Frontier model: the multi-section structured report benefits from the
      // strongest reasoning; swap to MODELS.smart to trade quality for cost.
      model: MODELS.frontier,
      schema: validationSchema,
      system: VALIDATION_SYSTEM_PROMPT,
      prompt: buildValidationPrompt(input),
      temperature: 0.6,
    });

    const report = assembleReport(input, ideaId, object, {
      mocked: false,
      latencyMs: Date.now() - started,
    });
    return NextResponse.json(report);
  } catch (err) {
    // Never fail the sprint: degrade to the mock report on any model error.
    const core = mockValidation(input);
    const report = assembleReport(input, ideaId, core, {
      mocked: true,
      latencyMs: Date.now() - started,
    });
    return NextResponse.json(report, {
      status: 200,
      headers: { "x-fallback-reason": err instanceof Error ? err.name : "unknown" },
    });
  }
}
