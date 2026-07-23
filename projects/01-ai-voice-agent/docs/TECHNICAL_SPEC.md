# Technical Spec — AI Voice Agent

## System overview

AI Voice Agent is a Next.js (App Router, Node runtime) application plus a
real-time media worker. The Next.js app hosts:

- the **console** (agent config, test-drive, call logs, analytics),
- the **control-plane API** (agents, numbers, calls, converse), and
- the **telephony webhook** that answers calls and hands audio to the media
  worker.

The **media worker** runs the real-time voice loop for each live call:
Twilio media stream (WebSocket) → Deepgram streaming STT → the same `converse`
logic used by the console → ElevenLabs streaming TTS → back to Twilio. The
conversation engine is provider-agnostic: model calls go through the Vercel AI
Gateway using `"provider/model"` strings.

Everything degrades gracefully: with no API keys, `converse` returns realistic
mock replies so the console demo is fully functional.

## Component breakdown

| Component | Responsibility | Location |
| --- | --- | --- |
| Console UI | Configure agents, test-drive, view calls/analytics | `app/page.tsx`, `components/*` |
| Converse API | Produce next agent turn from persona+script+transcript | `app/api/agent/converse/route.ts` |
| Telephony webhook | Answer calls; return TwiML / action plan; consent notice | `app/api/telephony/webhook/route.ts` |
| AI orchestration | Prompt construction, model catalog, schemas, mock fallback | `lib/ai.ts` |
| Domain types | Agent, Call, Transcript, PhoneNumber, Customer, API contracts | `lib/types.ts` |
| Media worker *(M1)* | Real-time STT→LLM→TTS loop over Twilio media stream | `workers/media` *(future)* |
| Persistence *(M2)* | Postgres for agents/calls/transcripts; object store for recordings | `lib/db` *(future)* |
| Integrations *(M3)* | Calendar/CRM/helpdesk tool calls | `lib/integrations` *(future)* |

## Data models (typed)

Canonical shapes live in [`lib/types.ts`](../lib/types.ts). Summary:

```ts
type AgentGoal =
  | "book_appointment" | "qualify_lead" | "tier1_support" | "outbound_reminder";
type VoiceProvider = "elevenlabs" | "deepgram" | "cartesia" | "openai";

interface AgentVoice {
  provider: VoiceProvider;
  voiceId: string;
  speakingRate: number; // 0.5–2.0
  language: string;     // BCP-47, e.g. "en-US"
}

interface Agent {
  id: string; orgId: string;
  name: string; goal: AgentGoal;
  persona: string; script: string;
  voice: AgentVoice;
  temperature: number; // 0–1
  maxTurns: number;
  allowTransfer: boolean; transferNumber?: string;
  active: boolean;
  createdAt: string; updatedAt: string;
}

interface PhoneNumber {
  id: string; orgId: string;
  e164: string; provider: "twilio"; providerSid: string;
  inboundAgentId?: string;
  capabilities: { voice: boolean; sms: boolean };
  createdAt: string;
}

interface Customer {
  id: string; orgId: string;
  phone: string; name?: string; email?: string;
  attributes: Record<string, string | number | boolean>;
  consentToRecord: boolean;
  createdAt: string;
}

interface TranscriptTurn {
  role: "agent" | "caller" | "system";
  text: string;
  startMs: number; endMs?: number;
  confidence?: number; // STT confidence for caller turns
}
interface Transcript { callId: string; turns: TranscriptTurn[]; summary?: string; }

interface Call {
  id: string; orgId: string; agentId: string; customerId?: string; numberId: string;
  direction: "inbound" | "outbound";
  fromE164: string; toE164: string;
  status: "queued" | "ringing" | "in_progress" | "completed" | "failed" | "no_answer" | "voicemail";
  outcome: CallOutcome;
  startedAt: string; endedAt?: string;
  durationSec: number; costUsd: number;
  recordingUrl?: string; transcript?: Transcript;
  createdAt: string;
}
```

### Persistence mapping (M2)

- Postgres tables: `orgs`, `agents`, `phone_numbers`, `customers`, `calls`,
  `transcript_turns` (append-only, indexed by `call_id, startMs`).
- Recordings stored in object storage (S3/R2); only a signed `recordingUrl`
  persisted, and only when consent permits.
- `calls.cost_usd` and billable seconds written by the billing meter at call end.

## API surface (routes + payloads)

### `POST /api/agent/converse`

Produces the agent's next spoken turn. Input validated with `zod`.

Request:
```jsonc
{
  "agent": {
    "name": "Ava",
    "goal": "book_appointment",
    "persona": "Friendly dental receptionist…",
    "script": "Open 9-5 M-F…",       // optional, default ""
    "temperature": 0.4,               // optional 0–1, default 0.4
    "maxTurns": 20                    // optional 1–50, default 20
  },
  "transcript": [                     // optional, default []
    { "role": "agent",  "text": "Thanks for calling Bright Smile, this is Ava." },
    { "role": "caller", "text": "Hi, I need a cleaning." }
  ],
  "utterance": "Do you have anything Friday afternoon?"
}
```

Response (`ConverseResponse`):
```jsonc
{
  "reply": "We do! I can offer four fifteen p.m. on Friday. Does that work?",
  "done": false,
  "outcome": "appointment_booked",
  "mocked": false,
  "latencyMs": 640
}
```

Status codes: `200` success (including safe fallback), `400` invalid JSON,
`422` validation error. On model error the route returns `200` with a mock turn
and an `x-fallback-reason` header — a live call is never dropped.

### `POST /api/telephony/webhook`

Twilio-style voice webhook. Accepts JSON or `application/x-www-form-urlencoded`.

Recognized fields (subset of Twilio's): `CallSid`, `From`, `To`, `CallStatus`,
`Direction`. Content negotiation: `Accept: application/json` returns a JSON
action plan; otherwise returns **TwiML** (`text/xml`).

TwiML for a new call:
```xml
<Response>
  <Say voice="Polly.Joanna">This call may be recorded for quality and training purposes.</Say>
  <Connect>
    <Stream url="wss://<host>/api/telephony/media">
      <Parameter name="callSid" value="CA…" />
    </Stream>
  </Connect>
</Response>
```

JSON plan:
```jsonc
{
  "callSid": "CA…",
  "direction": "inbound",
  "action": "connect_media_stream",
  "mediaStreamUrl": "wss://<host>/api/telephony/media",
  "consentNotice": "This call may be recorded…",
  "twiml": "<Response>…</Response>"
}
```

`GET /api/telephony/webhook` → `{ ok: true }` health check.

### Control-plane routes (M2, sketched)

- `GET/POST/PATCH/DELETE /api/agents[/:id]`
- `GET/POST /api/numbers`, `PATCH /api/numbers/:id` (assign inbound agent)
- `GET /api/calls[/:id]` (list/detail with transcript + summary)
- `POST /api/calls/outbound` (place outbound call / enqueue campaign)

All return typed JSON and validate inputs with `zod`.

## AI / model usage

### Model catalog (`lib/ai.ts`)

```ts
MODELS = {
  fast:     "anthropic/claude-haiku-4-5",   // lowest latency, simple flows
  smart:    "anthropic/claude-sonnet-5",    // default per-turn engine
  frontier: "anthropic/claude-opus-4-8",    // complex support/reasoning
}
```

Routed through the Vercel AI Gateway via `"provider/model"` strings — no
provider SDK wired directly. `hasAI()` gates live calls on
`AI_GATEWAY_API_KEY` / `ANTHROPIC_API_KEY`.

### Per-turn generation

`converse` uses `generateObject` with a `zod` schema (`turnSchema`) so each turn
returns typed `{ reply, done, outcome }` in one round-trip. The system prompt
(`buildSystemPrompt`) encodes:

- persona + objective-specific instructions (per `AgentGoal`),
- the script/knowledge with a hard "never invent facts beyond this" rule,
- **voice-channel rules**: one short turn (~40 words), one question at a time,
  no markdown/symbols, numbers spoken naturally, never claim to be human,
  wrap up before `maxTurns`.

Temperature is agent-configurable (default 0.4) to balance consistency and
naturalness. `done` is OR-ed with a turn-count guard so calls always terminate.

### Real-time voice loop (M1)

For each caller turn on a live call:

```
Twilio media (μ-law 8kHz frames, WS)
      │
      ▼
Deepgram streaming STT  ── partial + final transcripts, endpointing/VAD
      │ (on final / endpoint)
      ▼
converse (Claude via Gateway, generateObject)  ── next agent turn (streamed)
      │ (stream tokens as they arrive)
      ▼
ElevenLabs streaming TTS  ── audio chunks
      │
      ▼
Twilio media out  ── played to caller
```

**Barge-in:** the media worker runs STT continuously even while TTS is playing.
On a confident caller-speech onset (VAD), it (1) sends a Twilio `clear` to stop
current playback, (2) cancels the in-flight TTS stream, and (3) if the caller
produced a new final utterance, cancels/junks the in-flight LLM turn and starts
a new `converse` call. Agent turns are streamed to TTS incrementally so the
first audio starts before the full reply is generated.

### Latency budget (target, per turn)

| Stage | Budget |
| --- | --- |
| Endpointing (caller stops speaking → final) | ~200 ms |
| Network to app + prompt assembly | ~50 ms |
| LLM time-to-first-token | ~350 ms |
| TTS time-to-first-audio | ~150 ms |
| Playback network back to caller | ~100 ms |
| **Caller-perceived response** | **~850 ms (p50), <1.2 s p95** |

Levers: model tier (`fast` for simple agents), token streaming to TTS, keeping
prompts compact (transcript window, not full history), and colocating worker +
providers by region.

### Post-call

After the call ends, a `generateObject` summarization pass produces
`Transcript.summary` and a final `CallOutcome`, plus optional structured
extraction (e.g., booked time, captured lead fields) for CRM/calendar sync.

## Third-party integrations

- **Twilio (Programmable Voice):** number provisioning, inbound/outbound calls,
  `<Connect><Stream>` media streams, transfer (`<Dial>`), recording controls.
- **Deepgram:** streaming speech-to-text (Nova-class) tuned for telephony audio;
  endpointing/VAD for turn detection.
- **ElevenLabs:** low-latency streaming TTS; per-agent voice selection.
  Cartesia / OpenAI TTS are alternate providers behind the same interface.
- **Vercel AI Gateway:** unified model routing, keys, and usage tracking.
- **Calendar/CRM/helpdesk (M3):** Google Calendar / Cal.com, HubSpot /
  Salesforce, Zendesk — invoked as LLM tools during or after the call.

Providers sit behind interfaces (`SttProvider`, `TtsProvider`,
`TelephonyProvider`) so any can be swapped or failed over.

## Security & privacy

- **Recording consent:** the webhook plays a consent notice; for two-party-
  consent regions (`TWO_PARTY_CONSENT_REGIONS`) recording is gated on
  affirmative consent, and consent state is stored on the `Customer`/`Call`.
- **PII:** minimize captured PII; support transcript redaction; encrypt at rest
  (DB + object store) and in transit (TLS/wss). Configurable recording retention
  and deletion (right-to-erasure).
- **Tenant isolation:** every row scoped by `orgId`; queries always filter by
  tenant; per-tenant API keys.
- **Webhook authenticity:** verify Twilio request signatures
  (`X-Twilio-Signature`) using the auth token before acting.
- **Secrets:** only via env (`.env.local`), never committed; least-privilege
  provider keys.
- **AI disclosure & TCPA:** agent discloses it is an AI when asked; outbound
  respects calling windows and DNC lists.
- **Compliance target:** SOC 2 Type II; HIPAA-eligible configuration for medical
  verticals (BAA with subprocessors, no PHI in logs).

## Observability

- **Tracing:** one trace per call, spans per stage (STT, LLM, TTS, telephony)
  with latency; propagate `callSid`.
- **Metrics:** per-turn latency histograms, TTFT/TTFA, barge-in count,
  containment rate, outcome distribution, error/fallback rate, cost per call.
- **Logging:** structured logs keyed by `orgId`/`callSid`; no PII/secrets in
  logs. The converse route emits `x-fallback-reason` when it degrades.
- **Alerting:** p95 latency SLO breach, model/provider error-rate spikes,
  webhook failures, cost-budget thresholds.
- **Call review:** transcript + summary + recording (consent-permitting) in the
  console for QA.

## Scaling considerations

- **Stateless control plane:** Next.js API on Fluid Compute scales
  horizontally; no per-request server state.
- **Media workers:** the stateful part is one WebSocket + audio pipeline per
  live call. Scale as a horizontally autoscaled worker pool (one call ≈ one
  lightweight connection), keyed by region for latency, with graceful drain on
  deploy.
- **Concurrency:** target thousands of simultaneous calls; backpressure and
  provider rate-limit handling; per-tenant concurrency caps.
- **Data:** append-only transcript writes; partition `calls`/`transcript_turns`
  by time; move recordings to object storage.
- **Cost:** model-tier selection per agent, prompt-size discipline, and caching
  of static system prompts.

## Testing strategy

- **Unit:** prompt construction (`buildSystemPrompt`), `mockTurn` per goal,
  `renderTranscript`, XML escaping, zod schemas (valid/invalid payloads).
- **API/integration:** `converse` happy path + validation errors + model-error
  fallback (asserting `x-fallback-reason` and `200`); telephony webhook JSON vs.
  TwiML negotiation and form-encoded parsing.
- **Conversation/eval:** scripted multi-turn scenarios per objective scored for
  goal completion, no-hallucination, TTS-safety (length, no markdown), and
  correct `done`/`outcome`. Run as an LLM-judged eval suite in CI.
- **Latency:** load test the media loop against latency SLOs; synthetic
  audio fixtures through STT→LLM→TTS.
- **E2E:** Playwright drives the console test-drive against a mocked `converse`;
  a staging Twilio number places a real call in a smoke test.
- **Contract:** verify Twilio webhook signature handling and TwiML validity.
