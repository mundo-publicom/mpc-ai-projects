import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Venture Studio",
  description:
    "Idea-to-MVP pipeline: capture a startup idea and get an AI validation report — market/TAM, competitors, Lean Canvas, MVP spec, and landing copy.",
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
