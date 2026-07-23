import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // API routes run on the Node.js runtime (Fluid Compute on Vercel) so the
  // render worker can shell out to ffmpeg and use non-edge media/TTS SDKs.
  serverExternalPackages: [],
};

export default nextConfig;
