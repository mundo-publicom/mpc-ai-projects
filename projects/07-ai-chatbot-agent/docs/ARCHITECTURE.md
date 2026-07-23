# Architecture — AI Chatbot Agent

## System diagram

```mermaid
flowchart TB
  subgraph Host["Customer website (any origin)"]
    Loader["&lt;script&gt; widget loader<br/>(data-bot-id)"]
    Widget["ChatWidget<br/>(shadow-DOM iframe)"]
  end

  subgraph Dash["Dashboard (Next.js app)"]
    Page["app/page.tsx"]
    Ingest["IngestPanel"]
    Embed["EmbedSnippet"]
    Preview["ChatWidget preview"]
  end

  subgraph API["API routes (Node runtime / Fluid Compute)"]
    IngestAPI["POST /api/ingest<br/>GET /api/ingest"]
    ChatAPI["POST /api/chat"]
  end

  subgraph Lib["lib/ (domain logic)"]
    Bots["bots.ts<br/>getBot · isOriginAllowed"]
    RAG["rag.ts<br/>chunkText · embed* · store · retrieve"]
    AI["ai.ts<br/>prompt · buildContext · streamText · mocks"]
  end

  subgraph Store["Vector store (per-bot namespaces)"]
    Mem[("In-memory<br/>(dev/demo)")]
    Vec[("Managed vector DB<br/>Pinecone / Upstash (prod)")]
  end

  Gateway["Vercel AI Gateway<br/>embeddings + chat models"]
  Handoff["Slack webhook / email"]

  Loader --> Widget
  Widget -->|"POST /api/chat"| ChatAPI
  Ingest -->|"POST /api/ingest"| IngestAPI
  Preview -->|"POST /api/chat"| ChatAPI
  Page --- Ingest & Embed & Preview

  IngestAPI --> Bots
  ChatAPI --> Bots
  IngestAPI --> RAG
  ChatAPI --> RAG
  ChatAPI --> AI
  RAG --> Store
  RAG -->|"embed / embedMany"| Gateway
  ChatAPI -->|"streamText"| Gateway
  ChatAPI -.->|"on escalation"| Handoff
```

## Ingestion data flow

```mermaid
sequenceDiagram
  participant U as Operator (dashboard)
  participant I as POST /api/ingest
  participant R as lib/rag
  participant G as AI Gateway
  participant S as Vector store

  U->>I: { botId, type, text|url, label }
  I->>I: zod validate · getBot(botId)
  alt type === "url"
    I->>I: fetch(url) → htmlToText()
  end
  I->>R: chunkText(raw)  (size 1000 / overlap 150)
  alt AI key present
    R->>G: embedMany(chunks)
    G-->>R: embeddings
  else no key
    R->>R: mockEmbed(chunk) (deterministic)
  end
  R->>S: addChunks(Chunk[] scoped by botId)
  I-->>U: 201 { source(ready), totalChunks, mocked }
```

## RAG query (request) lifecycle

```mermaid
sequenceDiagram
  participant V as Visitor (widget)
  participant C as POST /api/chat
  participant R as lib/rag.retrieve
  participant S as Vector store
  participant A as lib/ai
  participant G as AI Gateway

  V->>C: { botId, history, message }
  C->>C: zod validate · getBot(botId)
  C->>R: retrieve(botId, message, topK, minScore)
  R->>G: embed(message)  (or mockEmbed)
  R->>S: query(botId, qVec, topK, minScore)  ← tenant-scoped
  S-->>R: RetrievedChunk[]
  R-->>C: results (+ mocked flag)
  C->>A: buildContext(results) → { block, citations }
  C->>A: estimateConfidence(results)
  C->>A: buildChatSystemPrompt(bot, block)
  alt AI key present
    C->>G: streamText(system, messages)
    G-->>V: streamed tokens (text/plain)
  else no key / model error
    C->>A: mockAnswer + streamMock
    A-->>V: streamed mock tokens
  end
  C-->>V: headers x-citations · x-confidence · x-mocked
```

## Data-flow description

1. **Author time (ingestion):** an operator submits text or a URL from the dashboard. The ingest
   route validates the payload, resolves the tenant (`getBot`), extracts readable text (HTML → text
   for URLs), chunks it with overlap, embeds each chunk (real or mock), and writes `Chunk` records —
   each stamped with `botId` — into the vector store. Per-source status (`queued → crawling →
   embedding → ready|failed`) is tracked for the dashboard.
2. **Query time (chat):** the widget posts the conversation history plus the new message. The chat
   route embeds the question, runs a `botId`-scoped cosine top-k query, builds a numbered context
   block and the parallel `Citation[]`, composes a grounding system prompt, and streams the answer
   via `streamText`. Citations and a confidence score travel back in response headers; the widget
   renders tokens as they arrive and shows citation chips when the stream ends.
3. **Escalation (roadmap live):** low confidence, an explicit request, or detected frustration marks
   the conversation `handoff_requested` and posts the transcript to Slack/email.

## Request lifecycle (per HTTP call)

- Enters a stateless Next.js Route Handler on the Node.js runtime (Fluid Compute).
- `zod` validates the body; malformed input returns typed `4xx` JSON.
- Tenant resolution via `getBot`; unknown bots `404`.
- Core work (embed/retrieve/stream) delegated to `lib/`.
- Response: JSON for ingest; a streamed `text/plain` body + metadata headers for chat.
- Failures in the model/embedding layer degrade to mock rather than surfacing an error to the widget.

## Deployment topology

- **Platform:** Vercel. The Next.js app serves the dashboard (static/SSR) and the API routes as
  serverless functions on **Fluid Compute** (Node.js runtime; needed for URL fetching and streaming).
- **Statelessness:** routes hold no session state and scale horizontally.
- **Stateful tier:** the vector store. In dev/demo it is an in-memory singleton pinned to
  `globalThis` (survives hot reload, non-durable). In production it is an external managed vector DB
  (Pinecone/Upstash) behind the same `VectorStore` interface, one namespace per bot. Bots/
  conversations/leads move to Postgres.
- **Widget delivery (roadmap):** a small `/widget.js` loader served from the app origin mounts the
  chat UI in a shadow-DOM iframe on customer sites; it only calls allow-listed API routes.
- **Streaming:** `streamText().toTextStreamResponse()` streams tokens over a standard HTTP response;
  no websockets required.

## Environment / configuration

| Variable | Purpose | Default / fallback |
|----------|---------|--------------------|
| `AI_GATEWAY_API_KEY` | Gateway key for embeddings + chat | unset → mock embeddings & mock streamed answers |
| `ANTHROPIC_API_KEY` | Alternative provider key detected by `hasAI()` | unset |
| `CHAT_MODEL` | Chat model string | `anthropic/claude-sonnet-5` |
| `EMBEDDING_MODEL` | Embedding model string | `openai/text-embedding-3-small` |
| `VECTOR_DB` | Store backend selector | `memory` |
| `PINECONE_API_KEY` / `PINECONE_INDEX` | Pinecone adapter (prod) | unset |
| `UPSTASH_VECTOR_REST_URL` / `_TOKEN` | Upstash Vector adapter (prod) | unset |
| `SLACK_WEBHOOK_URL` | Human-handoff notifications | unset |
| `HANDOFF_EMAIL` | Handoff email recipient | unset |
| `WIDGET_ALLOWED_ORIGINS` | CORS allow-list for the widget | `*` (demo) |

Config principle: the app must boot and demonstrate the full RAG loop with **no** environment
variables set. Keys and DB endpoints are progressive enhancements, not prerequisites.
