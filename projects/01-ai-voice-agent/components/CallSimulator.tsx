"use client";

import { useRef, useState } from "react";
import type { AgentDraft } from "./AgentConfigForm";
import {
  OUTCOME_LABELS,
  type CallOutcome,
  type ConverseRequest,
  type ConverseResponse,
  type ConverseTurn,
} from "@/lib/types";

interface UiTurn extends ConverseTurn {
  latencyMs?: number;
  mocked?: boolean;
}

/**
 * Live text simulation of the voice loop. In production the caller turns come
 * from STT and the agent turns are spoken via TTS; here we type as the caller
 * and hit /api/agent/converse for the agent's reply — the exact same server
 * path the telephony media stream uses.
 */
export function CallSimulator({ agent }: { agent: AgentDraft }) {
  const [turns, setTurns] = useState<UiTurn[]>([]);
  const [input, setInput] = useState("Hi, I'd like to book a cleaning.");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome>("unknown");
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = () =>
    requestAnimationFrame(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    });

  async function send() {
    const utterance = input.trim();
    if (!utterance || busy) return;
    setError(null);
    setBusy(true);

    const priorTurns: ConverseTurn[] = turns.map(({ role, text }) => ({ role, text }));
    const callerTurn: UiTurn = { role: "caller", text: utterance };
    setTurns((t) => [...t, callerTurn]);
    setInput("");
    scrollToEnd();

    const payload: ConverseRequest = {
      agent: {
        name: agent.name,
        goal: agent.goal,
        persona: agent.persona,
        script: agent.script,
        temperature: agent.temperature,
        maxTurns: agent.maxTurns,
      },
      transcript: priorTurns,
      utterance,
    };

    try {
      const res = await fetch("/api/agent/converse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as ConverseResponse;
      setTurns((t) => [
        ...t,
        {
          role: "agent",
          text: data.reply,
          latencyMs: data.latencyMs,
          mocked: data.mocked,
        },
      ]);
      setOutcome(data.outcome);
      setDone(data.done);
      scrollToEnd();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setTurns([]);
    setDone(false);
    setOutcome("unknown");
    setError(null);
    setInput("Hi, I'd like to book a cleaning.");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="font-medium">Live call simulation</span>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {OUTCOME_LABELS[outcome]}
        </span>
      </div>

      <div
        ref={logRef}
        className="scroll-slim min-h-[220px] flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        {turns.length === 0 && (
          <p className="text-sm text-slate-400">
            Type as the caller below. {agent.name} answers via /api/agent/converse.
          </p>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={`flex ${t.role === "agent" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                t.role === "agent"
                  ? "bg-brand-50 text-brand-900 dark:bg-brand-900/40 dark:text-brand-50"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-60">
                {t.role === "agent" ? agent.name : "Caller"}
                {t.role === "agent" && typeof t.latencyMs === "number" && (
                  <span className="ml-2 font-normal normal-case opacity-70">
                    {t.mocked ? "mock" : `${t.latencyMs} ms`}
                  </span>
                )}
              </div>
              {t.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-brand-50 px-3.5 py-2 text-sm text-brand-500 dark:bg-brand-900/40">
              {agent.name} is thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {done ? (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <span>Call complete — outcome: {OUTCOME_LABELS[outcome]}</span>
          <button
            onClick={reset}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            New call
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-900"
            value={input}
            placeholder="Speak as the caller…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={busy}
          />
          <button
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
