import placeholdersJson from "../generated/blog-placeholders.json" with { type: "json" };
import { formatDate, pagination } from "./astra.ts";
import { escapeAttr, escapeHtml, relativeUrl } from "./html.ts";
import { renderPortableText, type PtBlock, type PtTextBlock } from "./portableText.ts";
import { renderImage, type ElImage, type Fields, type RenderContext } from "./template.ts";
import type { ArchiveDoc, AuthorInfo, PageSummary, PostDoc, SiteData } from "../site/render.ts";
import type { Seo } from "./seo.ts";

/**
 * The blog design (October 2026): an editorial reading page for every post whose
 * text is Portable Text (the post's own `body`, or the text widgets of an Elementor
 * post), and a card grid for the blog and category listings.
 *
 * Post page, top to bottom: hero (photo, category pill, title, byline card with the
 * author's photo, date and reading time), "In short" box (the first paragraph, the
 * direct answer), jump links to every H2 (a sticky side column on desktop, a
 * details element on phones), the body with section photos, a numbered timeline for
 * step lists, icon cards for option lists, a call-to-action band after the third
 * H2, FAQ cards, the related service page, the author card and three more posts.
 *
 * The approved text is never changed: every heading, sentence and link is printed
 * as it is, only wrapped in the new markup. Everything works without JavaScript;
 * the few lines in blog-assets.ts only add the scroll reveal, the reading progress
 * bar and the current jump link.
 */

/** Blur placeholders of the blog photos (npm run blog-images). */
const placeholders = placeholdersJson as Record<string, string>;

const WORDS_PER_MINUTE = 220;
const PHONE = { label: "(475) 227-6896", href: "tel:4752276896" };
/** The site's logo mark, the placeholder for a post without a photo. */
const LOGO_ICON = "/wp-content/uploads/2025/06/alphahardscapes-logo-icon-green.svg";
/** Widths the Next.js image optimizer answers (its default deviceSizes and imageSizes), the ones worth listing. */
const OPT_WIDTHS = [384, 640, 828, 1080, 1200, 1920];
const HERO_WIDTHS = [640, 750, 828, 1080, 1200, 1920];
const FIGURE_WIDTHS = [640, 828, 1080, 1200];
const CARD_WIDTHS = [384, 640, 828];
const BIG_CARD_WIDTHS = [640, 828, 1200];

type Piece =
  | { kind: "h2"; id: string; text: string; html: string }
  | { kind: "h3"; text: string; html: string }
  | { kind: "p"; text: string; html: string }
  | { kind: "list"; ordered: boolean; nested: boolean; items: { html: string; text: string }[]; html: string; text: string }
  | { kind: "html"; text: string; html: string };

type Faq = { q: string; a: string; html: string };

/* ---------------- text helpers ---------------- */

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#8217;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/, "");
  return s || "section";
}

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

function sentences(text: string, n: number): string {
  const parts = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  return parts.slice(0, n).join("").trim();
}

function isoDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/* ---------------- images ---------------- */

/** The largest file WordPress generated for an image (its srcset), or the src itself. */
function largestSource(img: ElImage): { src: string; width: number; height: number } | null {
  const w = Number(img.width) || 0;
  const h = Number(img.height) || 0;
  let best: { src: string; width: number } | null = img.src ? { src: img.src, width: w } : null;
  for (const m of (img.srcset || "").matchAll(/(\S+)\s+(\d+)w/g)) {
    const cw = Number(m[2]);
    if (!best || cw > best.width) best = { src: m[1], width: cw };
  }
  if (!best) return null;
  const ratio = w && h ? h / w : 0;
  return { src: best.src, width: best.width || w, height: ratio ? Math.round(best.width * ratio) : h };
}

function optimizedUrl(src: string, width: number) {
  return `/_next/image/?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

type Picture = { src: string; srcset: string; width: number; height: number; alt: string; placeholder?: string };

/**
 * A responsive picture served through the Next.js image optimizer (WebP, resized)
 * from a photo in public/wp-content/uploads. Replacement uploads from the CMS keep
 * the Sanity image URLs (renderImage).
 */
function picture(img: ElImage | null | undefined, maxWidth: number, fallbackAlt = "", candidates = OPT_WIDTHS): Picture | null {
  if (!img) return null;
  const big = largestSource(img);
  if (!big || !big.src.startsWith("/")) return null;
  const widths = candidates.filter((w) => w <= Math.max(big.width, 384) && w <= maxWidth);
  if (!widths.length) widths.push(384);
  const main = widths[Math.min(widths.length - 1, Math.max(0, widths.indexOf(828)))] || widths[widths.length - 1];
  return {
    src: optimizedUrl(big.src, main),
    srcset: widths.map((w) => `${optimizedUrl(big.src, w)} ${w}w`).join(", "),
    width: big.width,
    height: big.height,
    alt: img.alt || fallbackAlt,
    placeholder: placeholders[big.src],
  };
}

type ImgOptions = { sizes: string; loading?: "lazy" | "eager"; priority?: boolean; className?: string; style?: string; widths?: number[]; blur?: boolean; focus?: string };

function imgTag(img: ElImage | null | undefined, maxWidth: number, fallbackAlt: string, o: ImgOptions, ctx: RenderContext): string {
  if (!img) return "";
  if (img.upload?.asset?._ref) {
    // A photo replaced in the CMS: the existing renderer builds its Sanity URLs.
    const html = renderImage({ ...img, attrs: `class="${escapeAttr(o.className || "")}" decoding="async"${o.loading === "lazy" ? ' loading="lazy"' : ""}` }, ctx);
    return html;
  }
  const p = picture(img, maxWidth, fallbackAlt, o.widths);
  if (!p) return "";
  // A tiny blurred copy of the photo paints behind it while the real file loads.
  const blur = o.blur && p.placeholder ? `background:url(${p.placeholder}) ${o.focus || "50% 50%"}/cover no-repeat` : "";
  const style = [o.style, blur].filter(Boolean).join(";");
  const attrs = [
    o.className ? `class="${escapeAttr(o.className)}"` : "",
    `width="${p.width}"`,
    `height="${p.height}"`,
    `src="${escapeAttr(p.src)}"`,
    `srcset="${escapeAttr(p.srcset)}"`,
    `sizes="${escapeAttr(o.sizes)}"`,
    `alt="${escapeAttr(p.alt)}"`,
    'decoding="async"',
    o.priority ? 'fetchpriority="high"' : "",
    o.loading === "lazy" ? 'loading="lazy"' : "",
    style ? `style="${escapeAttr(style)}"` : "",
  ];
  return `<img ${attrs.filter(Boolean).join(" ")}>`;
}

/* ---------------- the post text as pieces ---------------- */

/**
 * The text of a post as Portable Text blocks: the `body` field, or the text widgets
 * of an Elementor post in order. Null when the post has other widgets (buttons,
 * images, maps): that post keeps its Elementor layout.
 */
export function postBlocks(post: PostDoc): PtBlock[] | null {
  if (Array.isArray(post.body) && post.body.length) return post.body as PtBlock[];
  const nodes = post.content as Fields[] | undefined;
  if (!nodes?.length) return null;
  const out: PtBlock[] = [];
  let ok = true;
  const walk = (list: Fields[]) => {
    for (const n of list) {
      if (!ok) return;
      if (n._type === "elContainer") {
        walk((n.children as Fields[]) || []);
        continue;
      }
      if ((n._type === "elText" || n._type === "elRichText") && Array.isArray(n.body)) {
        out.push(...(n.body as PtBlock[]));
        continue;
      }
      ok = false;
    }
  };
  walk(nodes);
  return ok && out.length ? out : null;
}

const TOP_LEVEL = /<(h2|h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

/** Raw HTML (the oldest posts) cut into headings, paragraphs and the rest, in order. */
function htmlPieces(html: string): Piece[] {
  const out: Piece[] = [];
  const rest = (s: string) => {
    if (s.trim()) out.push({ kind: "html", html: s, text: stripTags(s) });
  };
  let last = 0;
  TOP_LEVEL.lastIndex = 0;
  for (const m of html.matchAll(TOP_LEVEL)) {
    const at = m.index ?? 0;
    if (at > last) rest(html.slice(last, at));
    const tag = m[1].toLowerCase();
    const text = stripTags(m[3]);
    if (tag === "h2") out.push({ kind: "h2", id: "", text, html: m[0] });
    else if (tag === "h3") out.push({ kind: "h3", text, html: m[0] });
    else out.push({ kind: "p", text, html: m[0] });
    last = at + m[0].length;
  }
  if (last < html.length) rest(html.slice(last));
  return out;
}

function toPieces(blocks: PtBlock[]): Piece[] {
  const out: Piece[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b._type === "htmlBlock") {
      out.push(...htmlPieces(b.html));
      i++;
      continue;
    }
    if (b.listItem) {
      let j = i;
      while (j < blocks.length) {
        const x = blocks[j];
        if (x._type !== "block" || !x.listItem) break;
        j++;
      }
      const run = blocks.slice(i, j) as PtTextBlock[];
      const items = run
        .filter((x) => (x.level || 1) === 1)
        .map((x) => {
          const inner = renderPortableText([{ ...x, listItem: undefined, level: undefined, style: "normal" }]).replace(/^<p>/, "").replace(/<\/p>$/, "");
          return { html: inner, text: stripTags(inner) };
        });
      const html = renderPortableText(run);
      out.push({ kind: "list", ordered: run[0].listItem === "number", nested: run.some((x) => (x.level || 1) > 1), items, html, text: stripTags(html) });
      i = j;
      continue;
    }
    const html = renderPortableText([b]);
    const text = stripTags(html);
    const style = b.style || "normal";
    if (style === "h2") out.push({ kind: "h2", id: "", text, html });
    else if (style === "h3") out.push({ kind: "h3", text, html });
    else if (style === "normal") out.push({ kind: "p", text, html });
    else out.push({ kind: "html", text, html });
    i++;
  }
  return out;
}

function withId(piece: Piece & { kind: "h2" }, id: string): string {
  return piece.html.replace(/^<h2([^>]*?)(\s+id="[^"]*")?([^>]*)>/i, (_m, a: string, _old: string, c: string) => `<h2 id="${escapeAttr(id)}"${a}${c}>`);
}

/* ---------------- icons ---------------- */

const ICON_CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M5 12h13m-5-6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_PHONE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6.6 3h3l1.6 4-2.1 1.4a12 12 0 0 0 6.5 6.5L17 12.8l4 1.6v3A2.6 2.6 0 0 1 18.3 20 16.3 16.3 0 0 1 4 5.7 2.6 2.6 0 0 1 6.6 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/* ---------------- shared bits ---------------- */

type SiteLinks = { phone: { label: string; href: string }; quote: string };

/** Phone number and quote button of the header, so the blog buttons do what the header does. */
function siteLinks(data: SiteData): SiteLinks {
  const out: SiteLinks = { phone: PHONE, quote: "/contact/" };
  let quoteFound = false;
  const walk = (list: Fields[] | undefined) => {
    for (const n of list || []) {
      const iconLink = typeof n.iconLink === "string" ? n.iconLink : typeof n.link === "string" ? n.link : "";
      if (iconLink.startsWith("tel:") && typeof n.title === "string" && n.title.trim()) out.phone = { label: n.title.trim(), href: iconLink };
      if (!quoteFound && n._type === "elButton" && typeof n.text === "string" && /quote/i.test(n.text) && typeof n.link === "string" && n.link) {
        out.quote = n.link;
        quoteFound = true;
      }
      walk(n.children as Fields[] | undefined);
    }
  };
  walk(data.settings.header?.content as Fields[] | undefined);
  return out;
}

function quoteButton(links: SiteLinks, text = "Book Your Quote", extra = "") {
  return `<a class="ah-btn${extra}" href="${escapeAttr(links.quote)}">${escapeHtml(text)}</a>`;
}

function phoneLink(links: SiteLinks, extra = "") {
  return `<a class="ah-phone${extra}" href="${escapeAttr(links.phone.href)}">${ICON_PHONE}<span>${escapeHtml(links.phone.label)}</span></a>`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function authorOf(post: PostDoc, data: SiteData): AuthorInfo | null {
  if (!post.author) return null;
  const known = (data.authors || []).find((a) => a.slug === post.author?.slug);
  return known || { slug: post.author.slug, name: post.author.name };
}

function avatar(author: AuthorInfo, size: number, ctx: RenderContext, cls = "ah-avatar") {
  if (author.photo) {
    const img = imgTag({ ...author.photo, alt: author.name }, 384, author.name, { sizes: `${size}px`, className: `${cls}__img`, loading: "lazy", widths: [384] }, ctx);
    if (img) return `<span class="${cls}">${img.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</span>`;
  }
  return `<span class="${cls} ${cls}--mono" aria-hidden="true">${escapeHtml(initials(author.name))}</span>`;
}

/** Categories worth showing: WordPress' placeholder "Uncategorized" is left out. */
function shownCategories(post: PostDoc) {
  return (post.categories || []).filter((c) => c.name && c.slug && c.name.toLowerCase() !== "uncategorized");
}

function categoryPills(post: PostDoc) {
  const cats = shownCategories(post);
  if (!cats.length) return "";
  return `<div class="ah-pills">${cats.map((c) => `<a class="ah-pill" href="/category/${escapeAttr(c.slug)}/" rel="category tag">${escapeHtml(c.name)}</a>`).join("")}</div>`;
}

function dateTime(iso: string) {
  return `<time datetime="${escapeAttr(isoDate(iso))}">${escapeHtml(formatDate(iso))}</time>`;
}

/** Word count of a post from whichever text it has (for reading time on cards). */
export function postWordCount(post: PostDoc): number {
  const blocks = postBlocks(post);
  if (blocks) return words(stripTags(renderPortableText(blocks)));
  return words(String(post.excerpt || ""));
}

/* ---------------- cards ---------------- */

function postCard(post: PostDoc, ctx: RenderContext, opts: { heading: "h2" | "h3"; excerpt: boolean; sizes: string; big?: boolean }) {
  const title = post.title || "";
  const img = imgTag(post.featuredImage, opts.big ? 1200 : 828, title, { sizes: opts.sizes, loading: "lazy", className: "ah-card__img", widths: opts.big ? BIG_CARD_WIDTHS : CARD_WIDTHS }, ctx);
  const cat = shownCategories(post)[0];
  const minutes = readingMinutes(postWordCount(post));
  return (
    `<article class="ah-card ah-reveal${opts.big ? " ah-card--big" : ""}">` +
    `<a class="ah-card__media" href="${escapeAttr(post.path || "/")}" tabindex="-1" aria-hidden="true">${img || `<span class="ah-card__blank"><img src="${LOGO_ICON}" width="56" height="66" alt="" loading="lazy" decoding="async"></span>`}</a>` +
    `<div class="ah-card__body">` +
    (cat ? `<a class="ah-pill ah-pill--small" href="/category/${escapeAttr(cat.slug)}/" rel="category tag">${escapeHtml(cat.name)}</a>` : "") +
    `<${opts.heading} class="ah-card__title"><a href="${escapeAttr(post.path || "/")}" rel="bookmark">${escapeHtml(title)}</a></${opts.heading}>` +
    (opts.excerpt && post.excerpt ? `<p class="ah-card__excerpt">${escapeHtml(post.excerpt.trim())}${/[.!?\u2026)"']$/.test(post.excerpt.trim()) ? "" : "\u2026"}</p>` : "") +
    `<p class="ah-card__meta">${post.author ? `<span>${escapeHtml(post.author.name)}</span>` : ""}${post.date ? dateTime(post.date) : ""}<span class="ah-card__time">${ICON_CLOCK}${minutes} min read</span></p>` +
    `</div></article>`
  );
}

/* ---------------- the post page ---------------- */

export type PostLayout = { html: string; seo: Seo | undefined; headLinks: string };

export function rendersAsBlogPost(post: PostDoc): boolean {
  return postBlocks(post) !== null;
}

export function renderPostLayout(post: PostDoc, data: SiteData, ctx: RenderContext): PostLayout {
  const blocks = postBlocks(post) || [];
  const all = toPieces(blocks);
  const author = authorOf(post, data);
  const links = siteLinks(data);
  const title = post.title || "";

  // The byline paragraph ("By <author>, ...") moves into the byline card; the next paragraph is the direct answer.
  let i = 0;
  let bylineNote = "";
  if (all[0]?.kind === "p" && author && /^by\s/i.test(all[0].text) && all[0].text.includes(author.name)) {
    const inner = all[0].html.replace(/^<p>/, "").replace(/<\/p>$/, "");
    const name = escapeHtml(author.name);
    bylineNote = inner.includes(name) ? inner.replace(name, `<a href="/author/${escapeAttr(author.slug)}/" rel="author">${name}</a>`) : inner;
    i = 1;
  }
  let inShort: Piece | null = null;
  if (all[i]?.kind === "p" && all[i].text.length >= 80) {
    inShort = all[i];
    i++;
  }
  const body = all.slice(i);

  // Ids on every H2 for the jump links.
  const used = new Set<string>();
  const toc: { id: string; text: string }[] = [];
  for (const p of body) {
    if (p.kind !== "h2" || !p.text) continue;
    let id = slugify(p.text);
    let n = 2;
    while (used.has(id)) id = `${slugify(p.text)}-${n++}`;
    used.add(id);
    p.id = id;
    toc.push({ id, text: p.text });
  }

  // The FAQ section: an H2 that says so, then question headings with their answers.
  const faq: Faq[] = [];
  let faqStart = -1;
  let faqEnd = -1;
  const faqAt = body.findIndex((p) => p.kind === "h2" && /frequently asked|^faqs?\b/i.test(p.text));
  if (faqAt >= 0) {
    let end = faqAt + 1;
    while (end < body.length && body[end].kind !== "h2") end++;
    const section = body.slice(faqAt + 1, end);
    let k = 0;
    while (k < section.length && section[k].kind === "p") k++; // an intro line stays as text
    const intro = k;
    // Question headings with their answers; anything else after them (a button, a list) stays as it is.
    while (k < section.length && section[k].kind === "h3") {
      let m = k + 1;
      const answers: Piece[] = [];
      while (m < section.length && section[m].kind === "p" && section[m].text) answers.push(section[m++]);
      if (!answers.length) break;
      faq.push({ q: section[k].text, a: answers.map((a) => a.text).join(" "), html: answers.map((a) => a.html).join("") });
      k = m;
    }
    if (faq.length >= 2) {
      faqStart = faqAt + 1 + intro;
      faqEnd = faqAt + 1 + k;
    } else faq.length = 0;
  }

  // Section photos go right before the H2 they belong to.
  const figures = new Map<number, string>();
  for (const s of post.sectionImages || []) {
    if (!s?.image || !s.heading) continue;
    const want = s.heading.trim().toLowerCase();
    const at = body.findIndex((p) => p.kind === "h2" && p.text.trim().toLowerCase() === want);
    if (at < 0) continue;
    const ratio = /^\d+(\.\d+)?\s*[:/]\s*\d+(\.\d+)?$/.test(s.ratio || "") ? (s.ratio as string).replace(/\s*[:/]\s*/, " / ") : "3 / 2";
    const focus = /^\d{1,3}%\s+\d{1,3}%$/.test(s.focus || "") ? (s.focus as string) : "50% 50%";
    const img = imgTag(s.image, 1200, title, { sizes: "(min-width: 1024px) 720px, 100vw", loading: "lazy", className: "ah-figure__img", style: `aspect-ratio:${ratio};object-position:${focus}`, widths: FIGURE_WIDTHS, blur: true, focus }, ctx);
    if (!img) continue;
    figures.set(at, `<figure class="ah-figure ah-reveal">${img}${s.caption ? `<figcaption>${escapeHtml(s.caption)}</figcaption>` : ""}</figure>`);
  }

  // The call-to-action band after the third section (never inside or after the FAQ).
  const h2At = body.map((p, idx) => (p.kind === "h2" ? idx : -1)).filter((x) => x >= 0);
  let ctaAt = -1;
  for (const candidate of [h2At[3], h2At[2]]) {
    if (candidate !== undefined && candidate !== faqAt && (faqAt < 0 || candidate < faqAt)) {
      ctaAt = candidate;
      break;
    }
  }
  const related = post.relatedPage ? (data.pages || []).find((p) => p.path === post.relatedPage) : undefined;
  const ctaText = post.ctaText?.trim() || "Have a project like this in mind? Tell us about your yard and we will come out, measure and give you a straight answer.";
  const ctaBand =
    `<aside class="ah-cta ah-reveal" aria-label="Get a quote"><div class="ah-cta__text"><p class="ah-eyebrow ah-eyebrow--light">Talk to Alpha Hardscapes</p><p class="ah-cta__line">${escapeHtml(ctaText)}</p></div>` +
    `<div class="ah-cta__actions">${quoteButton(links)}${phoneLink(links, " ah-phone--light")}</div></aside>`;

  // The body, piece by piece.
  const out: string[] = [];
  let lastHeading = "";
  for (let idx = 0; idx < body.length; idx++) {
    const p = body[idx];
    if (idx === ctaAt) out.push(ctaBand);
    const fig = figures.get(idx);
    if (fig) out.push(fig);
    if (faq.length && idx >= faqStart && idx < faqEnd) {
      if (idx === faqStart) out.push(renderFaq(faq));
      continue;
    }
    if (p.kind === "h2") {
      lastHeading = p.text;
      out.push(withId(p, p.id));
      continue;
    }
    if (p.kind === "list") {
      const prev = body[idx - 1];
      out.push(renderList(p, prev && prev.kind === "p" ? prev.text : "", lastHeading));
      continue;
    }
    out.push(p.html);
  }

  const wordCount = words(all.map((p) => p.text).join(" ")) + words(stripTags(title));
  const minutes = readingMinutes(wordCount);
  const dateIso = post.date || "";

  // Hero.
  const hero = post.featuredImage ? largestSource(post.featuredImage) : null;
  const heroWide = hero ? hero.width / Math.max(1, hero.height) > 2.2 : false;
  const heroImg = imgTag(post.featuredImage, 1920, title, {
    sizes: heroWide ? "(min-width: 1240px) 1160px, 100vw" : "(min-width: 1024px) 560px, 100vw",
    priority: true,
    loading: "eager",
    className: "ah-hero__img",
    widths: HERO_WIDTHS,
    blur: true,
  }, ctx);
  const heroClass = !heroImg ? "ah-hero--plain" : heroWide ? "ah-hero--wide" : "ah-hero--photo";
  const bylineName = author
    ? `<p class="ah-byline__name">By <a href="/author/${escapeAttr(author.slug)}/" rel="author">${escapeHtml(author.name)}</a>${author.role ? `<span class="ah-byline__role">, ${escapeHtml(author.role)}</span>` : ""}</p>`
    : "";
  const byline =
    `<div class="ah-byline">` +
    (author ? `<a class="ah-byline__avatar" href="/author/${escapeAttr(author.slug)}/" aria-hidden="true" tabindex="-1">${avatar(author, 56, ctx)}</a>` : "") +
    `<div class="ah-byline__who">${bylineNote ? `<p class="ah-byline__name">${bylineNote}</p>` : bylineName}` +
    `<p class="ah-byline__meta">${dateIso ? dateTime(dateIso) : ""}<span class="ah-byline__time">${ICON_CLOCK}${minutes} min read</span></p></div></div>`;
  const crumbs = `<nav class="ah-crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog/">Blog</a></nav>`;
  const heroHtml =
    `<header class="ah-hero ${heroClass}"><div class="ah-wrap ah-hero__grid">` +
    `<div class="ah-hero__text">${crumbs}${categoryPills(post)}<h1 class="ah-title entry-title">${escapeHtml(title)}</h1>${byline}</div>` +
    (heroImg ? `<div class="ah-hero__media">${heroImg}</div>` : "") +
    `</div></header>`;

  // Jump links, twice: a details element for phones and the sticky column for desktop.
  const tocList = toc.length ? `<ol class="ah-toc__list">${toc.map((t) => `<li><a href="#${escapeAttr(t.id)}">${escapeHtml(t.text)}</a></li>`).join("")}</ol>` : "";
  const tocMobile = tocList ? `<details class="ah-toc ah-toc--mobile"><summary>In this article <span class="ah-toc__count">${toc.length} sections</span></summary><nav aria-label="In this article">${tocList}</nav></details>` : "";
  const tocSide = tocList ? `<nav class="ah-toc ah-toc--side" aria-label="In this article"><p class="ah-side__title">In this article</p>${tocList}</nav>` : "";
  const cat = shownCategories(post)[0];
  const facts =
    `<div class="ah-facts"><p class="ah-side__title">Quick facts</p><dl>` +
    (dateIso ? `<div><dt>Published</dt><dd>${dateTime(dateIso)}</dd></div>` : "") +
    `<div><dt>Reading time</dt><dd>${minutes} min</dd></div>` +
    (cat ? `<div><dt>Topic</dt><dd><a href="/category/${escapeAttr(cat.slug)}/">${escapeHtml(cat.name)}</a></dd></div>` : "") +
    (related ? `<div><dt>Service</dt><dd><a href="${escapeAttr(related.path)}">${escapeHtml(related.title)}</a></dd></div>` : "") +
    `<div><dt>Call us</dt><dd><a href="${escapeAttr(links.phone.href)}">${escapeHtml(links.phone.label)}</a></dd></div>` +
    `</dl></div>`;
  const sideCta = `<div class="ah-side-cta"><p>Free quotes across Fairfield and New Haven County.</p>${quoteButton(links, "Book Your Quote", " ah-btn--block")}</div>`;

  const inShortHtml = inShort ? `<div class="ah-short"><p class="ah-short__label">In short</p>${inShort.html.replace(/^<p>/, '<p class="ah-short__text">')}</div>` : "";

  // After the article: the related service page, services the post links to, the author, more posts.
  const linked = new Set<string>();
  for (const m of all.map((p) => p.html).join("").matchAll(/href="([^"]+)"/g)) {
    const href = relativeUrl(m[1]).split(/[?#]/)[0];
    if (href.startsWith("/") && !href.startsWith("/blog/") && !href.startsWith("/uncategorized/") && !href.startsWith("/category/") && !href.startsWith("/author/") && href !== "/contact/" && href !== "/" && href !== post.relatedPage) linked.add(href.endsWith("/") ? href : `${href}/`);
  }
  const minis = [...linked]
    .map((href) => (data.pages || []).find((p) => p.path === href))
    .filter((p): p is PageSummary => Boolean(p))
    .slice(0, 3);
  let relatedHtml = "";
  if (related || minis.length) {
    const card = related
      ? `<div class="ah-related__card">` +
        (related.image ? `<a class="ah-related__media" href="${escapeAttr(related.path)}" tabindex="-1" aria-hidden="true"><img loading="lazy" decoding="async" width="1200" height="630" src="${escapeAttr(related.image)}" alt=""></a>` : "") +
        `<div class="ah-related__text"><p class="ah-eyebrow">Related service</p><h2 class="ah-h2" id="ah-related">${escapeHtml(related.title)}</h2>${related.description ? `<p>${escapeHtml(related.description)}</p>` : ""}<a class="ah-btn" href="${escapeAttr(related.path)}">See this service</a></div></div>`
      : "";
    const list = minis.length
      ? `<div class="ah-minis"><p class="ah-eyebrow">Related services</p><div class="ah-minis__grid">${minis.map((p) => `<a class="ah-mini" href="${escapeAttr(p.path)}"><span class="ah-mini__icon">${ICON_ARROW}</span><span>${escapeHtml(p.title)}</span></a>`).join("")}</div></div>`
      : "";
    relatedHtml = `<section class="ah-related ah-reveal" aria-label="Related service">${card}${list}</section>`;
  }

  let authorHtml = "";
  if (author) {
    const bio = author.bio ? sentences(author.bio, 3) : "";
    authorHtml =
      `<section class="ah-author-card ah-reveal" aria-label="About the author">${avatar(author, 120, ctx, "ah-author-card__photo")}<div class="ah-author-card__text"><p class="ah-eyebrow">About the author</p><h2 class="ah-h2">${escapeHtml(author.name)}</h2>` +
      (author.role ? `<p class="ah-author-card__role">${escapeHtml(author.role)}</p>` : "") +
      (bio ? `<p>${escapeHtml(bio)}</p>` : "") +
      `<a class="ah-btn ah-btn--outline" href="/author/${escapeAttr(author.slug)}/">More about ${escapeHtml(author.name.split(/\s+/)[0])}</a></div></section>`;
  }

  const sameCat = (p: PostDoc) => Boolean(cat && p.categories?.some((c) => c.slug === cat.slug));
  const others = data.posts.filter((p) => p._id !== post._id && p.path && p.featuredImage);
  const more = [...others.filter(sameCat), ...others.filter((p) => !sameCat(p))].slice(0, 3);
  const moreHtml = more.length
    ? `<section class="ah-more" aria-labelledby="ah-more-title"><div class="ah-wrap"><div class="ah-more__head"><h2 class="ah-h2" id="ah-more-title">More from the blog</h2><a class="ah-more__all" href="/blog/">All posts ${ICON_ARROW}</a></div><div class="ah-grid">${more.map((p) => postCard(p, ctx, { heading: "h3", excerpt: false, sizes: "(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" })).join("")}</div></div></section>`
    : "";

  // Astra's own article classes (padding, white card) stay off; the WordPress post classes are kept for anything that reads them.
  const articleClass = ["ah-article", ...(post.articleClass || "").split(/\s+/).filter((c) => c && !c.startsWith("ast-"))].join(" ");
  const html =
    `<div id="content" class="site-content"><div class="ah-blog ah-post-page">` +
    `<div class="ah-progress" aria-hidden="true"><div class="ah-progress__bar"></div></div>` +
    `<article class="${escapeAttr(articleClass)}" id="post-${post.wpId ?? ""}">${heroHtml}` +
    `<div class="ah-wrap ah-layout"><div class="ah-main">${inShortHtml}${tocMobile}<div class="ah-body entry-content">${out.join("")}</div></div>` +
    `<aside class="ah-side"><div class="ah-side__sticky">${tocSide}${facts}${sideCta}</div></aside></div>` +
    (relatedHtml || authorHtml ? `<div class="ah-wrap ah-after">${relatedHtml}${authorHtml}</div>` : "") +
    `</article>${moreHtml}</div></div>`;

  // Structured data: word count and reading time on the Article, FAQPage when the FAQ has none yet.
  const seo = post.seo ? { ...post.seo, schema: enrichSchema(post.seo.schema, { wordCount, minutes, faq, canonical: post.seo.canonical }) } : post.seo;

  // The hero photo is the largest paint: ask for it early.
  const heroPic = post.featuredImage && !post.featuredImage.upload?.asset?._ref ? picture(post.featuredImage, 1920, title, HERO_WIDTHS) : null;
  const headLinks = heroPic
    ? `<link rel="preload" as="image" href="${escapeAttr(heroPic.src)}" imagesrcset="${escapeAttr(heroPic.srcset)}" imagesizes="${heroWide ? "(min-width: 1240px) 1160px, 100vw" : "(min-width: 1024px) 560px, 100vw"}" fetchpriority="high">`
    : "";

  return { html, seo, headLinks };
}

function renderFaq(faq: Faq[]) {
  return `<div class="ah-faq">${faq.map((f) => `<div class="ah-faq__item ah-reveal"><h3 class="ah-faq__q">${escapeHtml(f.q)}</h3><div class="ah-faq__a">${f.html}</div></div>`).join("")}</div>`;
}

const STEP_WORDS = /\b(how|steps?|build|building|process|expect|install|installation|checklist|plan|way)\b/i;

/** Numbered lists become a timeline; option lists with bold lead-ins become icon cards. */
function renderList(p: Piece & { kind: "list" }, introText: string, headingText: string) {
  if (p.nested || p.items.length < 3) return p.html;
  const boldLead = p.items.every((it) => /^\s*<(strong|b)>/.test(it.html));
  if (p.ordered) return timeline(p.items);
  if (boldLead) return `<ul class="ah-cards">${p.items.map((it) => `<li class="ah-cards__item"><span class="ah-cards__icon" aria-hidden="true">${ICON_CHECK}</span><div class="ah-cards__text">${it.html}</div></li>`).join("")}</ul>`;
  if (p.items.length >= 4 && /:\s*$/.test(introText)) {
    if (STEP_WORDS.test(introText) || STEP_WORDS.test(headingText)) return timeline(p.items);
    return `<ul class="ah-cards ah-cards--check">${p.items.map((it) => `<li class="ah-cards__item"><span class="ah-cards__icon" aria-hidden="true">${ICON_CHECK}</span><div class="ah-cards__text">${it.html}</div></li>`).join("")}</ul>`;
  }
  return p.html;
}

function timeline(items: { html: string }[]) {
  return `<ol class="ah-steps">${items.map((it) => `<li class="ah-steps__item"><div class="ah-steps__text">${it.html}</div></li>`).join("")}</ol>`;
}

type Node = Record<string, unknown>;

export function enrichSchema(schema: string | undefined, info: { wordCount: number; minutes: number; faq: Faq[]; canonical?: string }): string | undefined {
  if (!schema) return schema;
  try {
    const json = JSON.parse(schema) as { "@graph"?: Node[] };
    const graph = [...(json["@graph"] || [])];
    let hasFaq = false;
    for (const node of graph) {
      const t = node["@type"];
      const types = Array.isArray(t) ? (t as string[]) : [String(t)];
      if (types.includes("Article") || types.includes("BlogPosting")) {
        if (node.wordCount == null) node.wordCount = info.wordCount;
        if (node.timeRequired == null) node.timeRequired = `PT${info.minutes}M`;
      }
      if (types.includes("FAQPage")) hasFaq = true;
    }
    if (!hasFaq && info.faq.length && info.canonical) {
      graph.push({
        "@type": "FAQPage",
        "@id": `${info.canonical}#faq`,
        mainEntity: info.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      });
    }
    return JSON.stringify({ ...json, "@graph": graph });
  } catch {
    return schema;
  }
}

/* ---------------- the blog and category listings ---------------- */

export function renderBlogIndex(archive: ArchiveDoc, posts: PostDoc[], page: number, pages: number, data: SiteData, ctx: RenderContext): string {
  const links = siteLinks(data);
  const heading = archive.heading || archive.title || "Blog";
  const isCategory = archive.kind === "category";

  // The author with the most posts leads the page.
  const counts = new Map<string, number>();
  for (const p of data.posts) if (p.author?.slug) counts.set(p.author.slug, (counts.get(p.author.slug) || 0) + 1);
  const topSlug = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const lead = topSlug ? (data.authors || []).find((a) => a.slug === topSlug) || { slug: topSlug, name: data.posts.find((p) => p.author?.slug === topSlug)?.author?.name || "" } : null;
  const leadLine = lead
    ? `Practical guides from ${lead.name} and the Alpha Hardscapes team on patios, walkways, retaining walls and fire features for Connecticut homeowners.`
    : "Practical guides on patios, walkways, retaining walls and fire features for Connecticut homeowners.";
  const strip = lead
    ? `<div class="ah-strip">${avatar(lead, 56, ctx)}<div class="ah-strip__who"><p class="ah-strip__name">${escapeHtml(lead.name)}</p>${lead.role ? `<p class="ah-strip__role">${escapeHtml(lead.role)}</p>` : ""}</div><a class="ah-strip__link" href="/author/${escapeAttr(lead.slug)}/">About ${escapeHtml(lead.name.split(/\s+/)[0])} ${ICON_ARROW}</a></div>`
    : "";

  // Category chips: static links. WordPress' placeholder "Uncategorized" is only shown on its own page.
  const cats = new Map<string, { name: string; slug: string }>();
  for (const p of data.posts) for (const c of p.categories || []) if (c.name && c.slug) cats.set(c.slug, c);
  const chips = [...cats.values()]
    .filter((c) => c.name.toLowerCase() !== "uncategorized" || (isCategory && archive.slug === c.slug))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `<a href="/category/${escapeAttr(c.slug)}/"${isCategory && archive.slug === c.slug ? ' aria-current="page"' : ""}>${escapeHtml(c.name)}</a>`);
  const chipsHtml = `<nav class="ah-chips" aria-label="Categories"><a href="/blog/"${isCategory ? "" : ' aria-current="page"'}>All posts</a>${chips.join("")}</nav>`;

  const cards = posts.map((p, i) =>
    postCard(p, ctx, {
      heading: "h2",
      excerpt: true,
      big: page === 1 && i === 0,
      sizes: page === 1 && i === 0 ? "(min-width: 1024px) 780px, 100vw" : "(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw",
    }),
  );
  const grid = cards.length ? `<div class="ah-grid ah-grid--index">${cards.join("")}</div>` : `<p class="ah-empty">No posts here yet.</p>`;
  const nav = pagination(archive.path || "/blog/", page, pages);

  const ask =
    `<section class="ah-ask ah-reveal" aria-label="Have a question"><div class="ah-wrap ah-ask__inner"><div><p class="ah-eyebrow ah-eyebrow--light">Have a question?</p><h2 class="ah-ask__title">Tell us about your yard and we will give you a straight answer.</h2>` +
    `<p class="ah-ask__text">Free quotes for patios, walkways, retaining walls, steps, outdoor kitchens and fire features across Fairfield and New Haven County.</p></div>` +
    `<div class="ah-cta__actions">${quoteButton(links)}${phoneLink(links, " ah-phone--light")}</div></div></section>`;

  return (
    `<div id="content" class="site-content"><div class="ah-blog ah-index-page">` +
    `<section class="ah-index-hero"><div class="ah-wrap"><p class="ah-eyebrow">${isCategory ? "Category" : "Alpha Hardscapes blog"}</p><h1 class="ah-title page-title ast-archive-title">${escapeHtml(heading)}</h1><p class="ah-lead">${escapeHtml(leadLine)}</p>${strip}</div></section>` +
    `<div class="ah-wrap ah-index-body">${chipsHtml}${grid}${nav}</div>${ask}</div></div>`
  );
}
