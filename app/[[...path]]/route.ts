import { draftMode } from "next/headers";
import { allPaths, getSite, resolve, REVALIDATE_SECONDS } from "@/lib/site/data";
import { feedXml, sitemapIndex, sitemapXml } from "@/lib/site/sitemaps";
import { guessRedirect } from "@/lib/site/guess";
import { renderDocument } from "@/lib/site/render";
import { bundleServed } from "@/lib/site/bundles";
import { stylesheetBundle, tuneHtml } from "@/lib/site/tune";
import { dataset, projectId } from "@/sanity/env";

/**
 * The whole public site: every URL is rendered from the CMS into the same
 * HTML the WordPress site printed (see lib/site/render.ts). Pages are
 * static and refresh every 5 minutes or right after publishing.
 */

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { fromCms } = await getSite();
  const paths = await allPaths(fromCms);
  return paths.map((p) => ({ path: p.path.split("/").filter(Boolean) }));
}

const SITEMAPS = new Set(["page-sitemap.xml", "post-sitemap.xml", "category-sitemap.xml", "author-sitemap.xml"]);

export async function GET(_req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path: segments = [] } = await ctx.params;
  const site = await getSite();
  // Draft preview must show Sanity's drafts or say it cannot: never the built-in copy in their place.
  if (!site.fromCms && (await draftMode()).isEnabled) {
    return new Response("Preview could not read the Sanity drafts (check SANITY_API_READ_TOKEN).", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=UTF-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || site.settings.siteUrl || "https://alphahardscapes.com").replace(/\/$/, "");

  if (segments.length === 1 && segments[0] === "sitemap_index.xml") return xml(sitemapIndex(origin, await allPaths(site.fromCms), site.data.posts));
  if (segments.length === 1 && SITEMAPS.has(segments[0])) return xml(sitemapXml(segments[0], origin, await allPaths(site.fromCms), site.data.posts));
  if (segments.length === 1 && segments[0] === "feed") return xml(feedXml(origin, site.data.posts), "application/rss+xml; charset=UTF-8");

  const path = `/${segments.map((s) => decodeURIComponent(s)).join("/")}${segments.length ? "/" : ""}`;
  const resolved = await resolve(path, site.fromCms);
  if (!resolved) return new Response("Not found", { status: 404 });
  if (resolved.kind === "notFound") {
    const target = guessRedirect(path, await allPaths(site.fromCms));
    if (target) return new Response(null, { status: 301, headers: { Location: target } });
  }
  // TTR OS website tracker (visits by source and form leads; no personal data). The site key is public; "off" turns it off.
  const ttrKey = process.env.NEXT_PUBLIC_TTR_SITE_KEY === "off" ? "" : process.env.NEXT_PUBLIC_TTR_SITE_KEY || "8ntBK6QgvLkKLHNYnBTF8Q";
  const tracker = ttrKey ? `<script async src="https://ttr-portal.vercel.app/api/site/script" data-site="${ttrKey}"></script>` : "";
  // TTR OS's "Suggest a change" bar, on Vercel previews only (never the live site). It does nothing unless the page was opened
  // from the client's private review link (a review token after #); the client highlights words and leaves notes for TTR.
  const review = process.env.VERCEL_ENV === "preview" ? '<script defer src="https://ttr-portal.vercel.app/api/site/notes/bar"></script>' : "";
  // tuneHtml: Tag Manager and reCAPTCHA after the first interaction, hero image preload, font preloads, lazy footer images (lib/site/tune.ts).
  const rendered = renderDocument(resolved, site.data, path, { projectId, dataset, origin });
  // One stylesheet instead of 22 to 26, only once that bundle is known to be served (lib/site/bundles.ts).
  const bundle = stylesheetBundle(rendered);
  const cssBundle = bundle && (await bundleServed(bundle)) ? bundle : undefined;
  const html = tuneHtml(rendered, { cssBundle }).replace("</body>", `${tracker}${review}</body>`);
  // Draft preview (lib/preview.ts): unpublished content is never cached or indexed.
  const draft = (await draftMode()).isEnabled;
  return new Response(html, {
    status: resolved.kind === "notFound" ? 404 : 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "X-Content-Source": site.fromCms ? "cms" : "built-in",
      "Cache-Control": draft ? "private, no-store" : `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
      ...(draft ? { "X-Robots-Tag": "noindex, nofollow", "X-Preview": "drafts" } : {}),
    },
  });
}

function xml(body: string, type = "application/xml; charset=UTF-8") {
  return new Response(body, { headers: { "Content-Type": type } });
}
