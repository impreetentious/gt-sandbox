import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the product ships as files, with no server runtime to trust.
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
