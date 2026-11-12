import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
      { protocol: "https", hostname: "myanimelist.cdn-dena.com", pathname: "/images/**" },
      { protocol: "https", hostname: "myanimelist.net", pathname: "/images/**" },
      { protocol: "http", hostname: "localhost", port: "3000" }
    ],
  },
};

export default nextConfig;
