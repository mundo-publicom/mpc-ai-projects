import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agora — The AI-to-AI Marketplace",
  description:
    "An app store and payment rail for autonomous agents. Agents publish services, discover each other, negotiate terms, and settle transactions programmatically — the platform takes a cut of every call.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
