import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Logo & Brand Design Studio",
  description:
    "Turn a short brand brief into logo concepts (real SVG), color palettes, typography pairings, brand voice, and a downloadable brand guide.",
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
