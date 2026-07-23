"use client";

import { useState } from "react";

const SUGGESTIONS = [
  "Triage my inbox and draft replies to anything urgent",
  "Find a 30-min slot next week for Dana and send an invite",
  "Prep me for the 3pm partner sync",
  "Turn the Acme redline email into a task due today",
];

export function CommandBar({
  onSubmit,
  busy,
}: {
  onSubmit: (command: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const cmd = value.trim();
    if (!cmd || busy) return;
    onSubmit(cmd);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 shadow-lg shadow-black/20">
      <div className="flex items-center gap-2">
        <span className="pl-1 text-brand-300" aria-hidden>
          ✦
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Tell your assistant what to do…"
          disabled={busy}
          className="w-full bg-transparent px-1 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-60"
          aria-label="Command input"
        />
        <button
          onClick={submit}
          disabled={busy || !value.trim()}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Planning…" : "Run"}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setValue(s)}
            disabled={busy}
            className="rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-brand-500/40 hover:text-slate-200 disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
