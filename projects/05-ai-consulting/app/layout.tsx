import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Consulting — Productized AI-Readiness Audits",
  description:
    "Intake a company's processes and stack, then generate an AI-Readiness Audit, opportunity map, prioritized use-case backlog with ROI, and an implementation roadmap.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
