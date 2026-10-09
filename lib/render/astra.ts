import { escapeAttr, escapeHtml } from "./html.ts";
import { renderImage, type ElImage, type RenderContext } from "./template.ts";

/**
 * Blog markup printed by the Astra theme (single post header, previous/next
 * links, archive cards and pagination), rebuilt from post data so new posts
 * from the CMS look exactly like the WordPress ones.
 */

export type PostSummary = {
  wpId?: number;
  title: string;
  path: string;
  date: string;
  excerpt?: string;
  featuredImage?: ElImage | null;
  /** 300px version used by the Elementor posts grid. */
  featuredMedium?: ElImage | null;
  author?: { name: string; slug: string } | null;
  categories?: { name: string; slug: string }[];
  articleClass?: string;
};

const ARROW_LEFT =
  '<span class="ahfb-svg-iconset ast-inline-flex svg-baseline" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M134.059 296H436c6.627 0 12-5.373 12-12v-56c0-6.627-5.373-12-12-12H134.059v-46.059c0-21.382-25.851-32.09-40.971-16.971L7.029 239.029c-9.373 9.373-9.373 24.569 0 33.941l86.059 86.059c15.119 15.119 40.971 4.411 40.971-16.971V296z"></path></svg></span>';
const ARROW_RIGHT =
  '<span class="ahfb-svg-iconset ast-inline-flex svg-baseline" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M313.941 216H12c-6.627 0-12 5.373-12 12v56c0 6.627 5.373 12 12 12h301.941v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.569 0-33.941l-86.059-86.059c-15.119-15.119-40.971-4.411-40.971 16.971V216z"></path></svg></span>';

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function authorLink(post: PostSummary) {
  if (!post.author) return "";
  const name = escapeHtml(post.author.name);
  return `<span class="posted-by author"> <a class="url fn n" title="View all posts by ${escapeAttr(post.author.name)}" href="/author/${escapeAttr(post.author.slug)}/" rel="author"> <span class="author-name"> ${name} </span> </a> </span>`;
}

function postedOn(post: PostSummary) {
  return `<span class="posted-on"><span class="published" itemprop="datePublished"> ${escapeHtml(formatDate(post.date))} </span></span>`;
}

/** "By Author / June 19, 2026" under a single post title. */
export function entryMeta(post: PostSummary) {
  return `<div class="entry-meta">By ${authorLink(post)} / ${postedOn(post)}</div>`;
}

export function singleThumbnail(post: PostSummary, ctx: RenderContext) {
  if (!post.featuredImage) return "";
  return `<div class="post-thumb-img-content post-thumb">${renderImage(post.featuredImage, ctx)}</div>`;
}

export function postNavigation(prev: PostSummary | null, next: PostSummary | null) {
  if (!prev && !next) return "";
  const p = prev
    ? `<div class="nav-previous"><a title="${escapeAttr(prev.title)}" href="${escapeAttr(prev.path)}" rel="prev"><span class="ast-post-nav">${ARROW_LEFT} Previous</span> <p> ${escapeHtml(prev.title)}</p></a></div>`
    : "";
  const n = next
    ? `<div class="nav-next"><a title="${escapeAttr(next.title)}" href="${escapeAttr(next.path)}" rel="next"><span class="ast-post-nav">Next ${ARROW_RIGHT}</span> <p> ${escapeHtml(next.title)}</p></a></div>`
    : "";
  return `<nav class="navigation post-navigation" aria-label="Post navigation"> <span class="screen-reader-text">Post navigation</span> <div class="nav-links">${p}${n}</div> </nav>`;
}

/** One card of the blog/category/author grid (Astra blog layout 4). */
export function archiveCard(post: PostSummary, ctx: RenderContext, index = 0) {
  const thumb = post.featuredImage
    ? `<div class="post-thumb-img-content post-thumb"><a href="${escapeAttr(post.path)}" aria-label="Read: ${escapeAttr(post.title)}">${renderImage(post.featuredImage, ctx)}</a></div>`
    : "";
  const cats = (post.categories || [])
    .map((c) => `<a href="/category/${escapeAttr(c.slug)}/" rel="category tag">${escapeHtml(c.name)}</a>`)
    .join(", ");
  const articleClass = post.articleClass || `post-${post.wpId} post type-post status-publish format-standard hentry ast-grid-common-col ast-full-width ast-article-post remove-featured-img-padding`;
  return (
    `<article class="${escapeAttr(articleClass)}" id="post-${post.wpId ?? ""}">` +
    `<div class="ast-post-format- ${post.featuredImage ? "" : "ast-no-thumb "}blog-layout-4 ast-article-inner"><div class="post-content ast-grid-common-col">` +
    `<div class="ast-blog-featured-section post-thumb ast-blog-single-element">${thumb}</div>` +
    `<span class="ast-blog-single-element ast-taxonomy-container cat-links default">${cats}</span>` +
    `<h2 class="entry-title ast-blog-single-element"><a href="${escapeAttr(post.path)}" rel="bookmark">${escapeHtml(post.title)}</a></h2>` +
    `<header class="entry-header ast-blog-single-element ast-blog-meta-container"><div class="entry-meta">${authorLink(post)} / ${postedOn(post)}</div></header>` +
    // WordPress adds the "read more" mark to the first card of each page only.
    `<div class="ast-excerpt-container ast-blog-single-element"><p>${escapeHtml(post.excerpt || "")}${index === 0 ? " […]" : ""}</p></div>` +
    `<div class="entry-content clear"></div></div></div> </article>`
  );
}

/** WordPress paginate_links() output used under the blog grid. */
export function pagination(basePath: string, page: number, pages: number) {
  if (pages <= 1) return "";
  const url = (n: number) => (n === 1 ? basePath : `${basePath}page/${n}/`);
  const parts: string[] = [];
  if (page > 1) parts.push(`<a class="prev page-numbers" href="${url(page - 1)}"><span class="ast-left-arrow" aria-hidden="true">&larr;</span> Previous</a>`);
  for (let n = 1; n <= pages; n++) {
    parts.push(n === page ? `<span aria-current="page" class="page-numbers current">${n}</span>` : `<a class="page-numbers" href="${url(n)}">${n}</a>`);
  }
  if (page < pages) parts.push(`<a class="next page-numbers" href="${url(page + 1)}">Next <span class="ast-right-arrow" aria-hidden="true">&rarr;</span></a>`);
  return `<div class='ast-pagination'><nav class="navigation pagination" aria-label="Post pagination"> <span class="screen-reader-text">Post pagination</span> <div class="nav-links">${parts.join(" ")}</div> </nav></div>`;
}

/** Elementor "Archive posts" widget (classic skin), used by the author archive template. */
export function elementorPostsGrid(posts: PostSummary[], ctx: RenderContext, basePath: string, page: number, pages: number) {
  const cards = posts
    .map((post) => {
      const medium = post.featuredMedium || mediumFrom(post.featuredImage);
      const thumb = medium
        ? ` <a class="elementor-post__thumbnail__link" href="${escapeAttr(post.path)}" tabindex="-1" ><div class="elementor-post__thumbnail">${renderImage(medium, ctx)}</div> </a>`
        : "";
      const cls = (post.articleClass || `post-${post.wpId} post type-post status-publish format-standard hentry`)
        .split(/\s+/)
        .filter((c) => !["ast-article-post", "remove-featured-img-padding"].includes(c))
        .join(" ");
      return (
        `<article class="elementor-post elementor-grid-item ${escapeAttr(cls)}" role="listitem">${thumb}<div class="elementor-post__text">` +
        `<h3 class="elementor-post__title"> <a href="${escapeAttr(post.path)}" > ${escapeHtml(post.title)} </a></h3>` +
        `<div class="elementor-post__meta-data"> <span class="elementor-post-date"> ${escapeHtml(formatDate(post.date))} </span></div>` +
        `<div class="elementor-post__excerpt"><p>${escapeHtml(post.excerpt || "")}</p></div>` +
        ` <a class="elementor-post__read-more" href="${escapeAttr(post.path)}" aria-label="Read more about ${escapeAttr(post.title)}" tabindex="-1" > Read More » </a></div></article>`
      );
    })
    .join("");
  const url = (n: number) => (n === 1 ? basePath : `${basePath}page/${n}/`);
  const nums = Array.from({ length: pages }, (_, i) => i + 1)
    .map((n) =>
      n === page
        ? `<span aria-current="page" class="page-numbers current"><span class="elementor-screen-only">Page</span>${n}</span>`
        : `<a class="page-numbers" href="${url(n)}"><span class="elementor-screen-only">Page</span>${n}</a>`,
    )
    .join(" ");
  const anchor = `<div class="e-load-more-anchor" data-page="${page}" data-max-page="${pages}" data-next-page="${url(page + 1)}"></div>`;
  const nav = pages > 1 ? `<nav class="elementor-pagination" aria-label="Pagination"> ${nums}</nav>` : "";
  return `<div class="elementor-posts-container elementor-posts elementor-posts--skin-classic elementor-grid" role="list">${cards}</div>${anchor}${nav}`;
}

/** The 300px "medium" size WordPress generated, taken from the srcset. */
function mediumFrom(img: ElImage | null | undefined): ElImage | null {
  if (!img?.srcset) return null;
  const m = /(\S+)\s+300w/.exec(img.srcset);
  if (!m) return null;
  const w = Number(img.width) || 0;
  const h = Number(img.height) || 0;
  return { src: m[1], width: "300", height: w ? String(Math.round((300 * h) / w)) : undefined, alt: img.alt ?? "", attrs: 'class="attachment-medium size-medium"' };
}
