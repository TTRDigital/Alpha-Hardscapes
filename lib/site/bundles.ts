import "server-only";

import { REVALIDATE_SECONDS } from "./data";

/**
 * Whether a stylesheet bundle (scripts/css-bundles.mjs) is really being served by this deployment, so a
 * page never points at a bundle that is missing: the page keeps its original stylesheet links until the
 * bundle's marker file (<bundle>.ok, written after the bundle, holding its name) answers. The answer is
 * cached like the pages (5 minutes); a yes is kept for the life of the server.
 *
 * Production asks the live domain, a preview its own address (behind Vercel's login, so previews keep
 * the original links), a local server itself. While a new production build prerenders, the domain still
 * serves the previous deployment, so pages start with the original links and switch to the bundle on
 * their next refresh.
 */
const served = new Set<string>();

function origin() {
  if (process.env.VERCEL_ENV === "production") return (process.env.NEXT_PUBLIC_SITE_URL || "https://alphahardscapes.com").replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

export async function bundleServed(bundle: string): Promise<boolean> {
  if (served.has(bundle)) return true;
  try {
    const res = await fetch(`${origin()}${bundle}.ok`, { next: { revalidate: REVALIDATE_SECONDS }, signal: AbortSignal.timeout(3000) });
    if (res.ok && (await res.text()).trim() === bundle) {
      served.add(bundle);
      return true;
    }
  } catch {
    // Unreachable or timed out: keep the original links.
  }
  return false;
}
