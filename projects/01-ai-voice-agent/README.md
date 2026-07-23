# AI Voice Agent

**Business case.** Businesses lose revenue every time a phone rings and no one
answers, and they overpay for human agents to handle repetitive calls. AI Voice
Agent lets any business stand up an AI phone/web agent — a configured persona,
script, and voice tied to a phone number — that books appointments, qualifies
leads, and resolves tier-1 support 24/7. **Who pays:** SMBs and mid-market teams
(dental/medical, home services, real estate, dealerships, SaaS support). **For
what:** per-minute conversation usage, a per-seat SaaS subscription for the
console + integrations, and one-time setup/onboarding fees. Blended economics
target ~$0.14/min of billable revenue against ~$0.04–0.06/min of STT+LLM+TTS+
telephony cost, i.e. healthy usage-based margin on top of recurring seats.

## What it does

- **Inbound & outbound voice** — answers incoming calls and runs outbound
  campaigns (reminders, follow-ups, reactivation).
- **Configurable agents** — persona + script/knowledge + voice + objective
  (book appointment, qualify lead, tier-1 support, outbound reminder).
- **Real conversations** — a streaming STT → LLM → TTS loop with barge-in so
  callers can interrupt naturally.
- **Outcomes & analytics** — every call is transcribed, summarized, classified
  (booked / qualified / resolved / escalated), and billed by the second.
- **Graceful escalation** — warm-transfers to a human when confidence is low or
  the caller asks.

## Core end-to-end path (works today)

`components/CallSimulator` → `POST /api/agent/converse` → `lib/ai.ts`
(`generateObject` with the agent's persona system prompt) → typed
`{ reply, done, outcome }`. This is the **same server path** the production
telephony media stream calls for each caller turn. With **no API key**, the
route returns realistic goal-aware mock replies so the whole product is
demoable with zero configuration.

`POST /api/telephony/webhook` is the Twilio-style entry point: it normalizes a
call event and returns TwiML (`<Connect><Stream>`) or a JSON action plan,
including the recording-consent notice.

## Quickstart

```bash
pnpm install        # from the monorepo root
pnpm --filter @mmai/ai-voice-agent dev
# open http://localhost:3000
```

Runs immediately in **demo mode**. To enable live model replies:

```bash
cp .env.example .env.local
# set AI_GATEWAY_API_KEY (or ANTHROPIC_API_KEY)
```

For real phone calls, add the Twilio / Deepgram / ElevenLabs keys documented in
`.env.example` and point your Twilio number's voice webhook at
`${PUBLIC_BASE_URL}/api/telephony/webhook`.

Test the API directly:

```bash
curl -s localhost:3000/api/agent/converse \
  -H 'content-type: application/json' \
  -d '{"agent":{"name":"Ava","goal":"book_appointment","persona":"Friendly dental receptionist","script":"Open 9-5 M-F."},"transcript":[],"utterance":"Hi, I need a cleaning."}' | jq
```

## Architecture (summary)

Next.js App Router (Node runtime) hosts the console and the API. Twilio handles
PSTN/number provisioning and streams call audio over a WebSocket media stream.
Each caller turn flows: Deepgram STT → `converse` (Claude via AI Gateway,
`generateObject`) → ElevenLabs TTS → back to Twilio. Domain types live in
`lib/types.ts`; model orchestration and prompt construction in `lib/ai.ts`.
Full diagrams and the real-time latency budget are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

- **PRD:** [`docs/PRD.md`](docs/PRD.md)
- **Technical spec:** [`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Roadmap

1. **MVP (now)** — console, agent config, converse loop, telephony webhook stub, demo mode.
2. **Live calling** — Twilio media-stream WebSocket, Deepgram streaming STT, ElevenLabs streaming TTS, barge-in.
3. **Persistence & analytics** — Postgres for agents/calls/transcripts, dashboards, billing meter.
4. **Integrations** — calendar (Google/Cal.com), CRM (HubSpot/Salesforce), helpdesk (Zendesk).
5. **Scale & compliance** — multi-tenant orgs, SOC 2, consent management, per-region recording rules, warm transfer + voicemail detection.

## Tech

Next.js 15 · TypeScript (strict) · Tailwind · Vercel AI SDK v5 (`ai`) · zod.
Part of the **Make-Money-with-AI** portfolio.
