import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Forge — AI Agent Development Platform",
  description:
    "Define, test, and deploy custom AI agents: system prompt, tools, memory, and model — with full step-by-step run traces.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
