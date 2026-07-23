import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // API routes run on the Node.js runtime (Fluid Compute on Vercel). Ingestion
  // fetches and parses remote URLs and streams chat responses, neither of which
  // should be constrained to the edge runtime.
  serverExternalPackages: [],
};

export default nextConfig;
