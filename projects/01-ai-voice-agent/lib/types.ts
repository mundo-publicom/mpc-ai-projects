/**
 * Domain types for the AI Voice Agent platform.
 *
 * These mirror the persisted data models described in docs/TECHNICAL_SPEC.md.
 * Zod schemas that validate API inputs live alongside the routes that use them,
 * but the canonical TypeScript shapes are defined here so UI, API, and domain
 * logic all speak the same language.
 */

/* ------------------------------------------------------------------ */
/* Enums / unions                                                      */
/* ------------------------------------------------------------------ */

export type VoiceProvider = "elevenlabs" | "deepgram" | "cartesia" | "openai";

export type AgentGoal =
  | "book_appointment"
  | "qualify_lead"
  | "tier1_support"
  | "outbound_reminder";

export type CallDirection = "inbound" | "outbound";

export type CallStatus =
  | "queued"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_answer"
  | "voicemail";

export type CallOutcome =
  | "appointment_booked"
  | "lead_qualified"
  | "resolved"
  | "escalated"
  | "callback_requested"
  | "abandoned"
  | "unknown";

export type TranscriptRole = "agent" | "caller" | "system";

/* ------------------------------------------------------------------ */
/* Agent                                                               */
/* ------------------------------------------------------------------ */

export interface AgentVoice {
  provider: VoiceProvider;
  /** Provider-specific voice identifier, e.g. an ElevenLabs voice_id. */
  voiceId: string;
  /** 0.5–2.0 playback rate multiplier. */
  speakingRate: number;
  /** Language/locale BCP-47 tag, e.g. "en-US". */
  language: string;
}

export interface Agent {
  id: string;
  orgId: string;
  name: string;
  goal: AgentGoal;
  /** Human-authored persona description ("friendly dental receptionist named Ava"). */
  persona: string;
  /** The conversation script / knowledge the agent must follow. */
  script: string;
  voice: AgentVoice;
  /** LLM sampling temperature for reply generation (0–1). */
  temperature: number;
  /** Hard limit before the agent wraps up and offers a human callback. */
  maxTurns: number;
  /** Whether the agent may transfer to a human. */
  allowTransfer: boolean;
  /** E.164 destination for warm transfers / escalations. */
  transferNumber?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Phone number                                                        */
/* ------------------------------------------------------------------ */

export interface PhoneNumber {
  id: string;
  orgId: string;
  /** E.164, e.g. "+14155550123". */
  e164: string;
  provider: "twilio";
  /** Provider-side SID for the number resource. */
  providerSid: string;
  /** Agent that answers inbound calls to this number. */
  inboundAgentId?: string;
  capabilities: { voice: boolean; sms: boolean };
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Customer (the end caller / contact)                                 */
/* ------------------------------------------------------------------ */

export interface Customer {
  id: string;
  orgId: string;
  /** E.164 phone of the human on the other end. */
  phone: string;
  name?: string;
  email?: string;
  /** Free-form structured attributes captured across calls. */
  attributes: Record<string, string | number | boolean>;
  consentToRecord: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Transcript                                                          */
/* ------------------------------------------------------------------ */

export interface TranscriptTurn {
  role: TranscriptRole;
  text: string;
  /** ms offset from call start when this turn began. */
  startMs: number;
  /** ms offset when this turn ended (undefined while streaming). */
  endMs?: number;
  /** STT confidence for caller turns, 0–1. */
  confidence?: number;
}

export interface Transcript {
  callId: string;
  turns: TranscriptTurn[];
  /** Model-generated one-line summary, populated after the call ends. */
  summary?: string;
}

/* ------------------------------------------------------------------ */
/* Call                                                                */
/* ------------------------------------------------------------------ */

export interface Call {
  id: string;
  orgId: string;
  agentId: string;
  customerId?: string;
  numberId: string;
  direction: CallDirection;
  fromE164: string;
  toE164: string;
  status: CallStatus;
  outcome: CallOutcome;
  /** Wall-clock start/end in ISO 8601. */
  startedAt: string;
  endedAt?: string;
  /** Billable duration, rounded up to the second. */
  durationSec: number;
  /** Cost of the call to the business in USD (usage-based). */
  costUsd: number;
  recordingUrl?: string;
  transcript?: Transcript;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* API contracts (shared request/response shapes)                      */
/* ------------------------------------------------------------------ */

/** A single turn as sent to /api/agent/converse. */
export interface ConverseTurn {
  role: "agent" | "caller";
  text: string;
}

export interface ConverseRequest {
  agent: {
    name: string;
    goal: AgentGoal;
    persona: string;
    script: string;
    temperature?: number;
    maxTurns?: number;
  };
  /** Conversation so far, oldest first. */
  transcript: ConverseTurn[];
  /** The latest thing the caller said. */
  utterance: string;
}

export interface ConverseResponse {
  /** The agent's next spoken turn. */
  reply: string;
  /** Whether the agent believes the call objective is complete. */
  done: boolean;
  /** Detected/updated outcome for analytics. */
  outcome: CallOutcome;
  /** True when the reply came from the mock fallback (no API key). */
  mocked: boolean;
  /** Model latency in ms (0 for mock). */
  latencyMs: number;
}

/* ------------------------------------------------------------------ */
/* Display helpers (pure — safe to import from client components)      */
/* ------------------------------------------------------------------ */

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  appointment_booked: "Appointment booked",
  lead_qualified: "Lead qualified",
  resolved: "Resolved",
  escalated: "Escalated to human",
  callback_requested: "Callback requested",
  abandoned: "Abandoned",
  unknown: "In progress",
};
