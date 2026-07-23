import { NextResponse } from "next/server";
import { z } from "zod";
import { getBot } from "@/lib/bots";
import { chunkText, embedTexts, store } from "@/lib/rag";
import type { Chunk, IngestResponse, Source } from "@/lib/types";

// Node.js runtime (Fluid Compute on Vercel) — we fetch + parse remote URLs.
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z
  .object({
    botId: z.string().min(1).max(64),
    type: z.enum(["url", "text", "pdf", "markdown", "faq"]),
    text: z.string().max(500_000).optional(),
    url: z.string().url().optional(),
    label: z.string().max(200).optional(),
  })
  .refine((b) => (b.type === "url" ? Boolean(b.url) : Boolean(b.text)), {
    message: "Provide `url` for type 'url', otherwise provide `text`.",
  });

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/**
 * Very light HTML → text extraction. Strips scripts/styles and tags, decodes a
 * few common entities, and collapses whitespace. A production ingester would
 * use a readability/boilerplate remover, but this keeps the scaffold dependency
 * free while producing usable text from most pages.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function extractFromUrl(url: string): Promise<{ text: string; label: string }> {
  const res = await fetch(url, {
    headers: { "user-agent": "AIChatbotAgent-Ingester/0.1 (+https://example.com)" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  const text = contentType.includes("html") ? htmlToText(raw) : raw;
  const titleMatch = raw.match(/<title[^>]*>([^<]*)<\/title>/i);
  const label = titleMatch?.[1]?.trim() || new URL(url).hostname;
  return { text, label };
}

/**
 * POST /api/ingest
 *
 * Core value path #1: accept a URL or pasted text, extract → chunk → embed →
 * store in the per-bot vector index. Embeddings are real when a key is present
 * and deterministic mocks otherwise, so ingestion always succeeds.
 */
export async function POST(
  req: Request,
): Promise<NextResponse<IngestResponse | { error: string; details?: unknown }>> {
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

  const { botId, type, text, url, label } = parsed.data;
  const bot = getBot(botId);
  if (!bot) return NextResponse.json({ error: "Unknown botId" }, { status: 404 });

  const now = new Date().toISOString();
  const source: Source = {
    id: id("src"),
    botId,
    type,
    label: label || (type === "url" ? url! : "Pasted text"),
    url: type === "url" ? url : undefined,
    status: "queued",
    charCount: 0,
    chunkCount: 0,
    createdAt: now,
  };
  store.addSource(source);

  try {
    // 1) Extract raw text.
    store.updateSource(source.id, { status: type === "url" ? "crawling" : "embedding" });
    let raw = text ?? "";
    let resolvedLabel = source.label;
    if (type === "url") {
      const extracted = await extractFromUrl(url!);
      raw = extracted.text;
      resolvedLabel = label || extracted.label;
    }
    if (!raw.trim()) throw new Error("No extractable text found in source");

    // 2) Chunk.
    const chunkStrings = chunkText(raw);
    if (chunkStrings.length === 0) throw new Error("Source produced no chunks");

    // 3) Embed (real or mock).
    store.updateSource(source.id, { status: "embedding" });
    const { embeddings, mocked } = await embedTexts(chunkStrings);

    // 4) Store chunks, hard-scoped to this bot.
    const chunks: Chunk[] = chunkStrings.map((t, i) => ({
      id: id("chk"),
      botId,
      sourceId: source.id,
      index: i,
      text: t,
      embedding: embeddings[i],
      sourceLabel: resolvedLabel,
      sourceUrl: source.url,
      createdAt: new Date().toISOString(),
    }));
    store.addChunks(chunks);

    const ready: Source = {
      ...source,
      label: resolvedLabel,
      status: "ready",
      charCount: raw.length,
      chunkCount: chunks.length,
    };
    store.updateSource(source.id, ready);

    const res: IngestResponse = {
      source: ready,
      totalChunks: store.countChunks(botId),
      mocked,
    };
    return NextResponse.json(res, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    store.updateSource(source.id, { status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

/**
 * GET /api/ingest?botId=... — list ingested sources for a bot (dashboard).
 */
export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("botId");
  if (!botId) return NextResponse.json({ error: "botId query param required" }, { status: 400 });
  if (!getBot(botId)) return NextResponse.json({ error: "Unknown botId" }, { status: 404 });
  return NextResponse.json({
    sources: store.listSources(botId),
    totalChunks: store.countChunks(botId),
  });
}
