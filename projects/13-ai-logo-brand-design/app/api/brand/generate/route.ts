import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateObject,
  hasAI,
  MODELS,
  brandKitSchema,
  buildSystemPrompt,
  buildUserPrompt,
  mockBrandKit,
  sanitizeSvg,
} from "@/lib/ai";
import { BRAND_STYLES } from "@/lib/types";
import type { BrandKit, GenerateBrandResponse, LogoConcept } from "@/lib/types";

// Node.js runtime (Fluid Compute on Vercel) — avoids edge-only limitations
// and gives headroom for the multi-artifact generation call.
export const runtime = "nodejs";
export const maxDuration = 60;

const briefSchema = z.object({
  name: z.string().min(1, "Brand name is required").max(60),
  industry: z.string().min(1, "Industry is required").max(80),
  values: z.array(z.string().min(1).max(40)).max(8).default([]),
  style: z.enum(BRAND_STYLES),
  description: z.string().max(2000).optional(),
  audience: z.string().max(200).optional(),
});

/**
 * POST /api/brand/generate
 *
 * Core value path: turn a short brief into a full brand kit — 2–3 SVG logo
 * concepts, a color palette with roles, a typography pairing, brand voice, and
 * usage rules — in a single `generateObject` call bound to a strict zod schema.
 *
 * When no API key is present (or a model call fails), returns a deterministic
 * mock kit with REAL inline SVG so the studio is fully demoable offline.
 */
export async function POST(
  req: Request,
): Promise<NextResponse<GenerateBrandResponse | { error: string; details?: unknown }>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = briefSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const brief = parsed.data;
  const started = Date.now();

  // --- Mock fallback: fully functional demo without any keys. ---
  if (!hasAI()) {
    const kit: BrandKit = {
      ...mockBrandKit(brief),
      mocked: true,
      latencyMs: Date.now() - started,
    };
    return NextResponse.json({ kit });
  }

  // --- Real model call through the AI Gateway. ---
  try {
    const { object } = await generateObject({
      model: MODELS.smart,
      schema: brandKitSchema,
      system: buildSystemPrompt(),
      prompt: buildUserPrompt(brief),
      temperature: 0.8,
    });

    const concepts: LogoConcept[] = object.concepts.map((c, i) => ({
      id: `concept-${i + 1}-${c.style}`,
      name: c.name,
      style: c.style,
      svg: sanitizeSvg(c.svg),
      rationale: c.rationale,
    }));

    const kit: BrandKit = {
      brief,
      concepts,
      palette: object.palette,
      typography: object.typography,
      voice: object.voice,
      usageRules: object.usageRules,
      mocked: false,
      latencyMs: Date.now() - started,
    };
    return NextResponse.json({ kit });
  } catch (err) {
    // Never fail the studio — degrade to the deterministic mock kit.
    const kit: BrandKit = {
      ...mockBrandKit(brief),
      mocked: true,
      latencyMs: Date.now() - started,
    };
    return NextResponse.json(
      { kit },
      {
        status: 200,
        headers: {
          "x-fallback-reason": err instanceof Error ? err.name : "unknown",
        },
      },
    );
  }
}
