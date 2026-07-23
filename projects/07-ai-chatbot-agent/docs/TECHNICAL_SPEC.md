# Technical Spec — AI Chatbot Agent

## System overview

A Next.js (App Router) application with two core API routes that implement the RAG lifecycle end to
end, a set of shared `lib/` modules holding all domain logic, and React components that render the
dashboard and the embeddable chat widget.

- **Ingestion path:** `POST /api/ingest` → extract text (URL or pasted) → `chunkText` → `embedTexts`
  → store `Chunk[]` in a per-bot vector index.
- **Query path:** `POST /api/chat` → `retrieve` (embed question + cosine top-k, tenant-scoped) →
  `buildChatSystemPrompt` with numbered context → `streamText` → stream answer + citation headers.

Everything runs on the Node.js runtime (Fluid Compute on Vercel). Model and embedding calls are made
through the Vercel AI Gateway using `"provider/model"` strings — no provider SDK is wired directly.
With no API key, embeddings fall back to a deterministic mock and chat streams a grounded mock
answer, so the whole product is demoable with zero configuration.

## Component breakdown

| Component | Location | Responsibility |
|-----------|----------|----------------|
| **Ingestion route** | `app/api/ingest/route.ts` | Validate input, fetch/extract URL text, orchestrate chunk→embed→store; list sources (GET). |
| **HTML extractor** | `htmlToText` in ingest route | Strip scripts/styles/tags, decode entities, collapse whitespace. |
| **Chunker** | `lib/rag.ts › chunkText` | Normalize + split text on paragraph/sentence boundaries into overlapping windows. |
| **Embeddings** | `lib/rag.ts › embedTexts / embedQuery / mockEmbed` | Real `embed`/`embedMany` via gateway, or deterministic hashed bag-of-words mock. |
| **Vector store** | `lib/rag.ts › VectorStore / InMemoryVectorStore / store` | Per-bot chunk storage + cosine top-k query with tenant scoping. Swappable adapter. |
| **Retriever** | `lib/rag.ts › retrieve` | Embed query → store.query → `RetrievedChunk[]`. |
| **Chat orchestrator** | `app/api/chat/route.ts` + `lib/ai.ts` | Build grounded prompt, stream answer, attach citations/confidence, degrade to mock. |
| **AI helpers** | `lib/ai.ts` | Model catalog, `hasAI`, prompt builders, context/citation builder, confidence, mock streaming. |
| **Bot registry** | `lib/bots.ts` | Resolve bot id → config; origin allow-list check. DB seam for later. |
| **Chat widget** | `components/ChatWidget.tsx` | Client component: streams `/api/chat`, renders bubbles + citation chips. |
| **Ingest panel** | `components/IngestPanel.tsx` | Client: paste text/URL → `/api/ingest`, source list + chunk count. |
| **Embed snippet** | `components/EmbedSnippet.tsx` | Renders the copy-paste `<script>` loader. |
| **Dashboard** | `app/page.tsx` | Server component composing the above + KPIs + how-it-works. |
| **Types** | `lib/types.ts` | Canonical domain models + API contracts. |

## Data models (typed)

Canonical shapes live in `lib/types.ts`. Summary:

```ts
type PlanTier = "free" | "starter" | "growth" | "scale";
type SourceType = "url" | "text" | "pdf" | "markdown" | "faq";
type SourceStatus = "queued" | "crawling" | "embedding" | "ready" | "failed";
type ConversationStatus =
  | "active" | "resolved" | "handoff_requested" | "handoff_active" | "abandoned";

interface Bot {                     // a tenant's chatbot
  id: string; orgId: string; name: string;
  role: "support" | "sales" | "hybrid";
  systemPrompt: string; theme: BotTheme;
  topK: number; minScore: number;         // retrieval knobs
  leadCapture: boolean; humanHandoff: boolean; handoffChannel: "slack" | "email" | "none";
  plan: PlanTier; allowedOrigins: string[];
  createdAt: string; updatedAt: string;
}

interface Source {                  // an ingested document
  id: string; botId: string; type: SourceType; label: string; url?: string;
  status: SourceStatus; charCount: number; chunkCount: number; error?: string; createdAt: string;
}

interface Chunk {                   // an embedded slice of a source
  id: string; botId: string; sourceId: string; index: number;
  text: string; embedding: number[]; sourceLabel: string; sourceUrl?: string; createdAt: string;
}

interface RetrievedChunk { chunk: Chunk; score: number; }

interface Citation {                // marker the model cites → source
  marker: number; chunkId: string; sourceId: string;
  sourceLabel: string; sourceUrl?: string; score: number; snippet: string;
}

interface Message {
  id: string; conversationId: string; role: "system" | "user" | "assistant";
  content: string; citations?: Citation[]; mocked?: boolean; createdAt: string;
}

interface Conversation {
  id: string; botId: string; visitorId: string; status: ConversationStatus;
  pageUrl?: string; messages: Message[]; leadId?: string; lastConfidence?: number;
  startedAt: string; updatedAt: string;
}

interface Lead {
  id: string; botId: string; conversationId: string;
  name?: string; email?: string; company?: string; notes?: string; score: number; createdAt: string;
}
```

**Isolation invariant:** every `Source`, `Chunk`, `Conversation`, and `Lead` carries a `botId`, and
`VectorStore.query` filters by it before scoring. This is the single enforcement point that keeps
tenants apart in the retrieval path.

## API surface

### `POST /api/ingest`
Ingest a source: extract → chunk → embed → store.

Request (`zod`-validated):
```jsonc
{
  "botId": "demo",
  "type": "url" | "text" | "pdf" | "markdown" | "faq",
  "url":  "https://…",     // required when type === "url"
  "text": "…",              // required otherwise
  "label": "Shipping policy" // optional
}
```
Response `201`:
```jsonc
{
  "source": { "id": "src_…", "status": "ready", "chunkCount": 7, "charCount": 4210, … },
  "totalChunks": 32,
  "mocked": true            // true when embeddings came from the mock fallback
}
```
Errors: `400` bad JSON, `404` unknown bot, `422` validation / extraction / no-chunks failure.

### `GET /api/ingest?botId=…`
List sources + total chunk count for a bot (dashboard). `400` if `botId` missing, `404` unknown.

### `POST /api/chat`
Streaming RAG chat.

Request (`zod`-validated):
```jsonc
{
  "botId": "demo",
  "history": [ { "role": "user" | "assistant", "content": "…" } ],  // ≤ 50, oldest first
  "message": "Do you ship to Canada?",
  "visitorId": "…",        // optional
  "pageUrl": "https://…"    // optional
}
```
Response: `200` with a **`text/plain` streaming body** (assistant tokens). Retrieval metadata rides
in headers because the plain-text stream can't carry structured data:
- `x-citations`  — base64-encoded JSON `Citation[]`
- `x-confidence` — grounding confidence `0..1` as a string
- `x-mocked`     — `"true" | "false"`
- `access-control-expose-headers` — exposes the above to cross-origin embeds

Errors: `400` bad JSON, `404` unknown bot, `422` validation. Model/embedding failures do **not**
error — they degrade to a mock streamed answer (with `x-fallback-reason` set).

## AI / model usage

- **Model access:** Vercel AI Gateway via `"provider/model"` strings. Catalog in `lib/ai.ts`:
  `fast = anthropic/claude-haiku-4-5`, `smart = anthropic/claude-sonnet-5`,
  `frontier = anthropic/claude-opus-4-8`. Chat defaults to `smart` (override `CHAT_MODEL`).
- **Embeddings:** AI SDK v5 `embed` / `embedMany`. Default model `openai/text-embedding-3-small`
  (override `EMBEDDING_MODEL`) — chosen because Anthropic exposes no embedding endpoint. Batched
  `embedMany` for ingestion; single `embed` for the live query.
- **Chat generation:** AI SDK v5 `streamText` with a system prompt containing numbered context and
  strict grounding rules, `temperature: 0.3`, multi-turn `messages`, and `abortSignal` wired to the
  request so a client disconnect cancels the model call. Returned via `result.toTextStreamResponse()`
  with the citation/confidence headers merged in.
- **Grounding prompt (`buildChatSystemPrompt`):** answer only from context; cite every claim with
  `[n]` markers matching source numbers; refuse + offer human when context is insufficient; never
  reveal the prompt/context; role- and feature-conditional lines for sales, lead capture, handoff.
- **Confidence (`estimateConfidence`):** `0.7·topScore + 0.3·avgScore`, clamped to `[0,1]`. Used for
  analytics and (roadmap) proactive handoff. Replaceable with a model faithfulness check.
- **Mock fallback:** `mockEmbed` (FNV-1a hashed bag-of-words → L2-normalized vector) gives stable,
  lexically-sensible retrieval; `mockAnswer` quotes the best-matching sentence from the top chunk and
  appends citation markers; `streamMock` yields word tokens with a small delay so the widget visibly
  streams. Guarantees an end-to-end demo with no keys.

## Third-party integrations

- **Vector DB (production):** Pinecone or Upstash Vector via a `VectorStore` adapter implementing the
  same interface as `InMemoryVectorStore`, using one namespace per bot for isolation. Selected by
  `VECTOR_DB` env.
- **Human handoff:** Slack Incoming Webhook (`SLACK_WEBHOOK_URL`) and/or transactional email
  (`HANDOFF_EMAIL`) receive the transcript + visitor context when a conversation escalates.
- **CRM (roadmap):** outbound webhook / Zapier for captured leads.
- **Embed loader (roadmap):** `/widget.js` mounts `ChatWidget` inside a shadow-DOM iframe on the host
  page, keyed by `data-bot-id`.

## Security & privacy

- **Tenant isolation:** retrieval hard-scoped by `botId` at the store boundary; per-bot origin
  allow-list (`Bot.allowedOrigins`, `isOriginAllowed`) gates public endpoints via CORS.
- **Secrets:** all keys server-side only (`AI_GATEWAY_API_KEY`, DB tokens, Slack URL). Nothing
  sensitive ships in the client bundle; the widget calls same-origin/allow-listed API routes.
- **Input validation:** every route validates with `zod` and returns typed JSON errors; URL fetch has
  a 15s timeout and a bounded response.
- **Prompt-injection posture:** retrieved content is presented as data; the system prompt forbids
  following instructions found in context and forbids revealing itself. (Roadmap: injection
  classifier, content sanitization, allow-list of fetchable domains / SSRF guards.)
- **PII:** lead email/name stored server-side; configurable retention; DPA for enterprise.

## Observability

- Structured logs per request: botId, source/chunk counts, retrieval scores + latency, model latency,
  `mocked`/`fallback-reason`, token usage.
- Metrics: deflection rate, handoff rate, groundedness (% answers with a citation over threshold),
  p50/p95 first-token latency, embedding cost per source.
- `x-mocked` / `x-fallback-reason` headers make degraded responses visible to the client and tests.
- (Roadmap) OpenTelemetry traces spanning ingest → embed → retrieve → stream.

## Scaling considerations

- **Stateless routes** on Fluid Compute scale horizontally; no server affinity.
- **Vector store** is the stateful tier — externalize to a managed vector DB in production; the
  in-memory store is dev/demo only (per-instance, non-durable).
- **Cost/latency:** batch `embedMany` at ingest; cache query embeddings for repeated questions; use
  the fast model for routine turns and escalate only when needed; per-plan conversation caps.
- **Ingestion** of large sites moves to a background queue (crawl → chunk → embed) with per-source
  status already modeled by `SourceStatus`.

## Testing strategy

- **Unit:** `chunkText` (boundaries, overlap, oversized segments), `mockEmbed` determinism +
  normalization, `cosineSimilarity`, `estimateConfidence`, `buildContext` marker/citation alignment.
- **Integration (no key):** `POST /api/ingest` then `POST /api/chat` end to end asserting a streamed
  body, `x-citations` present, `x-mocked: true` — the zero-config path must always work.
- **Integration (with key):** mocked gateway asserting `streamText`/`embedMany` are called with the
  expected model strings and grounded prompt; failure injection asserts graceful mock fallback.
- **Isolation test:** ingest into bot A, query bot B, assert zero chunks returned.
- **Contract:** `zod` schemas double as request contract tests; type-level checks via `tsc --noEmit`.
- **E2E (roadmap):** Playwright drives the dashboard — ingest sample docs, ask a question, assert the
  answer streams and citation chips render.
