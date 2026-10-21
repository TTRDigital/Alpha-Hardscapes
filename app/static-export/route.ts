import { allPaths, getSite } from "@/lib/site/data";

/**
 * Used only by scripts/export-static.mjs (SiteGround deploy): the list of
 * routed paths and the form settings, read from the same source the pages
 * use (Sanity, or the built-in copy). Not part of the exported site.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const site = await getSite();
  return Response.json(
    { fromCms: site.fromCms, paths: await allPaths(site.fromCms), forms: site.settings.forms || [] },
    { headers: { "X-Robots-Tag": "noindex" } },
  );
}
