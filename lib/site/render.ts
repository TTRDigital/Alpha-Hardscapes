import shellsJson from "../generated/shells.json" with { type: "json" };
import { archiveCard, elementorPostsGrid, entryMeta, pagination, postNavigation, singleThumbnail, type PostSummary } from "../render/astra.ts";
import { injectBlogAssets } from "../render/blog-assets.ts";
import { renderBlogIndex, renderPostLayout, rendersAsBlogPost } from "../render/blog.ts";
import { escapeHtml } from "../render/html.ts";
import type { PtBlock } from "../render/portableText.ts";
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
/** A photo placed before a section heading of a post (blog design, lib/render/blog.ts). */
export type SectionImage = { _key?: string; heading?: string; image?: ElImage | null; caption?: string; ratio?: string; focus?: string };
export type PostDoc = BaseDoc & {
  date?: string;
  excerpt?: string;
  featuredImage?: ElImage | null;
  featuredMedium?: ElImage | null;
  author?: { name: string; slug: string } | null;
  categories?: { name: string; slug: string }[];
  articleClass?: string;
  cardClass?: string;
  /** The text: Portable Text, or Elementor nodes (`content`) for the posts built with the page builder. */
  body?: PtBlock[];
  content?: Fields[];
  /** Path of the service page the post supports, shown as the Related service card. */
  relatedPage?: string;
  /** One sentence for the call-to-action band after the third section. */
  ctaText?: string;
  sectionImages?: SectionImage[];
};
export type ArchiveDoc = BaseDoc & { kind: "blog" | "category" | "author"; slug?: string; authorName?: string; categoryName?: string; heading?: string };

/** What the blog needs to know about a page it links to. */
export type PageSummary = { path: string; title: string; description?: string; image?: string };
/** An author, with the photo and role line from the author's own page when it has them. */
export type AuthorInfo = { slug: string; name: string; bio?: string; role?: string; photo?: ElImage | null; avatar?: string };

export type SiteData = {
  settings: { siteUrl?: string; postsPerPage?: number; businessSchema?: string; header?: TemplateDoc | null; footer?: TemplateDoc | null; popups?: TemplateDoc[] };
  /** All posts, newest first. */
  posts: PostDoc[];
  pages?: PageSummary[];
  authors?: AuthorInfo[];
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
  // The blog design (lib/render/blog.ts) replaces the WordPress frame on posts and listings.
  let blog: { headLinks: string } | null = null;

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
    if (rendersAsBlogPost(post)) {
      const layout = renderPostLayout(post, data, ctx);
      values.content = layout.html;
      seo = layout.seo;
      blog = { headLinks: layout.headLinks };
    }
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
    if (a.kind === "blog" || a.kind === "category") {
      values.content = renderBlogIndex(a, slice, page, pages, data, ctx);
      blog = { headLinks: "" };
    }
    if (page > 1) {
      const cls = (a.bodyClass || "").split(/\s+/);
      // WordPress: "paged" after the first class, "paged-N" (and "<type>-paged-N") after wp-custom-logo.
      cls.splice(1, 0, "paged");
      const at = cls.indexOf("wp-custom-logo") + 1 || cls.length;
      cls.splice(at, 0, `paged-${page}`, ...(a.kind === "blog" ? [] : [`${a.kind}-paged-${page}`]));
      bodyClass = cls.join(" ");
    }
    seo = archiveSeo(a, page, pages);
    // Like Yoast's default: an author with no posts is an empty page, kept out of search (and the sitemap).
    if (a.kind === "author" && !list.length) seo = { ...seo, robots: "noindex, follow" };
  }

  const title = seo?.title || doc.title || "";
  values.seo = renderSeo(seo, opts.origin, data.settings.businessSchema);
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
  if (values.content === undefined) values.content = renderTpl(doc.frameTpl, doc, ctx);
  values.popups = usedPopups(
    sorted.map((p) => ({ id: String(p.wpId ?? ""), html: renderTpl(p.tpl, p, ctx) })),
    values.header + values.content + values.footer,
  ).join("\n");

  const shell = shells[doc.shell || ""] || shells[defaultShell(data)] || "";
  const html = renderTpl(shell, {}, ctx);
  return blog ? injectBlogAssets(html, blog.headLinks) : html;
}

/** Popup ids a piece of HTML can open: "popup:open" action links (plain or URL-encoded) and form actions. */
function popupIds(html: string): string[] {
  const ids: string[] = [];
  const add = (b64: string) => {
    try {
      const id = (JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as { id?: string | number }).id;
      if (id !== undefined) ids.push(String(id));
    } catch {}
  };
  for (const m of html.matchAll(/action(?:=|%3D)popup(?::|%3A)open(?:&amp;|&|%26)settings(?:=|%3D)([A-Za-z0-9+/%=]+)/g)) add(decodeURIComponent(m[1]));
  for (const m of html.matchAll(/popup_action_popup_id(?:&quot;|")\s*:\s*(?:&quot;|")?(\d+)/g)) ids.push(m[1]);
  return ids;
}

/**
 * Only the popups this page can open. None of the site's popups has a trigger of its own (timer, scroll,
 * exit intent): each opens from a link or a form on the page, or from another popup. Every page printed
 * all 12 (about a quarter of its HTML) though it opens one to three. A popup with triggers is always kept.
 */
function usedPopups(popups: { id: string; html: string }[], page: string): string[] {
  const keep = new Set(popupIds(page));
  for (const p of popups) if (/&quot;triggers&quot;:\{|"triggers":\{|&quot;timing&quot;:\{/.test(p.html.slice(0, 2000))) keep.add(p.id);
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of popups) {
      if (!keep.has(p.id)) continue;
      for (const id of popupIds(p.html)) {
        if (keep.has(id)) continue;
        keep.add(id);
        grew = true;
      }
    }
  }
  return popups.filter((p) => !p.id || keep.has(p.id)).map((p) => p.html);
}

function defaultShell(data: SiteData) {
  void data;
  return Object.keys(shells)[0];
}

export function notFoundHtml() {
  return `<!doctype html><title>${escapeHtml("Page not found")}</title>`;
}
