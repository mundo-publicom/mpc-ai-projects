import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * Telephony webhook (Twilio-style) — stub.
 *
 * In production Twilio POSTs form-encoded call events here. We normalize the
 * payload, decide how to handle the call, and return TwiML-like instructions.
 * Twilio expects XML; many stacks (and Twilio's own <Connect><Stream>) also
 * drive a media-stream WebSocket where the real-time STT→LLM→TTS loop lives.
 *
 * This stub accepts either JSON or form-encoded bodies so it is trivially
 * testable with curl, and returns both a structured JSON plan and (for
 * incoming voice calls) a TwiML document.
 */

const eventSchema = z.object({
  // Common Twilio voice webhook fields (subset).
  CallSid: z.string().default("CA_demo"),
  From: z.string().default("+10000000000"),
  To: z.string().default("+10000000001"),
  CallStatus: z
    .enum([
      "queued",
      "ringing",
      "in-progress",
      "completed",
      "busy",
      "failed",
      "no-answer",
    ])
    .default("ringing"),
  Direction: z.enum(["inbound", "outbound-api", "outbound-dial"]).default("inbound"),
});

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await req.json()) as Record<string, unknown>;
  }
  // Twilio sends application/x-www-form-urlencoded.
  const form = await req.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) out[k] = typeof v === "string" ? v : v.name;
  return out;
}

/** Escapes text destined for a TwiML/XML document. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: Request) {
  let raw: Record<string, unknown>;
  try {
    raw = await readBody(req);
  } catch {
    return NextResponse.json({ error: "Unreadable body" }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const evt = parsed.data;
  const base = process.env.PUBLIC_BASE_URL ?? "https://example.com";
  const streamUrl = base.replace(/^http/, "ws") + "/api/telephony/media";

  // Decide the plan. For a new inbound/ringing call we answer, announce the
  // recording consent notice, then hand the audio to the media stream where
  // the STT→LLM→TTS loop runs.
  const isNewCall = evt.CallStatus === "ringing" || evt.CallStatus === "in-progress";

  const consentNotice =
    "This call may be recorded for quality and training purposes.";

  const twiml = isNewCall
    ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${xmlEscape(consentNotice)}</Say>
  <Connect>
    <Stream url="${xmlEscape(streamUrl)}">
      <Parameter name="callSid" value="${xmlEscape(evt.CallSid)}" />
    </Stream>
  </Connect>
</Response>`
    : `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup />
</Response>`;

  // Content negotiation: Twilio wants XML; API clients can request JSON.
  const wantsJson = (req.headers.get("accept") ?? "").includes("application/json");

  const plan = {
    callSid: evt.CallSid,
    direction: evt.Direction.startsWith("outbound") ? "outbound" : "inbound",
    action: isNewCall ? "connect_media_stream" : "hangup",
    mediaStreamUrl: streamUrl,
    consentNotice,
    twiml,
  };

  if (wantsJson) {
    return NextResponse.json(plan);
  }

  return new NextResponse(twiml, {
    status: 200,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

export async function GET() {
  // Health/verification endpoint some providers ping on configuration.
  return NextResponse.json({ ok: true, service: "telephony-webhook" });
}
