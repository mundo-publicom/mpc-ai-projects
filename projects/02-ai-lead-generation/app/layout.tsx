import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Lead Generation",
  description:
    "Define an ICP; find, enrich, score, and prioritize B2B leads with AI-written first-touch outreach. Export to CRM/CSV.",
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
