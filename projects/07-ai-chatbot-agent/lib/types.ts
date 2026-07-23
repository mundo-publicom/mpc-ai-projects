/**
 * Domain types for the AI Chatbot Agent platform.
 *
 * These mirror the persisted data models described in docs/TECHNICAL_SPEC.md.
 * Zod schemas that validate API inputs live alongside the routes that use them,
 * but the canonical TypeScript shapes are defined here so the widget, API, and
 * RAG/domain logic all speak the same language.
 *
 * Everything is scoped by `botId` (and, above it, `orgId`) — the single most
 * important invariant of a multi-tenant RAG product is that a bot may only ever
 * retrieve chunks belonging to the same bot. See lib/rag.ts and the spec's
 * "Multi-tenant data isolation" section.
 */

/* ------------------------------------------------------------------ */
/* Enums / unions                                                      */
/* ------------------------------------------------------------------ */

export type PlanTier = "free" | "starter" | "growth" | "scale";

export type SourceType = "url" | "text" | "pdf" | "markdown" | "faq";

export type SourceStatus = "queued" | "crawling" | "embedding" | "ready" | "failed";

export type MessageRole = "system" | "user" | "assistant";

export type ConversationStatus = "active" | "resolved" | "handoff_requested" | "handoff_active" | "abandoned";

export type HandoffChannel = "slack" | "email" | "none";

/* ------------------------------------------------------------------ */
/* Bot                                                                 */
/* ------------------------------------------------------------------ */

export interface BotTheme {
  /** Accent colour for the launcher + user bubbles (hex). */
  primaryColor: string;
  /** Widget position on the host page. */
  position: "bottom-right" | "bottom-left";
  /** Greeting shown when the panel first opens. */
  greeting: string;
  /** Short label under the launcher / in the header. */
  title: string;
}

export interface Bot {
  id: string;
  orgId: string;
  name: string;
  /** Which persona the assistant adopts — steers tone + escalation posture. */
  role: "support" | "sales" | "hybrid";
  /** System instructions layered on top of the retrieved context. */
  systemPrompt: string;
  theme: BotTheme;
  /** Number of chunks to retrieve per turn (top-k). */
  topK: number;
  /** Minimum cosine similarity for a chunk to be considered relevant (0–1). */
  minScore: number;
  /** Collect name/email when intent looks like a lead. */
  leadCapture: boolean;
  /** Offer a human when confidence is low or the visitor asks. */
  humanHandoff: boolean;
  handoffChannel: HandoffChannel;
  plan: PlanTier;
  /** Origins allowed to embed this bot (CORS allow-list). */
  allowedOrigins: string[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Source & Chunk (the knowledge base)                                 */
/* ------------------------------------------------------------------ */

export interface Source {
  id: string;
  botId: string;
  type: SourceType;
  /** Origin URL, filename, or a short label for pasted text. */
  label: string;
  /** Original URL when type === "url". */
  url?: string;
  status: SourceStatus;
  /** Characters of raw text extracted from this source. */
  charCount: number;
  /** Number of chunks produced from this source. */
  chunkCount: number;
  /** Populated when status === "failed". */
  error?: string;
  createdAt: string;
}

export interface Chunk {
  id: string;
  botId: string;
  sourceId: string;
  /** Position of this chunk within its source (0-based). */
  index: number;
  /** The chunk text that gets embedded and injected into the prompt. */
  text: string;
  /** Embedding vector. Length depends on the embedding model. */
  embedding: number[];
  /** Denormalised for fast citation rendering without a Source join. */
  sourceLabel: string;
  sourceUrl?: string;
  createdAt: string;
}

/** A chunk plus the similarity score from a retrieval query. */
export interface RetrievedChunk {
  chunk: Chunk;
  score: number;
}

/* ------------------------------------------------------------------ */
/* Citations                                                           */
/* ------------------------------------------------------------------ */

export interface Citation {
  /** 1-based marker the model is told to reference, e.g. [1]. */
  marker: number;
  chunkId: string;
  sourceId: string;
  sourceLabel: string;
  sourceUrl?: string;
  score: number;
  /** Short snippet shown in the citation chip. */
  snippet: string;
}

/* ------------------------------------------------------------------ */
/* Conversation & Message                                              */
/* ------------------------------------------------------------------ */

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  /** Citations attached to an assistant turn. */
  citations?: Citation[];
  /** True when produced by the mock fallback (no API key). */
  mocked?: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  botId: string;
  /** Anonymous visitor identifier (cookie / localStorage on the host page). */
  visitorId: string;
  status: ConversationStatus;
  /** Origin URL where the conversation started. */
  pageUrl?: string;
  messages: Message[];
  /** Lead captured during this conversation, if any. */
  leadId?: string;
  /** Model-scored 0–1 estimate that the last answer was well-grounded. */
  lastConfidence?: number;
  startedAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Lead                                                                */
/* ------------------------------------------------------------------ */

export interface Lead {
  id: string;
  botId: string;
  conversationId: string;
  name?: string;
  email?: string;
  company?: string;
  /** Free-form context the assistant gathered ("evaluating for a 20-seat team"). */
  notes?: string;
  /** Heuristic 0–100 buying-intent score. */
  score: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* API contracts (shared request/response shapes)                      */
/* ------------------------------------------------------------------ */

export interface IngestRequest {
  botId: string;
  type: SourceType;
  /** Raw text when type !== "url". */
  text?: string;
  /** URL to fetch + extract when type === "url". */
  url?: string;
  label?: string;
}

export interface IngestResponse {
  source: Source;
  /** Total chunks now stored for this bot across all sources. */
  totalChunks: number;
  /** True when embeddings were produced by the mock fallback. */
  mocked: boolean;
}

/** A single chat turn as sent from the widget. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  botId: string;
  /** Conversation so far, oldest first (excludes the newest user message). */
  history: ChatTurn[];
  message: string;
  visitorId?: string;
  pageUrl?: string;
}

/**
 * Chat responses stream as `text/plain`. The retrieval metadata that the
 * stream body cannot carry — citations, confidence, mock flag — is returned in
 * response headers (see app/api/chat/route.ts):
 *   x-citations:  base64-encoded JSON `Citation[]`
 *   x-confidence: number as string
 *   x-mocked:     "true" | "false"
 */
export interface ChatMeta {
  citations: Citation[];
  confidence: number;
  mocked: boolean;
}
