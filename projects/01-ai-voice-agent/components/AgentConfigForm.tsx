"use client";

import type { AgentGoal, VoiceProvider } from "@/lib/types";

/** The editable subset of an Agent used by the console. */
export interface AgentDraft {
  name: string;
  goal: AgentGoal;
  persona: string;
  script: string;
  temperature: number;
  maxTurns: number;
  voiceProvider: VoiceProvider;
  voiceId: string;
}

export const DEFAULT_AGENT: AgentDraft = {
  name: "Ava",
  goal: "book_appointment",
  persona:
    "A warm, upbeat front-desk receptionist for Bright Smile Dental. Friendly and efficient, never pushy. Uses the caller's name once you learn it.",
  script:
    "Bright Smile Dental is open Monday to Friday, 9am to 5pm. New-patient cleanings are 60 minutes. We accept most PPO insurance. If someone is in pain today, offer the earliest same-day slot.",
  temperature: 0.4,
  maxTurns: 20,
  voiceProvider: "elevenlabs",
  voiceId: "rachel",
};

const GOALS: { value: AgentGoal; label: string }[] = [
  { value: "book_appointment", label: "Book appointment" },
  { value: "qualify_lead", label: "Qualify lead" },
  { value: "tier1_support", label: "Tier-1 support" },
  { value: "outbound_reminder", label: "Outbound reminder" },
];

const VOICES: { value: VoiceProvider; label: string }[] = [
  { value: "elevenlabs", label: "ElevenLabs" },
  { value: "deepgram", label: "Deepgram Aura" },
  { value: "cartesia", label: "Cartesia Sonic" },
  { value: "openai", label: "OpenAI TTS" },
];

const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300";
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-900";

export function AgentConfigForm({
  value,
  onChange,
}: {
  value: AgentDraft;
  onChange: (next: AgentDraft) => void;
}) {
  const set = <K extends keyof AgentDraft>(key: K, v: AgentDraft[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="agent-name">
            Agent name
          </label>
          <input
            id="agent-name"
            className={inputCls}
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={80}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="agent-goal">
            Objective
          </label>
          <select
            id="agent-goal"
            className={inputCls}
            value={value.goal}
            onChange={(e) => set("goal", e.target.value as AgentGoal)}
          >
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="agent-persona">
          Persona
        </label>
        <textarea
          id="agent-persona"
          className={`${inputCls} h-24 resize-y`}
          value={value.persona}
          onChange={(e) => set("persona", e.target.value)}
          maxLength={4000}
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="agent-script">
          Script & knowledge
        </label>
        <textarea
          id="agent-script"
          className={`${inputCls} h-28 resize-y`}
          value={value.script}
          onChange={(e) => set("script", e.target.value)}
          maxLength={20000}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="agent-voice">
            Voice provider
          </label>
          <select
            id="agent-voice"
            className={inputCls}
            value={value.voiceProvider}
            onChange={(e) => set("voiceProvider", e.target.value as VoiceProvider)}
          >
            {VOICES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="agent-voiceid">
            Voice ID
          </label>
          <input
            id="agent-voiceid"
            className={inputCls}
            value={value.voiceId}
            onChange={(e) => set("voiceId", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="agent-temp">
            Temperature: <span className="tabular-nums">{value.temperature.toFixed(2)}</span>
          </label>
          <input
            id="agent-temp"
            type="range"
            min={0}
            max={1}
            step={0.05}
            className="mt-3 w-full accent-brand-600"
            value={value.temperature}
            onChange={(e) => set("temperature", Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="agent-maxturns">
            Max agent turns
          </label>
          <input
            id="agent-maxturns"
            type="number"
            min={1}
            max={50}
            className={inputCls}
            value={value.maxTurns}
            onChange={(e) => set("maxTurns", Number(e.target.value))}
          />
        </div>
      </div>
    </form>
  );
}
