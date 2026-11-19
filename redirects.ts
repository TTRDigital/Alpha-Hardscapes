import wordpress from "./content/redirects.json" with { type: "json" };

/**
 * 301 redirects carried over from WordPress: the redirects the live site
 * answered for old/alternative URLs (collected by probing it), so old
 * backlinks and indexed URLs keep landing on the right page. Unknown URLs
 * whose last part matches a page are also redirected at request time
 * (lib/site/guess.ts), like WordPress did.
 */
type Row = { source: string; destination: string; query?: Record<string, string> };

/**
 * Addresses that answered 404 on October 26, 2026, each sent to the closest
 * live page: links in three blog posts to posts that were never published,
 * and common shortcuts people and crawlers try.
 */
const moved: Row[] = [
  { source: "/uncategorized/updated-guide-to-hardscaping-pavers/", destination: "/blog/hardscaping-pavers-planning-your-outdoor-space/" },
  { source: "/uncategorized/what-to-ask-before-hiring-a-patio-contractor-in-connecticut/", destination: "/blog/hardscaping-pavers-contractor-complete-guide-to-planning-installation-and-maintenance/" },
  { source: "/uncategorized/safe-de-icing-for-paver-patios-stone-steps-and-walkways/", destination: "/blog/prepare-patio-for-winter-connecticut/" },
  // Linked from blog posts; WordPress' slug guess (lib/site/guess.ts) sent these on, now a plain rule.
  { source: "/patio-installation-cost-connecticut-cost-guide/", destination: "/blog/patio-installation-cost-connecticut-cost-guide/" },
  { source: "/outdoor-kitchen-cost-connecticut/", destination: "/blog/outdoor-kitchen-cost-connecticut/" },
  { source: "/sitemap.xml", destination: "/sitemap_index.xml" },
  { source: "/contact-us/", destination: "/contact/" },
  { source: "/faq/", destination: "/frequently-asked-questions/" },
  { source: "/testimonials/", destination: "/reviews/" },
  { source: "/comments/feed/", destination: "/feed/" },
  { source: "/blog/feed/", destination: "/feed/" },
];

export const redirectRows: Row[] = [...moved, ...(wordpress as Row[])];

export const redirects = redirectRows.map((r) => ({
  source: r.source,
  destination: r.destination,
  statusCode: 301 as const,
  // WordPress shortlinks: /?p=123 and /?page_id=123
  ...(r.query ? { has: Object.entries(r.query).map(([key, value]) => ({ type: "query" as const, key, value })) } : {}),
}));
