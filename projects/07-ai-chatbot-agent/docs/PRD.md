# PRD — AI Chatbot Agent

## Overview

AI Chatbot Agent is an embeddable, RAG-powered support and sales chatbot that any website can drop
in with a single `<script>` tag. A customer ingests their knowledge (docs, help-center URLs, FAQs,
pasted text); the platform chunks and embeds that content into a per-bot vector index. When a
visitor asks a question, the bot retrieves the most relevant chunks, streams a grounded answer with
inline **citations**, captures **leads** when buying intent appears, and offers **human handoff**
when it is unsure or asked. It is sold as a SaaS, priced per site and per conversation.

The product's wedge is trust: unlike a bare LLM chat box, every answer is grounded in the customer's
own content and shows its sources, which is what makes support teams comfortable deflecting real
tickets to it.

## Problem

- Support teams are buried in repetitive questions already answered in their docs, but customers
  won't read the docs — they want a direct answer.
- Generic LLM chatbots hallucinate, invent prices/policies, and can't cite where an answer came
  from, so companies can't trust them on their public site.
- Existing "AI agent" products are expensive, heavy to configure, or lock answers inside a black
  box with no visibility into grounding or data isolation.
- Marketers and ecommerce owners lose high-intent visitors who bounce because no one answers a
  pre-sales question at the moment of interest.

## Target users & personas

1. **SaaS Support Lead ("Dana")** — owns deflection rate and CSAT. Wants to cut ticket volume
   without hurting satisfaction. Cares about answer accuracy, citations, easy escalation to human,
   and analytics proving deflection.
2. **Ecommerce Owner ("Marco")** — runs a mid-size Shopify store. Wants pre-sales questions
   (sizing, shipping, returns) answered instantly to lift conversion, and abandoned-cart visitors
   nudged. Non-technical; needs a copy-paste embed and self-serve ingestion.
3. **Growth Marketer ("Priya")** — wants the chatbot to capture qualified leads from the website,
   sync them to CRM, and A/B test greetings/CTAs. Cares about leads captured and cost per lead.

## User stories

- As Dana, I paste our help-center URLs and pasted policies, and the bot answers customer questions
  citing the exact article, so I can trust it on our public site.
- As Dana, when the bot is unsure or the customer is frustrated, it offers a human and posts the
  transcript to our Slack, so nothing falls through the cracks.
- As Marco, I copy one script tag into my theme and the widget appears in my brand color, so I ship
  it in five minutes without a developer.
- As Marco, a shopper asks "do you ship to Canada?" and gets an instant, correct answer with a link
  to the shipping page, so they check out instead of bouncing.
- As Priya, when a visitor shows buying intent the bot naturally asks for their email, creates a
  scored lead, and I see it in the dashboard, so sales can follow up.
- As any operator, I trust that my bot can only ever retrieve my own content — never another
  tenant's — because retrieval is hard-scoped by bot id.

## Functional requirements

1. **Ingestion**
   1. Accept pasted text, Markdown, and public URLs; extract readable text from HTML.
   2. Normalize and chunk text with configurable size/overlap.
   3. Embed chunks (real embedding model when a key is present; deterministic mock otherwise).
   4. Store chunks in a per-bot vector index; expose ingestion status per source.
   5. List, and allow re-ingest/removal of, sources per bot.
2. **Retrieval & chat**
   1. Embed the visitor's question and retrieve top-k chunks by cosine similarity, scoped to the bot.
   2. Apply a minimum-score threshold; when nothing clears it, answer "I don't know" + offer human.
   3. Build a grounded system prompt with numbered context and strict no-hallucination rules.
   4. Stream the answer token-by-token via the AI SDK `streamText`.
   5. Return citations (marker → source label/URL/snippet/score) alongside the stream.
   6. Maintain multi-turn conversation history.
3. **Lead capture** — detect buying intent; ask for name/email in-conversation; persist a scored
   `Lead` linked to the conversation.
4. **Human handoff** — on low confidence, explicit request, or frustration, offer escalation and
   notify a Slack webhook / email with the transcript; mark the conversation `handoff_requested`.
5. **Embedding on customer sites** — one `<script>` loader keyed by bot id; per-bot origin
   allow-list (CORS); theme (color, position, greeting, title).
6. **Dashboard** — ingest panel, live widget preview, embed snippet, source list, and (roadmap)
   conversation/lead analytics.
7. **Graceful degradation** — with no API key the product still ingests (mock embeddings) and
   streams a grounded mock answer with citations, so it is fully demoable.

## Non-functional requirements

- **Latency:** first streamed token < 1.5s p50 on the balanced chat model; retrieval < 150ms for
  in-memory / < 400ms for managed vector DB.
- **Accuracy/trust:** every factual claim must carry a citation; the bot must refuse rather than
  guess when context is insufficient.
- **Multi-tenant isolation:** a query for bot A can never return bot B's chunks. Enforced at the
  store query boundary and by origin allow-lists on public endpoints.
- **Availability:** 99.9% for the chat endpoint; model/embedding errors degrade to mock rather than
  erroring the widget.
- **Security/privacy:** no secrets in the client bundle; PII (lead email) stored server-side;
  configurable data retention.
- **Scalability:** stateless API routes on Fluid Compute; vector store externalized in production.
- **Accessibility:** keyboard-operable widget, ARIA roles, respects reduced motion.

## Success metrics / KPIs

- **Deflection rate** — % of conversations resolved without human handoff (north-star). Target 60%+.
- **CSAT** — thumbs-up rate / survey on answered conversations. Target 4.4/5+.
- **Leads captured** — count and cost-per-lead from in-chat capture.
- **Answer groundedness** — % of answers with ≥1 citation above score threshold; hallucination
  complaints per 1k conversations (inverse).
- **Time-to-value** — minutes from signup to first embedded, answering bot. Target < 10 min.
- **Activation** — % of new bots that ingest ≥1 source and embed the widget within 7 days.

## Monetization & pricing

SaaS, priced on two axes that track the value delivered: number of **sites/bots** and number of
**resolved conversations** per month. Overages are metered.

| Plan | Price / mo | Bots | Conversations / mo | Sources | Key features |
|------|-----------|------|--------------------|---------|--------------|
| **Free** | $0 | 1 | 100 | 25 | Widget, citations, mock/basic model, MMAI badge |
| **Starter** | $49 | 1 | 1,000 | 200 | Real embeddings + streaming, lead capture, remove badge |
| **Growth** | $199 | 5 | 8,000 | 2,000 | Human handoff (Slack/email), analytics, CRM webhook, A/B greetings |
| **Scale** | $699 | 25 | 40,000 | 20,000 | SSO, audit logs, managed vector DB, custom model routing, SLA |
| **Enterprise** | Custom | ∞ | Custom | ∞ | On-prem/VPC vector store, DPA, dedicated support |

- **Conversation overage:** $0.02–$0.05 per resolved conversation above plan.
- **Gross-margin lever:** cheap retrieval + a fast/small model for most turns; escalate to a smarter
  model only for complex support flows.
- **Who pays:** the site owner (SaaS support/marketing budget or ecommerce ops). Value framing:
  one deflected ticket (~$5–15 fully loaded) or one captured lead pays for many conversations.

## Go-to-market

- **Self-serve PLG:** free tier with a visible badge that links back, driving virality; time-to-value
  under 10 minutes via copy-paste embed.
- **Channel/marketplace:** Shopify App Store and WordPress plugin for ecommerce; Zapier/CRM
  integrations for marketers.
- **Content-led:** "RAG chatbot that cites its sources" comparison content vs. incumbents; template
  gallery (SaaS docs bot, returns-policy bot, pricing bot).
- **Outbound:** target support leads at Series A–C SaaS with ticket-deflection ROI calculators.

## Competitive landscape

| Product | Position | Where we win |
|---------|----------|--------------|
| **Intercom Fin** | Premium AI agent bolted onto Intercom's suite; per-resolution pricing | Cheaper, standalone (no Intercom lock-in), transparent citations, self-serve embed |
| **Chatbase** | Popular self-serve "chatbot from your data" | Stronger grounding/citations, human handoff + lead scoring, clearer multi-tenant isolation story |
| **Sierra** | High-touch enterprise conversational AI agents | We serve SMB/mid-market self-serve with minutes-to-value; not a services engagement |
| **Ada** | Enterprise automation platform, no-code flows | Lighter, developer-friendly embed + API, lower entry price, retrieval-first rather than flow-first |

Differentiators: citations by default, graceful zero-key demo, explicit tenant isolation, and a
usage-based price that aligns with deflection value.

## Risks & mitigations

- **Hallucination / wrong answers.** Mitigate with strict grounding prompt (answer only from
  context), minimum-score threshold, mandatory citations, "I don't know → offer human" fallback,
  and (roadmap) a model-scored faithfulness check before sending.
- **Cross-tenant data leakage.** Retrieval is hard-scoped by bot id at the store boundary; public
  endpoints enforce per-bot origin allow-lists; keys never reach the client.
- **Prompt injection via ingested content or user messages.** Treat retrieved text as data, not
  instructions; never expose system prompt/context; (roadmap) injection classifier + content
  sanitization.
- **Cost blow-ups.** Small/fast model for most turns, cheap retrieval, per-plan conversation caps
  with metered overage; cache embeddings.
- **Stale knowledge.** Scheduled re-crawl of URL sources; show source freshness; manual re-ingest.
- **PII handling.** Store lead PII server-side only; configurable retention; DPA for enterprise.
- **Widget breaking host sites.** Ship in a shadow-DOM/iframe sandbox so host CSS/JS can't collide.

## Out of scope (v1)

- Voice / phone channel (covered by a separate product in the portfolio).
- Deep no-code decision-tree flow builder (retrieval-first, not flow-first).
- Native mobile SDKs.
- Fine-tuning customer-specific models (we rely on RAG, not fine-tuning).
- Full ticketing/CRM system (we integrate, we don't replace).

## Milestones / roadmap

- **M0 — Scaffold (this repo):** ingestion (text/URL) → chunk → embed → in-memory retrieval;
  streaming RAG chat with citations; dashboard with live preview, ingest panel, embed snippet;
  graceful mock fallback.
- **M1 — Persistence & tenancy:** managed vector DB adapter (Pinecone/Upstash), Postgres for bots/
  conversations/leads, auth + orgs, real per-bot origin enforcement.
- **M2 — Handoff & leads:** Slack/email handoff live, lead scoring + CRM webhook, conversation
  history UI.
- **M3 — Trust & analytics:** faithfulness scoring, thumbs feedback, deflection/CSAT dashboards,
  scheduled re-crawl.
- **M4 — Distribution:** shadow-DOM widget loader (`/widget.js`), Shopify app, WordPress plugin,
  A/B greetings, template gallery.
- **M5 — Enterprise:** SSO, audit logs, data residency/VPC vector store, SLA, custom model routing.
