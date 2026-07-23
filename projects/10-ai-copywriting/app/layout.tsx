import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Copywriting Studio",
  description:
    "Brand-voice-aware copy generation across ads, email, landing pages and product descriptions — with scoring and critique.",
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
