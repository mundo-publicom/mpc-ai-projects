import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Domain logic runs on the Node.js runtime (Fluid Compute), never edge-only.
};

export default nextConfig;
