import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { apiVersion, dataset, projectId } from "@/sanity/env";
import { buildSiteData, normalizePath, resolvePath, type SeedDoc } from "./local";
import type { ArchiveDoc, PageDoc, PostDoc, Resolved, SiteData } from "./render";

/** ISR window for CMS content, in seconds. Publishing also refreshes via /api/revalidate. */
export const REVALIDATE_SECONDS = 300;

async function sanity<T>(query: string, params: Record<string, unknown> = {}): Promise<T | null> {
  const search = new URLSearchParams({ query, perspective: "published" });
  for (const [k, v] of Object.entries(params)) search.set(`$${k}`, JSON.stringify(v));
  const url = `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/${dataset}?${search}`;
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS, tags: ["sanity"] } });
    if (!res.ok) {
      console.warn(`[sanity] ${res.status} for ${query.slice(0, 60)}`);
      return null;
    }
    return ((await res.json()) as { result?: T }).result ?? null;
  } catch (err) {
    console.warn("[sanity] fetch failed", err);
    return null;
  }
}

/* ---------------- local fallback (content/seed.json) ---------------- */

let seedCache: SeedDoc[] | null = null;
function seed(): SeedDoc[] {
  if (!seedCache) seedCache = JSON.parse(readFileSync(join(process.cwd(), "content/seed.json"), "utf8")) as SeedDoc[];
  return seedCache;
}

/* ---------------- queries ---------------- */

const SETTINGS = `*[_id == "siteSettings"][0]{..., header->, footer->, popups[]->}`;
const POSTS = `*[_type == "post" && defined(path)] | order(date desc){
  _id, _type, wpId, title, path, date, excerpt, featuredImage, featuredMedium, cardClass, articleClass,
  "author": author->{name, "slug": slug.current},
  "categories": categories[]->{name, "slug": slug.current}
}`;
const BY_PATH = `*[_type in ["page", "post", "archivePage"] && path == $path][0]{
  ...,
  _type == "post" => {
    "author": author->{name, "slug": slug.current},
    "categories": categories[]->{name, "slug": slug.current}
  },
  _type == "archivePage" => {"slug": coalesce(author->slug.current, category->slug.current)}
}`;

type Settings = { siteUrl?: string; postsPerPage?: number; forms?: FormSetting[] } & SiteData["settings"];
export type FormSetting = { name?: string; formKey?: string; redirect?: string; message?: string; tag?: string };

/** True once the CMS has been loaded (npm run seed). Until then the built-in copy is used. */
async function cmsSettings(): Promise<Settings | null> {
  return sanity<Settings>(SETTINGS);
}

export async function getSite(): Promise<{ data: SiteData; settings: Settings; fromCms: boolean }> {
  // SITE_CONTENT=local forces the built-in copy (e.g. to compare with the CMS).
  const settings = process.env.SITE_CONTENT === "local" ? null : await cmsSettings();
  // Only trust settings that point at this site's header template.
  if (settings?.header?.tpl) {
    const posts = (await sanity<SiteData["posts"]>(POSTS)) || [];
    return {
      data: { settings: { ...settings, popups: (settings.popups || []).filter(Boolean) }, posts },
      settings,
      fromCms: true,
    };
  }
  const docs = seed();
  const data = buildSiteData(docs);
  const raw = docs.find((d) => d._id === "siteSettings") as Settings | undefined;
  return { data, settings: { ...data.settings, forms: raw?.forms }, fromCms: false };
}

export async function resolve(rawPath: string, fromCms: boolean): Promise<Resolved | null> {
  if (!fromCms) return resolvePath(seed(), rawPath);
  const path = normalizePath(rawPath);
  const pageMatch = /^(.*\/)page\/(\d+)\/$/.exec(path);
  if (pageMatch) {
    const archive = await sanity<ArchiveDoc>(BY_PATH, { path: pageMatch[1] });
    if (archive?._type === "archivePage") return { kind: "archive", doc: archive, page: Number(pageMatch[2]) };
  }
  const doc = await sanity<SeedDoc>(BY_PATH, { path });
  if (doc?._type === "archivePage") return { kind: "archive", doc: doc as unknown as ArchiveDoc, page: 1 };
  if (doc?._type === "post") return { kind: "post", doc: doc as PostDoc };
  if (doc?._type === "page") return { kind: "page", doc: doc as PageDoc, ancestors: (doc.ancestorPaths as string[]) || [] };
  const nf = await sanity<SeedDoc>(`*[_id == "notFound"][0]`);
  return nf ? { kind: "notFound", doc: nf as never } : null;
}

/** Every routed path, for static generation and the sitemaps. */
export async function allPaths(fromCms: boolean): Promise<{ path: string; type: string; modified?: string; noindex?: boolean }[]> {
  const q = `*[_type in ["page", "post", "archivePage"] && defined(path)]{path, _type, "modified": coalesce(modified, seo.modifiedTime, _updatedAt), "robots": seo.robots}`;
  const rows = fromCms
    ? (await sanity<{ path: string; _type: string; modified?: string; robots?: string }[]>(q)) || []
    : seed()
        .filter((d) => ["page", "post", "archivePage"].includes(d._type) && d.path)
        .map((d) => ({ path: d.path as string, _type: d._type, modified: (d.modified as string) || (d.seo as { modifiedTime?: string })?.modifiedTime, robots: (d.seo as { robots?: string })?.robots }));
  return rows.map((r) => ({ path: r.path, type: r._type, modified: r.modified, noindex: /noindex/.test(r.robots || "") }));
}
