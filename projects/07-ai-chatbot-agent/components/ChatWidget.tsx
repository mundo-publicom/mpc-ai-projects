"use client";

import { useEffect, useRef, useState } from "react";
import type { Citation } from "@/lib/types";

interface UIMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  mocked?: boolean;
  streaming?: boolean;
}

interface ChatWidgetProps {
  botId: string;
  title?: string;
  greeting?: string;
  primaryColor?: string;
  /** Where the /api/chat endpoint lives (absolute for cross-origin embeds). */
  apiBase?: string;
}

function decodeCitations(header: string | null): Citation[] {
  if (!header) return [];
  try {
    return JSON.parse(decodeURIComponent(escape(atob(header)))) as Citation[];
  } catch {
    try {
      return JSON.parse(atob(header)) as Citation[];
    } catch {
      return [];
    }
  }
}

/**
 * Embeddable chat widget. Streams the assistant reply token-by-token from
 * /api/chat and renders citation chips parsed from the response headers.
 * Used inline in the dashboard preview and is the same component that ships
 * inside the embeddable bundle.
 */
export function ChatWidget({
  botId,
  title = "AI Assistant",
  greeting = "Hi! Ask me anything.",
  primaryColor = "#3563ff",
  apiBase = "",
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<UIMessage[]>([
    { role: "assistant", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const history = messages
      .filter((m) => !(m.role === "assistant" && m.content === greeting))
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ botId, history, message: text }),
      });

      const citations = decodeCitations(res.headers.get("x-citations"));
      const mocked = res.headers.get("x-mocked") === "true";

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc, streaming: true };
          return next;
        });
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: acc, citations, mocked };
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `Sorry — something went wrong. ${err instanceof Error ? err.message : ""}`,
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: primaryColor }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
          AI
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold leading-tight">{title}</div>
          <div className="text-[11px] text-white/80">Powered by RAG · cites its sources</div>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-300" />
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} primaryColor={primaryColor} />
        ))}
      </div>

      {/* Composer */}
      <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask a question…"
          className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          disabled={busy}
        />
        <button
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: primaryColor }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message, primaryColor }: { message: UIMessage; primaryColor: string }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            isUser ? "text-white" : "border border-slate-200 bg-white text-slate-800"
          }`}
          style={isUser ? { background: primaryColor } : undefined}
        >
          {message.content || (
            <span className="inline-flex gap-1">
              <span className="typing-dot">●</span>
              <span className="typing-dot">●</span>
              <span className="typing-dot">●</span>
            </span>
          )}
        </div>

        {message.citations && message.citations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.citations.map((c) => {
              const chip = (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                  <span className="font-semibold" style={{ color: primaryColor }}>
                    [{c.marker}]
                  </span>
                  <span className="max-w-[160px] truncate">{c.sourceLabel}</span>
                </span>
              );
              return c.sourceUrl ? (
                <a key={c.marker} href={c.sourceUrl} target="_blank" rel="noreferrer" title={c.snippet}>
                  {chip}
                </a>
              ) : (
                <span key={c.marker} title={c.snippet}>
                  {chip}
                </span>
              );
            })}
          </div>
        )}

        {message.mocked && (
          <div className="mt-1 text-[10px] uppercase tracking-wide text-amber-600">mock · no AI key</div>
        )}
      </div>
    </div>
  );
}
