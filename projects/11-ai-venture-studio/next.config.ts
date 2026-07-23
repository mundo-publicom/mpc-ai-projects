import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Validation runs on the Node.js runtime (Fluid Compute on Vercel) so the
  // AI SDK and any future market-data SDKs work without edge-only limits.
  serverExternalPackages: [],
};

export default nextConfig;
