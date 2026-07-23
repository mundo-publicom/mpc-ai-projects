# AI Chatbot Agent

> An embeddable, RAG-powered support & sales chatbot any website can drop in with one `<script>` tag.

## Business case

Companies drown in repetitive questions that are already answered in their own docs — but customers
won't read docs, and generic LLM chat boxes hallucinate prices and policies, so support teams can't
trust them in public. **AI Chatbot Agent** ingests a customer's docs and URLs, grounds every answer
in that content, and **shows its sources** — turning a support/sales chatbot into something teams
actually trust on their site.

**Who pays:** the site owner — SaaS support/marketing teams and ecommerce operators.
**For what:** ticket **deflection**, instant pre-sales answers, and in-chat **lead capture**.
**Pricing model:** SaaS priced on two value axes — number of **sites/bots** and number of **resolved
conversations** per month, with metered overage.

| Plan | Price / mo | Bots | Conversations / mo | Highlights |
|------|-----------|------|--------------------|-----------|
| Free | $0 | 1 | 100 | Widget + citations, MMAI badge |
| Starter | $49 | 1 | 1,000 | Real embeddings + streaming, lead capture |
| Growth | $199 | 5 | 8,000 | Human handoff, analytics, CRM webhook |
| Scale | $699 | 25 | 40,000 | SSO, audit logs, managed vector DB, SLA |

One deflected ticket (~$5–15 fully loaded) or one captured lead pays for many conversations, so the
usage-based price stays comfortably below the value delivered. Full detail in
[`docs/PRD.md`](docs/PRD.md).

## Features

- **Retrieval-augmented answers** — content is chunked, embedded, and retrieved per question; the
  model answers only from your material.
- **Streaming with citations** — replies stream token-by-token and cite the exact source `[n]` chips
  link back to.
- **Zero-key demo** — with no API key it still ingests (deterministic mock embeddings) and streams a
  grounded mock answer, so the whole product runs out of the box.
- **Lead capture & human handoff** — asks for contact details on buying intent; offers a human (and
  notifies Slack/email) when unsure or asked.
- **Multi-tenant isolation** — retrieval is hard-scoped by bot id; a bot can only ever see its own
  content. Public endpoints enforce a per-bot origin allow-list.
- **One-tag embed** — copy a `<script>` snippet keyed by bot id; theme color, position, greeting.
- **Dashboard** — paste-your-docs ingestion panel, live widget preview, and the embed snippet.

## Quickstart

```bash
# from the monorepo root
pnpm install

# run this project
pnpm --filter @mmai/ai-chatbot-agent dev
# → http://localhost:3000
```

No environment variables are required — the app boots in **demo mode** (mock embeddings + mock
streamed answers with citations). To use real models:

```bash
cp projects/07-ai-chatbot-agent/.env.example projects/07-ai-chatbot-agent/.env.local
# then set AI_GATEWAY_API_KEY (unlocks both embeddings and streaming chat)
```

### Try the full loop

1. Open the dashboard. The **Knowledge base** panel is pre-filled with sample Acme docs — click
   **Ingest**.
2. In the **Live preview** widget, ask *"How much is the Pro plan?"* or *"What's your refund policy?"*
3. Watch the answer stream in and cite the source it came from.
4. Copy the **embed snippet** to see how it drops onto any site.

### Core endpoints

```bash
# Ingest pasted text
curl -X POST localhost:3000/api/ingest \
  -H 'content-type: application/json' \
  -d '{"botId":"demo","type":"text","text":"We ship worldwide in 3-5 days.","label":"Shipping"}'

# Ask a question (streams text/plain; citations in x-citations header)
curl -N -X POST localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{"botId":"demo","history":[],"message":"Do you ship worldwide?"}'
```

## Project structure

```
07-ai-chatbot-agent/
├── app/
│   ├── page.tsx                 # dashboard: ingest panel + live widget + embed snippet
│   ├── layout.tsx · globals.css
│   └── api/
│       ├── ingest/route.ts      # extract → chunk → embed → store  (+ GET list)
│       └── chat/route.ts        # retrieve → streamText → citations
├── components/
│   ├── ChatWidget.tsx           # client, streaming, citation chips
│   ├── IngestPanel.tsx          # paste text / add URL
│   └── EmbedSnippet.tsx         # copy-paste <script>
├── lib/
│   ├── ai.ts                    # models, prompts, context/citations, mocks
│   ├── rag.ts                   # chunking, embeddings, in-memory cosine store
│   ├── bots.ts                  # bot registry + origin allow-list
│   └── types.ts                 # domain models + API contracts
└── docs/  PRD.md · TECHNICAL_SPEC.md · ARCHITECTURE.md
```

## How it works

Ingest → chunk (overlapping windows) → embed (real via AI Gateway, or deterministic mock) → store per
bot. Per question → embed → cosine top-k (tenant-scoped) → grounded prompt with numbered context →
`streamText` → stream answer + citation headers. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the Mermaid diagrams and [`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md) for the full spec.

Built on Next.js (App Router, TS strict), Tailwind, and the Vercel AI SDK v5 (`streamText`, `embed`/
`embedMany`) routed through the Vercel AI Gateway via `"provider/model"` strings.

## Roadmap

- **M1** — managed vector DB adapter (Pinecone/Upstash), Postgres, auth + orgs, real origin enforcement.
- **M2** — live Slack/email handoff, lead scoring + CRM webhook, conversation history UI.
- **M3** — faithfulness scoring, thumbs feedback, deflection/CSAT analytics, scheduled re-crawl.
- **M4** — shadow-DOM `/widget.js` loader, Shopify app, WordPress plugin, A/B greetings.
- **M5** — SSO, audit logs, data residency/VPC vector store, custom model routing, SLA.
