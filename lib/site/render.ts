import shellsJson from "../generated/shells.json" with { type: "json" };
import { archiveCard, elementorPostsGrid, entryMeta, pagination, postNavigation, singleThumbnail, type PostSummary } from "../render/astra.ts";
import { escapeHtml } from "../render/html.ts";
import { renderSeo, type Seo } from "../render/seo.ts";
import { renderTpl, type ElImage, type Fields, type RenderContext } from "../render/template.ts";

/**
 * Turns CMS documents into the full HTML document for a URL. Used by the
 * site route and by the migration check (scripts/verify.ts).
 */

const shells = shellsJson as Record<string, string>;

export type Ref = { _ref: string };
export type TemplateDoc = Fields & { _id: string; wpId?: number; kind?: string };
export type BaseDoc = Fields & {
  _id: string;
  _type: string;
  title?: string;
  path?: string;
  wpId?: number;
  seo?: Seo;
  bodyClass?: string;
  frameTpl?: string;
  shell?: string;
  popups?: number[];
};
export type PageDoc = BaseDoc & { parentPath?: string };
export type PostDoc = BaseDoc & {
  date?: string;
  excerpt?: string;
  featuredImage?: ElImage | null;
  featuredMedium?: ElImage | null;
  author?: { name: string; slug: string } | null;
  categories?: { name: string; slug: string }[];
  articleClass?: string;
  cardClass?: string;
};
export type ArchiveDoc = BaseDoc & { kind: "blog" | "category" | "author"; slug?: string; authorName?: string; categoryName?: string };

export type SiteData = {
  settings: { siteUrl?: string; postsPerPage?: number; header?: TemplateDoc | null; footer?: TemplateDoc | null; popups?: TemplateDoc[] };
  /** All posts, newest first. */
  posts: PostDoc[];
};

export type Resolved =
  | { kind: "page"; doc: PageDoc; ancestors: string[] }
  | { kind: "post"; doc: PostDoc }
  | { kind: "archive"; doc: ArchiveDoc; page: number }
  | { kind: "notFound"; doc: BaseDoc };

export type RenderOptions = {
  projectId: string;
  dataset: string;
  /** Public origin, e.g. https://alphahardscapes.com. Absolute SEO URLs use it. */
  origin?: string;
};

function postSummary(p: PostDoc): PostSummary {
  return {
    wpId: p.wpId,
    title: p.title || "",
    path: p.path || "/",
    date: p.date || new Date().toISOString(),
    excerpt: p.excerpt,
    featuredImage: p.featuredImage,
    featuredMedium: p.featuredMedium,
    author: p.author,
    categories: p.categories,
    articleClass: p.cardClass,
  };
}

function elementorPost(doc: BaseDoc, title: string, featured?: string | false) {
  const img = featured ? `"${featured.replace(/\//g, "\\/")}"` : "false";
  return `{"id":${doc.wpId ?? 0},"title":"${encodeURIComponent(title).replace(/'/g, "%27")}","excerpt":"","featuredImage":${img}}`;
}

function archiveSeo(doc: ArchiveDoc, page: number, pages: number): Seo | undefined {
  if (page <= 1 || !doc.seo) return doc.seo;
  const s = { ...doc.seo };
  const suffix = ` - Page ${page} of ${pages}`;
  if (s.title) s.title = s.title.replace(/ \| /, `${suffix} | `);
  if (s.ogTitle) s.ogTitle = s.ogTitle.replace(/ \| /, `${suffix} | `);
  const url = `${(s.canonical || "").replace(/\/$/, "")}/page/${page}/`;
  s.canonical = url;
  s.ogUrl = url;
  return s;
}

export function renderDocument(resolved: Resolved, data: SiteData, path: string, opts: RenderOptions): string {
  const { doc } = resolved;
  const values: Record<string, string> = {};
  const ctx: RenderContext = {
    path: resolved.kind === "archive" ? resolved.doc.path || path : path,
    values,
    inBlog: resolved.kind !== "page",
    postsPagePath: "/blog/",
    ancestorPaths: resolved.kind === "page" ? resolved.ancestors : [],
    image: { projectId: opts.projectId, dataset: opts.dataset },
  };
  let seo = doc.seo;
  let bodyClass: string | undefined;

  if (resolved.kind === "post") {
    const post = resolved.doc;
    const summary = postSummary(post);
    const idx = data.posts.findIndex((p) => p._id === post._id);
    // Astra: "previous" is the older post, "next" the newer one.
    const older = idx >= 0 ? data.posts[idx + 1] : undefined;
    const newer = idx > 0 ? data.posts[idx - 1] : undefined;
    values.entryMeta = entryMeta(summary);
    values.thumbnail = singleThumbnail(summary, ctx);
    values.postNav = postNavigation(older ? postSummary(older) : null, newer ? postSummary(newer) : null);
    values.articleClass = post.articleClass || "";
  }

  if (resolved.kind === "archive") {
    const a = resolved.doc;
    const perPage = data.settings.postsPerPage || 10;
    const list = data.posts.filter((p) =>
      a.kind === "author" ? p.author?.slug === a.slug : a.kind === "category" ? p.categories?.some((c) => c.slug === a.slug) : true,
    );
    const pages = Math.max(1, Math.ceil(list.length / perPage));
    const page = resolved.page;
    const slice = list.slice((page - 1) * perPage, page * perPage);
    values.cards = slice.map((p, i) => archiveCard(postSummary(p), ctx, i)).join("");
    values.pagination = pagination(a.path || "/", page, pages);
    values.elementorArchive = elementorPostsGrid(slice.map(postSummary), ctx, a.path || "/", page, pages);
    if (page > 1) {
      const cls = (a.bodyClass || "").split(/\s+/);
      // WordPress: "paged" after the first class, "paged-N" (and "<type>-paged-N") after wp-custom-logo.
      cls.splice(1, 0, "paged");
      const at = cls.indexOf("wp-custom-logo") + 1 || cls.length;
      cls.splice(at, 0, `paged-${page}`, ...(a.kind === "blog" ? [] : [`${a.kind}-paged-${page}`]));
      bodyClass = cls.join(" ");
    }
    seo = archiveSeo(a, page, pages);
  }

  const title = seo?.title || doc.title || "";
  values.seo = renderSeo(seo, opts.origin);
  values.bodyClass = bodyClass ?? doc.bodyClass ?? "";
  values.queriedId = String(doc.wpId ?? "");
  values.refererTitle = title;
  values.permalinkJs = path;
  values.elementorPost = elementorPost(doc, title, (doc as PostDoc).featuredImage?.src || false);
  values.header = data.settings.header ? renderTpl(data.settings.header.tpl, data.settings.header, ctx) : "";
  values.footer = data.settings.footer ? renderTpl(data.settings.footer.tpl, data.settings.footer, ctx) : "";
  const popups = data.settings.popups || [];
  const order = doc.popups || [];
  const sorted = [...popups].sort((x, y) => (order.indexOf(x.wpId!) + 1 || 999) - (order.indexOf(y.wpId!) + 1 || 999));
  values.popups = sorted.map((p) => renderTpl(p.tpl, p, ctx)).join("\n");
  values.content = renderTpl(doc.frameTpl, doc, ctx);

  const shell = shells[doc.shell || ""] || shells[defaultShell(data)] || "";
  return renderTpl(shell, {}, ctx);
}

function defaultShell(data: SiteData) {
  void data;
  return Object.keys(shells)[0];
}

export function notFoundHtml() {
  return `<!doctype html><title>${escapeHtml("Page not found")}</title>`;
}
