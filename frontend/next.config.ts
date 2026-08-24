import type { NextConfig } from "next";

// Next.js dev mode wraps modules in eval() for HMR/fast refresh — a strict
// CSP without 'unsafe-eval' silently breaks all client-side interactivity
// in `next dev` (production doesn't use eval-wrapped modules, so it stays strict there).
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control",    value: "on" },
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "geolocation=(), microphone=(), camera=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },

  // The dedicated per-game landing pages were folded into the unified search
  // form on "/". A permanent (308) redirect here — rather than an in-page
  // redirect() — tells search engines to consolidate ranking signal onto the
  // canonical "/" URL instead of indexing these as separate pages.
  async redirects() {
    return [
      { source: "/chess", destination: "/?game=chess", permanent: true },
      { source: "/dota2", destination: "/?game=dota2", permanent: true },
      { source: "/valorant", destination: "/?game=valorant", permanent: true },
    ];
  },
};

export default nextConfig;
