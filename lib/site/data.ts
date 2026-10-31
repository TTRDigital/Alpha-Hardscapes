import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPreview } from "@/lib/preview";
import { apiVersion, dataset, projectId } from "@/sanity/env";
import { relativeUrl } from "@/lib/render/html";
import { authorsFrom, buildSiteData, normalizePath, resolvePath, type SeedDoc } from "./local";
import type { ArchiveDoc, PageDoc, PageSummary, PostDoc, Resolved, SiteData } from "./render";

/** ISR window for CMS content, in seconds. Publishing also refreshes via /api/revalidate. */
export const REVALIDATE_SECONDS = 300;

/** Draft preview (lib/preview.ts): Sanity's drafts, with the read token, only while draft mode is on. */
async function previewToken(): Promise<string | undefined> {
  const token = process.env.SANITY_READ_TOKEN;
  return token && (await isPreview()) ? token : undefined;
}

async function sanity<T>(query: string, params: Record<string, unknown> = {}): Promise<T | null> {
  const token = await previewToken();
  const search = new URLSearchParams({ query, perspective: token ? "drafts" : "published" });
  for (const [k, v] of Object.entries(params)) search.set(`$${k}`, JSON.stringify(v));
  // Drafts come from the live API (the CDN only serves published content) and are never cached.
  const url = `https://${projectId}.${token ? "api" : "apicdn"}.sanity.io/v${apiVersion}/data/query/${dataset}?${search}`;
  try {
    const res = token
      ? await fetch(url, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } })
      : await fetch(url, { next: { revalidate: REVALIDATE_SECONDS, tags: ["sanity"] } });
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
  body, content, relatedPage, ctaText, sectionImages,
  "author": author->{name, "slug": slug.current},
  "categories": categories[]->{name, "slug": slug.current}
}`;
// The blog design needs the pages a post links to and the authors' own pages (photo, role).
const PAGES = `*[_type == "page" && defined(path)]{path, title, "description": seo.description, "image": seo.ogImage}`;
const AUTHORS = `*[_type == "author"]{_id, _type, name, slug, description, avatar}`;
const AUTHOR_PAGES = `*[_type == "archivePage" && kind == "author"]{"slug": author->slug.current, content}`;
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

/**
 * True when pages come from the built-in copy (content/seed.json) instead of the CMS:
 * SITE_CONTENT=local, or a Vercel preview deployment (every branch except production), so
 * content on a branch can be reviewed on its preview link before anything is sent to Sanity.
 * Production and local development are unchanged.
 */
export function localContent() {
  return process.env.SITE_CONTENT === "local" || process.env.VERCEL_ENV === "preview";
}

/** True once the CMS has been loaded (npm run seed). Until then the built-in copy is used. */
async function cmsSettings(): Promise<Settings | null> {
  return sanity<Settings>(SETTINGS);
}

export async function getSite(): Promise<{ data: SiteData; settings: Settings; fromCms: boolean }> {
  // SITE_CONTENT=local (and every Vercel preview deployment) forces the built-in copy.
  const settings = localContent() ? null : await cmsSettings();
  // Only trust settings that point at this site's header template.
  if (settings?.header?.tpl) {
    const [posts, pages, authorDocs, authorPages] = await Promise.all([
      sanity<SiteData["posts"]>(POSTS),
      sanity<PageSummary[]>(PAGES),
      sanity<SeedDoc[]>(AUTHORS),
      sanity<{ slug?: string; content?: unknown }[]>(AUTHOR_PAGES),
    ]);
    return {
      data: {
        settings: { ...settings, popups: (settings.popups || []).filter(Boolean) },
        posts: posts || [],
        pages: (pages || []).map((p) => ({ ...p, image: p.image ? relativeUrl(p.image) : undefined })),
        authors: authorsFrom(authorDocs || [], authorPages || []),
      },
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
