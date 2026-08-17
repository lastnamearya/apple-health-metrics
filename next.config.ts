import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next's dev server blocks cross-origin requests to _next/* dev/HMR
  // resources by default (DNS-rebinding protection) — without this, loading
  // the app from a phone over LAN renders the page shell but the client
  // chart bundles 403 and never hydrate. Update the IP if it changes.
  allowedDevOrigins: ["192.168.168.123"],
};

export default nextConfig;
