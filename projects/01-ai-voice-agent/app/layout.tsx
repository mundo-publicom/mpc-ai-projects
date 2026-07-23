import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Voice Agent — Platform Console",
  description:
    "Configure, test, and monitor AI voice agents that book appointments, qualify leads, and handle tier-1 support over phone and web.",
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
