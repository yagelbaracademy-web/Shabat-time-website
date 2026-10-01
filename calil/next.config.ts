import type { NextConfig } from "next";

// Calil is a fully static app (Supabase is called from the browser and
// protected by RLS), so it can be hosted on any static host or CDN.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
