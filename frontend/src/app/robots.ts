import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Results/scanning pages are personalized (user-supplied IDs in the
        // query string) — never worth indexing and a source of duplicate
        // content if crawled.
        disallow: ["/chess/results", "/chess/scanning", "/dota2/results", "/dota2/scanning", "/valorant/results", "/valorant/scanning"],
      },
    ],
    sitemap: "https://spotme.gg/sitemap.xml",
  };
}
