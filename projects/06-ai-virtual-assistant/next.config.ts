import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // API routes run on the Node.js runtime (Fluid Compute on Vercel) so the
  // Gmail / Google Calendar / Slack SDKs — which are not edge-compatible — can
  // be used directly from the tool executors.
  serverExternalPackages: [],
};

export default nextConfig;
