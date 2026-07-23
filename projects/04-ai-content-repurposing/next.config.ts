import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // API routes run on the Node.js runtime (Fluid Compute on Vercel) so we can
  // stream large source assets and call transcription/scheduler SDKs that are
  // not edge-compatible.
  serverExternalPackages: [],
};

export default nextConfig;
