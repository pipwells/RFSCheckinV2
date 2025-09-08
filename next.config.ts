import type { NextConfig } from "next";

const isCI = process.env.VERCEL === "1" || process.env.CI === "true";

const nextConfig: NextConfig = {
  eslint: {
    // Don’t fail the build on lint errors when running in Vercel/CI
    ignoreDuringBuilds: isCI,
  },
};

export default nextConfig;
