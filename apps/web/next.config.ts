import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rcs/shared"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, x-guest-session" },
        ],
      },
    ];
  },
};

export default nextConfig;
