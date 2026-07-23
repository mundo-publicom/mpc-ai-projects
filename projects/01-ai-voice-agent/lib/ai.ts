import { generateText, generateObject } from "ai";
import { z } from "zod";
import type { AgentGoal, ConverseTurn } from "./types";

// Re-export so routes can import the SDK helpers from one place.
export { generateText, generateObject };

/**
 * Model catalog. Calls are routed through the Vercel AI Gateway using plain
 * "provider/model" strings — no provider SDK is wired directly.
 */
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * True when a gateway/provider key is present. When false, API routes serve
 * realistic mock data so the demo runs end-to-end with zero configuration.
 */
export const hasAI = () =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

/* ------------------------------------------------------------------ */
/* Prompt construction                                                 */
/* ------------------------------------------------------------------ */

const GOAL_INSTRUCTIONS: Record<AgentGoal, string> = {
  book_appointment:
    "Your objective is to book a concrete appointment: collect the caller's name, preferred day/time, and a callback number, then confirm the slot. Do not end until you have a confirmed time or a clear decline.",
  qualify_lead:
    "Your objective is to qualify the lead using BANT (budget, authority, need, timeline). Ask one question at a time and capture the answers. Wrap up once you can classify them as qualified or not.",
  tier1_support:
    "Your objective is to resolve common tier-1 support issues using the script/knowledge provided. If the issue is outside your knowledge or the caller is frustrated, offer to escalate to a human.",
  outbound_reminder:
    "Your objective is to deliver a reminder and confirm the caller will attend, needs to reschedule, or wants to cancel. Keep it brief and respectful of their time.",
};

/**
 * Builds the system prompt that turns a persona + script into a bounded,
 * production-safe voice agent. The voice channel constraints (short turns,
 * no markdown, one question at a time) are critical for TTS quality and
 * barge-in latency.
 */
export function buildSystemPrompt(input: {
  name: string;
  goal: AgentGoal;
  persona: string;
  script: string;
  maxTurns: number;
}): string {
  return [
    `You are ${input.name}, an AI voice agent speaking on a live phone call.`,
    ``,
    `PERSONA:`,
    input.persona.trim(),
    ``,
    `OBJECTIVE:`,
    GOAL_INSTRUCTIONS[input.goal],
    ``,
    `SCRIPT & KNOWLEDGE (follow closely, never invent facts beyond this):`,
    input.script.trim() || "(no additional script provided)",
    ``,
    `VOICE CHANNEL RULES — you are being spoken aloud by a text-to-speech engine:`,
    `- Reply with ONE short conversational turn (1–2 sentences, ~40 words max).`,
    `- Never use markdown, lists, emojis, URLs, or symbols that do not read aloud.`,
    `- Ask exactly one question at a time and then stop.`,
    `- Spell out numbers naturally ("four fifteen p.m.", not "4:15 PM").`,
    `- If the caller interrupts or changes topic, adapt immediately.`,
    `- Never claim to be human; if asked, say you are an AI assistant.`,
    `- Keep the call under ${input.maxTurns} agent turns; if approaching the limit, wrap up politely.`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Structured turn generation                                          */
/* ------------------------------------------------------------------ */

export const turnSchema = z.object({
  reply: z
    .string()
    .describe("The agent's next spoken turn — one short conversational reply."),
  done: z
    .boolean()
    .describe("True when the call objective is complete or the call should end."),
  outcome: z
    .enum([
      "appointment_booked",
      "lead_qualified",
      "resolved",
      "escalated",
      "callback_requested",
      "abandoned",
      "unknown",
    ])
    .describe("Best current classification of the call outcome."),
});

export type GeneratedTurn = z.infer<typeof turnSchema>;

/** Renders a transcript into a plain-text dialogue for the model context. */
export function renderTranscript(turns: ConverseTurn[]): string {
  if (turns.length === 0) return "(call just connected — no turns yet)";
  return turns
    .map((t) => `${t.role === "agent" ? "Agent" : "Caller"}: ${t.text}`)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Mock fallback (no API key present)                                  */
/* ------------------------------------------------------------------ */

/**
 * Deterministic, goal-aware canned replies so the product is fully demoable
 * without any keys. Chosen to feel plausible for each objective.
 */
export function mockTurn(input: {
  goal: AgentGoal;
  utterance: string;
  turnCount: number;
}): GeneratedTurn {
  const u = input.utterance.toLowerCase();
  const wantsEnd = /\b(bye|goodbye|that'?s all|no thanks|nothing else)\b/.test(u);

  if (wantsEnd) {
    return {
      reply: "Great, thanks so much for your time. Have a wonderful day!",
      done: true,
      outcome: "resolved",
    };
  }

  switch (input.goal) {
    case "book_appointment":
      if (/\b(tomorrow|monday|tuesday|wednesday|thursday|friday|afternoon|morning|\d)\b/.test(u)) {
        return {
          reply:
            "Perfect, I have you down for that time. Can I get a good callback number in case anything changes?",
          done: false,
          outcome: "appointment_booked",
        };
      }
      return {
        reply:
          "I'd be happy to book that for you. What day and time works best this week?",
        done: false,
        outcome: "unknown",
      };
    case "qualify_lead":
      return {
        reply:
          "Got it, that's helpful. And roughly what timeline are you working toward for this?",
        done: false,
        outcome: "lead_qualified",
      };
    case "tier1_support":
      if (/\b(human|agent|manager|person|frustrat|angry)\b/.test(u)) {
        return {
          reply:
            "I understand — let me get a specialist on the line for you right away.",
          done: true,
          outcome: "escalated",
        };
      }
      return {
        reply:
          "Thanks for the details. Have you tried restarting the device and waiting about thirty seconds?",
        done: false,
        outcome: "unknown",
      };
    case "outbound_reminder":
      return {
        reply:
          "Wonderful, we'll see you then. Would you like a text confirmation as well?",
        done: false,
        outcome: "callback_requested",
      };
    default:
      return {
        reply: "Thanks for sharing that. How else can I help you today?",
        done: false,
        outcome: "unknown",
      };
  }
}
