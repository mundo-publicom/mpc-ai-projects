"use client";

import type { AgentDraft, ModelTier } from "@/lib/types";
import { ToolPicker } from "./ToolPicker";

const MODEL_OPTIONS: { value: ModelTier; label: string; hint: string }[] = [
  { value: "fast", label: "Fast", hint: "claude-haiku-4-5" },
  { value: "smart", label: "Smart", hint: "claude-sonnet-5" },
  { value: "frontier", label: "Frontier", hint: "claude-opus-4-8" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500";

export function AgentEditor({
  draft,
  onChange,
}: {
  draft: AgentDraft;
  onChange: (patch: Partial<AgentDraft>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            className={inputCls}
            value={draft.name}
            maxLength={80}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Research Assistant"
          />
        </Field>
        <Field label="Model" hint={MODEL_OPTIONS.find((m) => m.value === draft.model)?.hint}>
          <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
            {MODEL_OPTIONS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => onChange({ model: m.value })}
                className={[
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition",
                  draft.model === m.value
                    ? "bg-brand-500 text-white"
                    : "text-slate-400 hover:text-slate-200",
                ].join(" ")}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Description">
        <input
          className={inputCls}
          value={draft.description}
          maxLength={500}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What this agent is for"
        />
      </Field>

      <Field label="System prompt" hint={`${draft.systemPrompt.length} chars`}>
        <textarea
          className={`${inputCls} h-40 resize-y font-mono text-[13px] leading-relaxed`}
          value={draft.systemPrompt}
          maxLength={20000}
          onChange={(e) => onChange({ systemPrompt: e.target.value })}
          placeholder="You are a precise research assistant. Use web_search to gather sources…"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Temperature" hint={draft.temperature.toFixed(2)}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={draft.temperature}
            onChange={(e) => onChange({ temperature: Number(e.target.value) })}
            className="w-full accent-brand-500"
          />
        </Field>
        <Field label="Max steps" hint="model⇄tool iterations">
          <input
            type="number"
            min={1}
            max={25}
            className={inputCls}
            value={draft.maxSteps}
            onChange={(e) =>
              onChange({ maxSteps: Math.max(1, Math.min(25, Number(e.target.value) || 1)) })
            }
          />
        </Field>
      </div>

      <ToolPicker
        selected={draft.toolIds}
        onChange={(toolIds) => onChange({ toolIds })}
      />

      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 p-3">
        <div>
          <div className="text-sm font-medium text-slate-200">Conversation memory</div>
          <div className="text-xs text-slate-500">
            Buffer the last {draft.memory.maxMessages} messages across turns.
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange({
              memory: {
                ...draft.memory,
                enabled: !draft.memory.enabled,
                strategy: !draft.memory.enabled ? "buffer" : "none",
              },
            })
          }
          className={[
            "relative h-6 w-11 rounded-full transition",
            draft.memory.enabled ? "bg-brand-500" : "bg-slate-700",
          ].join(" ")}
          aria-pressed={draft.memory.enabled}
        >
          <span
            className={[
              "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
              draft.memory.enabled ? "left-[22px]" : "left-0.5",
            ].join(" ")}
          />
        </button>
      </div>
    </div>
  );
}
