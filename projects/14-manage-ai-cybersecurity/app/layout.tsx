import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Managed AI Cybersecurity — SOC Console",
  description:
    "Defensive managed-detection platform for SMBs: AI-triaged alerts with MITRE ATT&CK mapping, a live security posture score, and prioritized remediation guidance.",
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
