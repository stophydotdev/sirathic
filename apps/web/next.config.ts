import type { NextConfig } from "next";

const SERVER = process.env.NEXT_PUBLIC_SERVER;
const PUBLIC_URL = process.env.NEXT_PUBLIC_URL;

if (!SERVER) throw new Error("env NEXT_PUBLIC_SERVER is not set");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", ...(PUBLIC_URL ? [new URL(PUBLIC_URL).hostname] : [])],
  devIndicators: false,
  env: { BUILT_AT: new Date().toISOString() },
  experimental: { optimizePackageImports: ["@hugeicons/core-free-icons"] },
  transpilePackages: ["@sirathic/server"],
  headers: async () => [
    {
      source: "/c/:id",
      headers: [{ key: "X-Robots-Tag", value: "noindex" }],
    },
  ],
  redirects: async () => [{ source: "/s/:id", destination: "/c/:id", permanent: true }],
  rewrites: async () =>
    [
      "/trpc/:path*",
      "/api/chat",
      "/api/files/:path*",
      "/api/auth/:path*",
      "/api/connectors/:path*",
      "/auth/:path*",
    ].map((source) => ({
      source,
      destination: `${SERVER}${source}`,
    })),
};

export default nextConfig;
