import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // API routes run on the Node.js runtime (Fluid Compute on Vercel) so the
  // agent runtime loop and tool executors are not constrained by edge limits.
  serverExternalPackages: [],
};

export default nextConfig;
