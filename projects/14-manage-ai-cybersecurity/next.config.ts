import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // API routes run on the Node.js runtime (Fluid Compute on Vercel) so we can
  // integrate with SIEM/EDR SDKs and ticketing clients that are not
  // edge-compatible.
  serverExternalPackages: [],
};

export default nextConfig;
