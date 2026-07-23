import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // API routes run on the Node.js runtime (Fluid Compute on Vercel) so we have
  // headroom for multi-artifact generation and PDF/export tooling.
  serverExternalPackages: [],
};

export default nextConfig;
