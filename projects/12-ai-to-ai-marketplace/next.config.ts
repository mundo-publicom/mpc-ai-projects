import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // API routes run on the Node.js runtime (Fluid Compute on Vercel) so the
  // negotiation engine, ledger, and future payment-rail SDKs (which are not
  // edge-compatible) can run server-side.
  serverExternalPackages: [],
};

export default nextConfig;
