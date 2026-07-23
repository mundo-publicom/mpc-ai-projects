import { ChatWidget } from "@/components/ChatWidget";
import { EmbedSnippet } from "@/components/EmbedSnippet";
import { IngestPanel } from "@/components/IngestPanel";
import { getBot, DEMO_BOT_ID } from "@/lib/bots";
import { hasAI } from "@/lib/ai";

export default function DashboardPage() {
  const bot = getBot(DEMO_BOT_ID)!;
  const aiReady = hasAI();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Hero */}
      <header className="mb-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
          <span className={`h-2 w-2 rounded-full ${aiReady ? "bg-emerald-500" : "bg-amber-500"}`} />
          {aiReady ? "AI Gateway connected — real embeddings & streaming" : "Demo mode — mock embeddings & streamed answers (no key needed)"}
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">AI Chatbot Agent</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">
          An embeddable, RAG-powered support &amp; sales chatbot. Ingest your docs and URLs, then drop
          one script tag on any site to get streaming answers with citations, lead capture, and human
          handoff.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {["Retrieval-augmented", "Streaming + citations", "Lead capture", "Human handoff", "Multi-tenant isolated"].map(
            (f) => (
              <span key={f} className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">
                {f}
              </span>
            ),
          )}
        </div>
      </header>

      {/* KPI strip */}
      <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { k: "Deflection rate", v: "68%", d: "tickets resolved without a human" },
          { k: "Avg. first response", v: "1.2s", d: "streaming starts immediately" },
          { k: "CSAT", v: "4.6/5", d: "on answered conversations" },
          { k: "Leads / mo", v: "340", d: "captured in-chat" },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-slate-900">{s.v}</div>
            <div className="text-sm font-medium text-slate-700">{s.k}</div>
            <div className="mt-0.5 text-xs text-slate-400">{s.d}</div>
          </div>
        ))}
      </section>

      {/* Working demo */}
      <section className="grid gap-6 lg:grid-cols-5">
        {/* Left: ingestion + embed */}
        <div className="space-y-6 lg:col-span-3">
          <IngestPanel botId={bot.id} />
          <EmbedSnippet botId={bot.id} />
        </div>

        {/* Right: live widget preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Live preview</h3>
              <span className="text-xs text-slate-400">answers cite your ingested sources</span>
            </div>
            <div className="h-[560px]">
              <ChatWidget
                botId={bot.id}
                title={bot.theme.title}
                greeting={bot.theme.greeting}
                primaryColor={bot.theme.primaryColor}
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-14">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: 1, t: "Ingest", d: "Paste text or add URLs. Content is normalised and chunked with overlap." },
            { n: 2, t: "Embed", d: "Chunks are embedded (real model or deterministic mock) and stored per-bot." },
            { n: 3, t: "Retrieve", d: "Each question is embedded and matched by cosine similarity, top-k, tenant-scoped." },
            { n: 4, t: "Answer", d: "streamText grounds the reply in retrieved context and cites its sources." },
          ].map((s) => (
            <li key={s.n} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {s.n}
              </div>
              <div className="font-semibold text-slate-900">{s.t}</div>
              <p className="mt-1 text-sm text-slate-600">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-14 border-t border-slate-200 pt-6 text-sm text-slate-400">
        Bot <span className="font-mono text-slate-500">{bot.id}</span> · plan{" "}
        <span className="capitalize">{bot.plan}</span> · See{" "}
        <span className="font-mono">docs/</span> for PRD, technical spec, and architecture.
      </footer>
    </main>
  );
}
