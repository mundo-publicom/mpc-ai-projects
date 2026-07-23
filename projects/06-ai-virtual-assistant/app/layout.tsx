import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aide — AI Virtual Assistant",
  description:
    "A personal AI executive assistant that triages email, manages your calendar, tracks tasks, drafts replies, and researches on command — with human-in-the-loop approval for every action.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
