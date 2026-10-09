import { allPaths, getSite, resolve, REVALIDATE_SECONDS } from "@/lib/site/data";
import { feedXml, sitemapIndex, sitemapXml } from "@/lib/site/sitemaps";
import { guessRedirect } from "@/lib/site/guess";
import { renderDocument } from "@/lib/site/render";
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
  const html = renderDocument(resolved, site.data, path, { projectId, dataset, origin });
  return new Response(html, {
    status: resolved.kind === "notFound" ? 404 : 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "X-Content-Source": site.fromCms ? "cms" : "built-in",
      "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}

function xml(body: string, type = "application/xml; charset=UTF-8") {
  return new Response(body, { headers: { "Content-Type": type } });
}
