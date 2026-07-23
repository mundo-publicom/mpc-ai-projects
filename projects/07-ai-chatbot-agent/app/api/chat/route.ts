import { z } from "zod";
import type { ModelMessage } from "ai";
import {
  streamText,
  hasAI,
  CHAT_MODEL,
  buildChatSystemPrompt,
  buildContext,
  estimateConfidence,
  mockAnswer,
  streamMock,
} from "@/lib/ai";
import { getBot } from "@/lib/bots";
import { retrieve } from "@/lib/rag";
import type { Citation } from "@/lib/types";

// Node.js runtime (Fluid Compute on Vercel). Streaming responses up to 30s.
export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  botId: z.string().min(1).max(64),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .max(50)
    .default([]),
  message: z.string().min(1).max(4000),
  visitorId: z.string().max(128).optional(),
  pageUrl: z.string().url().optional(),
});

/** Encode retrieval metadata for transport in response headers. */
function metaHeaders(citations: Citation[], confidence: number, mocked: boolean): HeadersInit {
  return {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-citations": Buffer.from(JSON.stringify(citations)).toString("base64"),
    "x-confidence": String(confidence),
    "x-mocked": String(mocked),
    // Expose custom headers to the browser fetch caller (needed for cross-origin embeds).
    "access-control-expose-headers": "x-citations, x-confidence, x-mocked",
  };
}

function jsonError(message: string, status: number, details?: unknown): Response {
  return new Response(JSON.stringify({ error: message, details }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * POST /api/chat
 *
 * Core value path #2: retrieval-augmented streaming chat.
 *   1. Validate + resolve the bot (tenant).
 *   2. Retrieve top-k chunks scoped to this bot.
 *   3. Build a grounded system prompt with numbered context.
 *   4. Stream the answer via `streamText`; citations + confidence ride along in
 *      response headers. When no key is configured, stream a mock answer built
 *      from the retrieved chunks so the widget always streams something useful.
 */
export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("Validation failed", 422, parsed.error.flatten());
  }

  const { botId, history, message } = parsed.data;
  const bot = getBot(botId);
  if (!bot) return jsonError("Unknown botId", 404);

  // --- Retrieval (tenant-scoped) ---
  const { results, mocked: retrievalMocked } = await retrieve(botId, message, bot.topK, bot.minScore);
  const { block, citations } = buildContext(results);
  const confidence = estimateConfidence(results);

  const system = buildChatSystemPrompt(
    {
      name: bot.name,
      role: bot.role,
      systemPrompt: bot.systemPrompt,
      leadCapture: bot.leadCapture,
      humanHandoff: bot.humanHandoff,
    },
    block,
  );

  // --- Mock fallback: stream an answer synthesised from retrieved chunks. ---
  if (!hasAI()) {
    const answer = mockAnswer(message, results);
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const token of streamMock(answer)) {
          controller.enqueue(encoder.encode(token));
        }
        controller.close();
      },
    });
    return new Response(stream, { headers: metaHeaders(citations, confidence, true) });
  }

  // --- Real streaming model call through the AI Gateway. ---
  const messages: ModelMessage[] = history.map((h) =>
    h.role === "user"
      ? { role: "user", content: h.content }
      : { role: "assistant", content: h.content },
  );
  messages.push({ role: "user", content: message });

  try {
    const result = streamText({
      model: CHAT_MODEL,
      system,
      temperature: 0.3,
      messages,
      abortSignal: req.signal,
    });

    // toTextStreamResponse streams the assistant text as text/plain; we attach
    // citation + confidence metadata via headers so the widget can render them.
    return result.toTextStreamResponse({
      headers: metaHeaders(citations, confidence, retrievalMocked),
    });
  } catch (err) {
    // Never leave the widget hanging — degrade to a mock streamed answer.
    const answer = mockAnswer(message, results);
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const token of streamMock(answer)) controller.enqueue(encoder.encode(token));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        ...metaHeaders(citations, confidence, true),
        "x-fallback-reason": err instanceof Error ? err.name : "unknown",
      },
    });
  }
}
