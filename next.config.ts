import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the SDK's Node transport dependencies out of Turbopack's server bundle.
  serverExternalPackages: ["@google/genai"],
};

export default nextConfig;
