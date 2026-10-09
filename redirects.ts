import wordpress from "./content/redirects.json" with { type: "json" };

/**
 * 301 redirects carried over from WordPress: the redirects the live site
 * answered for old/alternative URLs (collected by probing it), so old
 * backlinks and indexed URLs keep landing on the right page. Unknown URLs
 * whose last part matches a page are also redirected at request time
 * (lib/site/guess.ts), like WordPress did.
 */
type Row = { source: string; destination: string; query?: Record<string, string> };

export const redirects = (wordpress as Row[]).map((r) => ({
  source: r.source,
  destination: r.destination,
  statusCode: 301 as const,
  // WordPress shortlinks: /?p=123 and /?page_id=123
  ...(r.query ? { has: Object.entries(r.query).map(([key, value]) => ({ type: "query" as const, key, value })) } : {}),
}));
