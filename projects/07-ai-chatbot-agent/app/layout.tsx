import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Chatbot Agent — embeddable RAG support & sales",
  description:
    "Ingest your docs and URLs, then drop a RAG-powered chat widget on any site. Streaming answers with citations, lead capture, and human handoff.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
