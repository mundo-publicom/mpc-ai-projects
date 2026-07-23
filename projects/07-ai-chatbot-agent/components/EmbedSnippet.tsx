"use client";

import { useEffect, useState } from "react";

interface EmbedSnippetProps {
  botId: string;
}

/**
 * Shows the one-line <script> a customer drops into their site's <head> to load
 * the widget. The snippet points a loader script at the host with the bot id;
 * the loader (shipped as /widget.js in a full build) injects the ChatWidget in
 * a shadow-DOM iframe so host-page CSS can't leak in.
 */
export function EmbedSnippet({ botId }: EmbedSnippetProps) {
  const [origin, setOrigin] = useState("https://your-app.vercel.app");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const snippet = `<!-- AI Chatbot Agent — paste before </body> -->
<script
  src="${origin}/widget.js"
  data-bot-id="${botId}"
  data-position="bottom-right"
  async
></script>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-slate-100 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Embed on your site</h3>
          <p className="text-sm text-slate-400">One script tag. Isolated per bot id and origin.</p>
        </div>
        <button
          onClick={() => void copy()}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 text-[13px] leading-relaxed">
        <code className="font-mono">{snippet}</code>
      </pre>
      <p className="mt-3 text-xs text-slate-400">
        Only origins on the bot&apos;s allow-list may load the widget. Conversations and retrieval
        are hard-scoped to <span className="font-mono text-slate-300">{botId}</span>.
      </p>
    </div>
  );
}
