import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PtBlock, PtMarkDef, PtSpan, PtTextBlock } from "../render/portableText.ts";
import { ARTICLE_CSS, CTA_CSS } from "./codepages-css.ts";
import type { PageDoc, PostDoc, Resolved } from "./render.ts";

/**
 * Pages written by hand, as code, in the site's own design (TTR-2432).
 *
 * The text lives in content/code-pages/*.md exactly as drafted. Articles use the
 * same frame, header, footer, popups and styles as the site's posts (a copy of an
 * existing post's frame); the masonry text is one new section inside /masonry/.
 * Nothing here is published to Sanity: a page is only served where this code is deployed.
 */

const DIR = join(process.cwd(), "content/code-pages");
const read = (file: string) => readFileSync(join(DIR, file), "utf8");

/** The post whose frame, shell and popups the articles copy. */
const POST_FRAME_PATH = "/uncategorized/patio-around-outdoor-kitchen-ct/";

/** A photo already in the site's media library (public/wp-content/uploads); no new images are added. */
type Photo = { src: string; srcset: string; width: string; height: string; alt: string };
export type CodeArticle = { path: string; file: string; title: string; seoTitle: string; description: string; photo: Photo; related: string[] };

const PHOTO_PATIO: Photo = {
  src: "/wp-content/uploads/2024/12/alphahardscapes-image-9-1024x1024.webp",
  srcset:
    "/wp-content/uploads/2024/12/alphahardscapes-image-9.webp 1410w, /wp-content/uploads/2024/12/alphahardscapes-image-9-1024x1024.webp 1024w, /wp-content/uploads/2024/12/alphahardscapes-image-9-768x767.webp 768w, /wp-content/uploads/2024/12/alphahardscapes-image-9-300x300.webp 300w",
  width: "1024",
  height: "1024",
  alt: "Beautifully designed stone patio by Alpha Hardscapes in a residential backyard",
};
// The picture the site's own outdoor kitchens page uses for this service.
const PHOTO_KITCHEN: Photo = {
  src: "/wp-content/uploads/2026/04/custom-outdoor-kitchens-connecticut-stone-patio-design.png",
  srcset:
    "/wp-content/uploads/2026/04/custom-outdoor-kitchens-connecticut-stone-patio-design.png 702w, /wp-content/uploads/2026/04/custom-outdoor-kitchens-connecticut-stone-patio-design-240x300.png 240w",
  width: "702",
  height: "876",
  alt: "Custom outdoor kitchen by Alpha Hardscapes on a stone patio",
};

export const CODE_ARTICLES: CodeArticle[] = [
  {
    path: "/outdoor-kitchens-cheshire-ct/",
    file: "outdoor-kitchens-cheshire.md",
    title: "Outdoor Kitchens in Cheshire, CT",
    seoTitle: "Outdoor Kitchens in Cheshire, CT | Alpha Hardscapes",
    description: "Planning an outdoor kitchen in Cheshire? See how it fits with a patio and fire features, then call Alpha Hardscapes at (475) 227-6896.",
    photo: PHOTO_KITCHEN,
    // Posts the drafted text already links to.
    related: ["/uncategorized/patio-around-outdoor-kitchen-ct/", "/blog/outdoor-kitchen-cost-connecticut/"],
  },
  {
    path: "/blog/backyard-patio-ideas-connecticut/",
    file: "backyard-patio-ideas-connecticut.md",
    title: "Backyard Patio Ideas for Connecticut Homes",
    seoTitle: "Backyard Patio Ideas for Connecticut Homes | Alpha Hardscapes",
    description: "Six backyard patio ideas that work in Connecticut, from fire pits to outdoor kitchens. Call Alpha Hardscapes at (475) 227-6896.",
    photo: PHOTO_PATIO,
    related: [
      "/uncategorized/patio-around-outdoor-kitchen-ct/",
      "/uncategorized/paver-patio-vs-natural-stone-patio-connecticut/",
      "/blog/best-patio-materials-connecticut/",
    ],
  },
];

const MASONRY_CSS =
  ".elementor .elementor-element.elementor-element-cpmasonry{--display:flex;--flex-direction:column;--container-widget-width:100%;--container-widget-height:initial;--container-widget-flex-grow:0;--container-widget-align-self:initial;--flex-wrap-mobile:wrap;--padding-top:50px;--padding-bottom:50px;--padding-left:50px;--padding-right:50px}" +
  "@media(max-width:767px){.elementor .elementor-element.elementor-element-cpmasonry{--padding-top:30px;--padding-bottom:20px;--padding-left:10px;--padding-right:10px}}";

/** The masonry text is a section of this page, placed before its FAQ section. */
export const MASONRY_PATH = "/masonry/";
const MASONRY_HEADING = "Masonry Contractor in Connecticut";

/* ---------------- tiny markdown to Portable Text ---------------- */

let counter = 0;
const key = () => `cp${(counter++).toString(36)}`;

function inline(text: string): { children: PtSpan[]; markDefs: PtMarkDef[] } {
  const children: PtSpan[] = [];
  const markDefs: PtMarkDef[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) children.push({ _type: "span", _key: key(), text: text.slice(last, m.index), marks: [] });
    if (m[3] !== undefined) children.push({ _type: "span", _key: key(), text: m[3], marks: ["strong"] });
    else {
      const k = key();
      // Internal links are relative, like the rest of the site.
      markDefs.push({ _type: "link", _key: k, href: m[2].replace(/^https:\/\/alphahardscapes\.com/, "") });
      children.push({ _type: "span", _key: key(), text: m[1], marks: [k] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) children.push({ _type: "span", _key: key(), text: text.slice(last), marks: [] });
  return { children, markDefs };
}

export function markdownToBlocks(md: string, headingStyle = "h2"): PtBlock[] {
  const blocks: PtBlock[] = [];
  for (const raw of md.split(/\n{2,}/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    if (chunk.startsWith("## ")) blocks.push({ _type: "block", _key: key(), style: headingStyle, ...inline(chunk.slice(3)) });
    else if (chunk.startsWith("- ")) {
      for (const line of chunk.split("\n")) blocks.push({ _type: "block", _key: key(), style: "normal", listItem: "bullet", level: 1, ...inline(line.slice(2)) });
    } else blocks.push({ _type: "block", _key: key(), style: "normal", ...inline(chunk.replace(/\n/g, " ")) });
  }
  return blocks;
}

/* ---------------- elementor nodes, copied from the site's own templates ---------------- */

const STYLE = (css: string) => (css ? `<style>${css}</style>` : "");
const CONTAINER_TPL = (id: string, style = "", css = "") =>
  `${STYLE(css)}<div class="elementor-element elementor-element-${id} e-flex e-con-boxed e-con e-parent"${style ? ` style="${style}"` : ""} data-id="${id}" data-element_type="container" data-e-type="container"><div class="e-con-inner">[[@nodes:children]]</div></div>`;
const TEXT_TPL = (id: string) =>
  `<div class="elementor-element elementor-element-${id} elementor-widget elementor-widget-text-editor" data-id="${id}" data-element_type="widget" data-e-type="widget" data-widget_type="text-editor.default"><div class="elementor-widget-container">[[@rich:body]]</div></div>`;

function textContainer(id: string, blocks: PtBlock[], style = "", css = "") {
  return {
    _key: `${id}c`,
    elId: id,
    _type: "elContainer",
    tpl: CONTAINER_TPL(id, style, css),
    children: [{ _key: `${id}t`, elId: `${id}t`, _type: "elText", widget: "text-editor", tpl: TEXT_TPL(`${id}t`), body: blocks }],
  };
}

/* ---------------- resolving ---------------- */

type Resolve = (path: string) => Promise<Resolved | null>;

export function isCodePath(path: string) {
  return path === MASONRY_PATH || CODE_ARTICLES.some((a) => a.path === path);
}

/** A code page for this path, or null. `resolve` loads the site's own document for a path. */
export async function codePage(path: string, resolve: Resolve): Promise<Resolved | null> {
  if (path === MASONRY_PATH) {
    const base = await resolve(path);
    if (!base || base.kind !== "page") return null;
    const content = [...((base.doc.content as unknown[]) || [])] as { elId?: string; _type?: string; children?: { _type?: string }[] }[];
    // Before the FAQ section ("Frequently Asked Questions"), else at the end.
    const faq = content.findIndex((n) => JSON.stringify(n).includes("Frequently Asked Questions"));
    // Same container as the section above it (the testimonials, Elementor 22e37774): a boxed container with the page's
    // content width and 50px spacing, 30/20/10/10 on phones. Elementor keeps that per element id, so it is repeated here.
    const section = textContainer("cpmasonry", [
      { _type: "block", _key: key(), style: "h2", ...inline(MASONRY_HEADING) },
      ...markdownToBlocks(read("masonry-section.md"), "h3"),
    ], "", MASONRY_CSS);
    content.splice(faq >= 0 ? faq : content.length, 0, section as never);
    const doc: PageDoc = { ...base.doc, content: content as never };
    return { kind: "page", doc, ancestors: base.ancestors };
  }
  const art = CODE_ARTICLES.find((a) => a.path === path);
  if (!art) return null;
  const frame = await resolve(POST_FRAME_PATH);
  if (!frame || frame.kind !== "post") return null;
  const url = `https://alphahardscapes.com${art.path}`;
  const mas = await resolve(MASONRY_PATH);
  const ctaNode = mas && mas.kind === "page" ? ((mas.doc.content as unknown[]) || []).at(-1) : undefined;
  const cta = ctaNode && JSON.stringify(ctaNode).includes("elButton") ? ctaNode : undefined;
  const doc: PostDoc = {
    ...frame.doc,
    _id: `code-${art.file}`,
    title: art.title,
    path: art.path,
    wpId: undefined,
    date: "2026-11-19T12:00:00Z",
    author: null,
    categories: [],
    featuredImage: { _type: "wpImage", ...art.photo, attrs: 'class="attachment-large size-large wp-post-image" decoding="async" fetchpriority="high"' },
    featuredMedium: null,
    related: art.related,
    articleClass: `${frame.doc.articleClass || ""} cp-article`,
    cardClass: frame.doc.cardClass,
    // The site's call-to-action band (the last section of /masonry/), under the article.
    cta: cta ? [cta] : [],
    // No author line and no date under the title: the byline is not confirmed yet.
    noMeta: true,
    // The copied frame carries the other post's id in its markup.
    frameTpl: withExtras((frame.doc.frameTpl || "").replaceAll(String(frame.doc.wpId), "0")),
    bodyClass: (frame.doc.bodyClass || "").replaceAll(String(frame.doc.wpId), "0"),
    seo: {
      title: art.seoTitle,
      description: art.description,
      // Not for search engines until Kia approves and the page is published.
      robots: "noindex, nofollow",
      canonical: url,
      ogLocale: "en_US",
      ogType: "article",
      ogTitle: art.seoTitle,
      ogDescription: art.description,
      ogUrl: url,
      ogSiteName: "Alpha Hardscapes",
      twitterCard: "summary_large_image",
    },
    content: [textContainer(`cp${art.file.length}a`, markdownToBlocks(read(art.file)))] as never,
  };
  return { kind: "post", doc };
}

/** Cards for related posts under the article, and the call-to-action band after the page content. */
function withExtras(tpl: string) {
  // Its own row under the article: the article container lays its children side by side.
  const cards = `<div class="site-content cp-related-wrap"><div class="ast-container"><div class="cp-related content-area primary ast-grid-3 ast-blog-layout-4-grid"><main class="site-main"><div class="ast-row">[[@ctx:related]]</div></main></div></div></div>`;
  const cta = `<div class="elementor" data-elementor-type="wp-post">[[@nodes:cta]]</div>`;
  return `${STYLE(ARTICLE_CSS + CTA_CSS)}${tpl}${cards}${cta}`;
}

export type { PtTextBlock };
