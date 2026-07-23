import { NextResponse } from "next/server";
import { leadsToCsv } from "@/lib/csv";
import { ExportLeadsRequestSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leads/export
 * Body: { leads: Lead[], format?: "csv" }
 * Returns a CSV file download of the provided leads.
 */
export async function POST(req: Request): Promise<NextResponse | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ExportLeadsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const csv = leadsToCsv(parsed.data.leads);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
