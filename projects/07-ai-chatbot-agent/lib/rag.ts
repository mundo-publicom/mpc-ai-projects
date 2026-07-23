/**
 * RAG core: chunking, embeddings, and an in-memory cosine-similarity retriever.
 *
 * This file is deliberately storage-agnostic at the call sites: the API routes
 * talk to `store` (a per-bot in-memory index) and to `embedTexts` / `retrieve`.
 * Swapping the in-memory store for a managed vector DB (Pinecone, Upstash) is a
 * matter of reimplementing the `VectorStore` interface — nothing else changes.
 *
 * Embeddings degrade gracefully: with an AI Gateway key we call `embedMany`
 * through the gateway; without one we generate DETERMINISTIC pseudo-embeddings
 * (a hashed bag-of-words projection) so retrieval still returns sensibly-ranked
 * chunks and the whole product is demoable with zero configuration.
 */

import { embed, embedMany } from "ai";
import { hasAI, EMBEDDING_MODEL, MOCK_EMBEDDING_DIM } from "./ai";
import type { Chunk, RetrievedChunk, Source } from "./types";

/* ------------------------------------------------------------------ */
/* Chunking                                                            */
/* ------------------------------------------------------------------ */

export interface ChunkOptions {
  /** Target characters per chunk. */
  size: number;
  /** Characters of overlap carried between adjacent chunks (context bleed). */
  overlap: number;
}

export const DEFAULT_CHUNKING: ChunkOptions = { size: 1000, overlap: 150 };

/** Collapse whitespace and strip control chars so chunks embed cleanly. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Split text into overlapping chunks, preferring paragraph and sentence
 * boundaries so we don't cut mid-thought. Greedy accumulation keeps chunks
 * near `size` while never exceeding it by much.
 */
export function chunkText(raw: string, opts: ChunkOptions = DEFAULT_CHUNKING): string[] {
  const text = normalizeText(raw);
  if (!text) return [];

  // Split into candidate segments on paragraph, then sentence boundaries.
  const segments = text
    .split(/\n{2,}/)
    .flatMap((para) => para.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [para])
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const push = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const seg of segments) {
    // A single segment larger than the window: hard-split it.
    if (seg.length > opts.size) {
      push();
      current = "";
      for (let i = 0; i < seg.length; i += opts.size - opts.overlap) {
        chunks.push(seg.slice(i, i + opts.size).trim());
      }
      continue;
    }
    if ((current + " " + seg).trim().length > opts.size) {
      push();
      // Start the next chunk with a tail-overlap of the previous one.
      const tail = current.slice(Math.max(0, current.length - opts.overlap));
      current = (tail + " " + seg).trim();
    } else {
      current = (current + " " + seg).trim();
    }
  }
  push();

  return chunks;
}

/* ------------------------------------------------------------------ */
/* Embeddings                                                          */
/* ------------------------------------------------------------------ */

/**
 * Deterministic mock embedding: a hashed bag-of-words projection into a fixed
 * dimension, L2-normalised. Same text always yields the same vector, and texts
 * that share words land near each other in cosine space — enough for the demo
 * retriever to rank sensibly without any API key.
 */
export function mockEmbed(text: string): number[] {
  const vec = new Array<number>(MOCK_EMBEDDING_DIM).fill(0);
  const tokens = normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  for (const tok of tokens) {
    // FNV-1a hash → bucket + sign, so features spread across dimensions.
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const bucket = Math.abs(h) % MOCK_EMBEDDING_DIM;
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[bucket] += sign;
  }

  return l2normalize(vec);
}

/** Embed many texts. Real model when a key is present, mock otherwise. */
export async function embedTexts(texts: string[]): Promise<{ embeddings: number[][]; mocked: boolean }> {
  if (texts.length === 0) return { embeddings: [], mocked: !hasAI() };

  if (!hasAI()) {
    return { embeddings: texts.map(mockEmbed), mocked: true };
  }

  try {
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: texts,
    });
    return { embeddings, mocked: false };
  } catch {
    // Never fail ingestion on a transient embedding error — fall back to mock.
    return { embeddings: texts.map(mockEmbed), mocked: true };
  }
}

/** Embed a single query. Real model when a key is present, mock otherwise. */
export async function embedQuery(text: string): Promise<{ embedding: number[]; mocked: boolean }> {
  if (!hasAI()) return { embedding: mockEmbed(text), mocked: true };
  try {
    const { embedding } = await embed({ model: EMBEDDING_MODEL, value: text });
    return { embedding, mocked: false };
  } catch {
    return { embedding: mockEmbed(text), mocked: true };
  }
}

/* ------------------------------------------------------------------ */
/* Vector math                                                         */
/* ------------------------------------------------------------------ */

export function l2normalize(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

/** Cosine similarity. Assumes inputs are already L2-normalised-ish; robust if not. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}

/* ------------------------------------------------------------------ */
/* In-memory multi-tenant vector store                                 */
/* ------------------------------------------------------------------ */

/**
 * Minimal store interface. The in-memory implementation below is the default;
 * a production adapter (Pinecone/Upstash) would implement the same surface and
 * enforce the same per-bot namespace isolation.
 */
export interface VectorStore {
  addSource(source: Source): void;
  updateSource(id: string, patch: Partial<Source>): void;
  listSources(botId: string): Source[];
  addChunks(chunks: Chunk[]): void;
  /** Top-k retrieval, HARD-scoped to a single botId (tenant isolation). */
  query(botId: string, queryEmbedding: number[], topK: number, minScore: number): RetrievedChunk[];
  countChunks(botId: string): number;
  clear(botId: string): void;
}

class InMemoryVectorStore implements VectorStore {
  private sources = new Map<string, Source>();
  private chunks: Chunk[] = [];

  addSource(source: Source): void {
    this.sources.set(source.id, source);
  }

  updateSource(id: string, patch: Partial<Source>): void {
    const existing = this.sources.get(id);
    if (existing) this.sources.set(id, { ...existing, ...patch });
  }

  listSources(botId: string): Source[] {
    return [...this.sources.values()]
      .filter((s) => s.botId === botId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  addChunks(chunks: Chunk[]): void {
    this.chunks.push(...chunks);
  }

  query(botId: string, queryEmbedding: number[], topK: number, minScore: number): RetrievedChunk[] {
    return this.chunks
      // TENANT ISOLATION: only ever consider this bot's chunks.
      .filter((c) => c.botId === botId)
      .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  countChunks(botId: string): number {
    return this.chunks.filter((c) => c.botId === botId).length;
  }

  clear(botId: string): void {
    this.chunks = this.chunks.filter((c) => c.botId !== botId);
    for (const [id, s] of this.sources) if (s.botId === botId) this.sources.delete(id);
  }
}

/**
 * Singleton store. In dev, Next.js hot-reload re-evaluates modules, so we stash
 * the instance on `globalThis` to preserve ingested data across reloads.
 */
const globalForStore = globalThis as unknown as { __ragStore?: VectorStore };
export const store: VectorStore = globalForStore.__ragStore ?? new InMemoryVectorStore();
if (process.env.NODE_ENV !== "production") globalForStore.__ragStore = store;

/* ------------------------------------------------------------------ */
/* Retrieval orchestration                                             */
/* ------------------------------------------------------------------ */

/** Embed a user query and retrieve the most relevant chunks for a bot. */
export async function retrieve(
  botId: string,
  query: string,
  topK: number,
  minScore: number,
): Promise<{ results: RetrievedChunk[]; mocked: boolean }> {
  const { embedding, mocked } = await embedQuery(query);
  const results = store.query(botId, embedding, topK, minScore);
  return { results, mocked };
}
