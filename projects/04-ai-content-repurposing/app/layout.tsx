import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repurpose — one asset, 20+ platform-native pieces",
  description:
    "Paste one long-form asset and get platform-native content for X, LinkedIn, Instagram, TikTok, newsletters, and SEO — in your brand voice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
