import type { NextConfig } from "next";
import { redirects } from "./redirects";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // WordPress URLs end with a slash; keep them identical.
  trailingSlash: true,
  // content/seed.json is the built-in copy used until the CMS has content.
  outputFileTracingIncludes: { "/*": ["./content/seed.json"] },
  async headers() {
    const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    const week = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }];
    return [
      { source: "/assets/:path*", headers: immutable },
      { source: "/wp-content/:path*", headers: week },
      { source: "/wp-includes/:path*", headers: week },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  async redirects() {
    return redirects;
  },
};

export default nextConfig;
