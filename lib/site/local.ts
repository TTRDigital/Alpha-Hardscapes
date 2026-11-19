import { relativeUrl } from "../render/html.ts";
import type { ElImage, Fields } from "../render/template.ts";
import type { ArchiveDoc, AuthorInfo, PageDoc, PageSummary, PostDoc, Resolved, SiteData, TemplateDoc } from "./render.ts";

/**
 * Resolves references in raw documents (content/seed.json, or the same
 * documents fetched from Sanity) into the shapes the renderer needs.
 */

export type SeedDoc = Record<string, unknown> & { _id: string; _type: string };
type Ref = { _ref: string } | undefined;

function byId(docs: SeedDoc[]) {
  return new Map(docs.map((d) => [d._id, d]));
}

function deref(map: Map<string, SeedDoc>, ref: Ref) {
  return ref?._ref ? map.get(ref._ref) || map.get(ref._ref.replace(/^drafts\./, "")) : undefined;
}

function slugOf(d: SeedDoc | undefined) {
  const s = d?.slug as { current?: string } | string | undefined;
  return typeof s === "string" ? s : s?.current || "";
}

export function postView(map: Map<string, SeedDoc>, p: SeedDoc): PostDoc {
  const author = deref(map, p.author as Ref);
  const cats = ((p.categories as Ref[]) || []).map((r) => deref(map, r)).filter(Boolean) as SeedDoc[];
  return {
    ...(p as PostDoc),
    author: author ? { name: String(author.name || ""), slug: slugOf(author) } : null,
    categories: cats.map((c) => ({ name: String(c.name || ""), slug: slugOf(c) })),
  };
}

/** The pages the blog may link to: path, title, description and share image. */
export function pageSummaries(pages: SeedDoc[]): PageSummary[] {
  return pages
    .filter((d) => typeof d.path === "string")
    .map((d) => {
      const seo = (d.seo || {}) as { description?: string; ogImage?: string };
      return { path: d.path as string, title: String(d.title || ""), description: seo.description, image: seo.ogImage ? relativeUrl(seo.ogImage) : undefined };
    });
}

/** The author's photo and role line from the Elementor author page: its image, then the heading after the name. */
function authorPageBits(nodes: Fields[] | undefined, name: string): { photo?: ElImage | null; role?: string } {
  const out: { photo?: ElImage | null; role?: string } = {};
  const headings: string[] = [];
  const walk = (list: Fields[] | undefined) => {
    for (const n of list || []) {
      if (!out.photo && n._type === "elImage" && n.image) out.photo = n.image as ElImage;
      if (n._type === "elHeading" && typeof n.title === "string") headings.push(n.title.trim());
      walk(n.children as Fields[] | undefined);
    }
  };
  walk(nodes);
  const at = headings.indexOf(name.trim());
  const role = at >= 0 ? headings[at + 1] : undefined;
  if (role && !/^latest\b/i.test(role)) out.role = role;
  return out;
}

/** Authors with what their own pages add (photo, role). Used for the local copy and the CMS alike. */
export function authorsFrom(authorDocs: SeedDoc[], authorPages: { slug?: string; content?: unknown }[]): AuthorInfo[] {
  return authorDocs.map((a) => {
    const slug = slugOf(a);
    const name = String(a.name || "");
    const page = authorPages.find((p) => p.slug === slug);
    const bits = page ? authorPageBits(page.content as Fields[] | undefined, name) : {};
    return {
      slug,
      name,
      bio: a.description ? String(a.description) : undefined,
      avatar: a.avatar ? String(a.avatar) : undefined,
      photo: bits.photo || null,
      role: bits.role,
    };
  });
}

export function buildSiteData(docs: SeedDoc[]): SiteData {
  const map = byId(docs);
  const settings = map.get("siteSettings") || ({} as SeedDoc);
  const posts = docs
    .filter((d) => d._type === "post")
    .map((p) => postView(map, p))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const authorPages = docs
    .filter((d) => d._type === "archivePage" && d.kind === "author")
    .map((a) => ({ slug: slugOf(deref(map, a.author as Ref)), content: a.content }));
  return {
    settings: {
      businessSchema: settings.businessSchema as string,
      siteUrl: settings.siteUrl as string,
      postsPerPage: settings.postsPerPage as number,
      header: (deref(map, settings.header as Ref) as TemplateDoc) || null,
      footer: (deref(map, settings.footer as Ref) as TemplateDoc) || null,
      popups: ((settings.popups as Ref[]) || []).map((r) => deref(map, r)).filter(Boolean) as TemplateDoc[],
    },
    posts,
    pages: pageSummaries(docs.filter((d) => d._type === "page")),
    authors: authorsFrom(docs.filter((d) => d._type === "author"), authorPages),
  };
}

export function normalizePath(path: string) {
  let p = path.split(/[?#]/)[0] || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.endsWith("/")) p = `${p}/`;
  return p.replace(/\/{2,}/g, "/");
}

export function resolvePath(docs: SeedDoc[], rawPath: string): Resolved | null {
  const map = byId(docs);
  const path = normalizePath(rawPath);
  const pageMatch = /^(.*\/)page\/(\d+)\/$/.exec(path);
  const basePath = pageMatch ? pageMatch[1] : path;
  const page = pageMatch ? Number(pageMatch[2]) : 1;

  const archive = docs.find((d) => d._type === "archivePage" && d.path === basePath);
  if (archive) {
    const author = deref(map, archive.author as Ref);
    const category = deref(map, archive.category as Ref);
    const view: ArchiveDoc = {
      ...(archive as unknown as ArchiveDoc),
      slug: author ? slugOf(author) : category ? slugOf(category) : undefined,
    };
    return { kind: "archive", doc: view, page };
  }
  if (pageMatch) return notFound(map);
  const doc = docs.find((d) => (d._type === "page" || d._type === "post") && d.path === path);
  if (!doc) return notFound(map);
  if (doc._type === "post") return { kind: "post", doc: postView(map, doc) };
  const ancestors = (doc.ancestorPaths as string[]) || [];
  return { kind: "page", doc: doc as PageDoc, ancestors };
}

function notFound(map: Map<string, SeedDoc>): Resolved | null {
  const nf = map.get("notFound");
  return nf ? { kind: "notFound", doc: nf as never } : null;
}
