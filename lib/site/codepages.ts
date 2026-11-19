import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PtBlock, PtMarkDef, PtSpan, PtTextBlock } from "../render/portableText.ts";
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

export type CodeArticle = { path: string; file: string; title: string; seoTitle: string; description: string };

export const CODE_ARTICLES: CodeArticle[] = [
  {
    path: "/outdoor-kitchens-cheshire-ct/",
    file: "outdoor-kitchens-cheshire.md",
    title: "Outdoor Kitchens in Cheshire, CT",
    seoTitle: "Outdoor Kitchens in Cheshire, CT | Alpha Hardscapes",
    description: "Planning an outdoor kitchen in Cheshire? See how it fits with a patio and fire features, then call Alpha Hardscapes at (475) 227-6896.",
  },
  {
    path: "/blog/backyard-patio-ideas-connecticut/",
    file: "backyard-patio-ideas-connecticut.md",
    title: "Backyard Patio Ideas for Connecticut Homes",
    seoTitle: "Backyard Patio Ideas for Connecticut Homes | Alpha Hardscapes",
    description: "Six backyard patio ideas that work in Connecticut, from fire pits to outdoor kitchens. Call Alpha Hardscapes at (475) 227-6896.",
  },
];

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

const CONTAINER_TPL = (id: string, style = "") =>
  `<div class="elementor-element elementor-element-${id} e-flex e-con-boxed e-con e-parent"${style ? ` style="${style}"` : ""} data-id="${id}" data-element_type="container" data-e-type="container"><div class="e-con-inner">[[@nodes:children]]</div></div>`;
const TEXT_TPL = (id: string) =>
  `<div class="elementor-element elementor-element-${id} elementor-widget elementor-widget-text-editor" data-id="${id}" data-element_type="widget" data-e-type="widget" data-widget_type="text-editor.default"><div class="elementor-widget-container">[[@rich:body]]</div></div>`;

function textContainer(id: string, blocks: PtBlock[], style = "") {
  return {
    _key: `${id}c`,
    elId: id,
    _type: "elContainer",
    tpl: CONTAINER_TPL(id, style),
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
    // Before the FAQ section (the one with the accordion), else at the end.
    const faq = content.findIndex((n) => (n.children || []).some((c) => c._type === "elContainer") && JSON.stringify(n).includes('"elAccordion"'));
    const section = textContainer("cpmasonry", [
      { _type: "block", _key: key(), style: "h2", ...inline(MASONRY_HEADING) },
      ...markdownToBlocks(read("masonry-section.md"), "h3"),
    ], "padding:40px 24px");
    content.splice(faq >= 0 ? faq : content.length, 0, section as never);
    const doc: PageDoc = { ...base.doc, content: content as never };
    return { kind: "page", doc, ancestors: base.ancestors };
  }
  const art = CODE_ARTICLES.find((a) => a.path === path);
  if (!art) return null;
  const frame = await resolve(POST_FRAME_PATH);
  if (!frame || frame.kind !== "post") return null;
  const url = `https://alphahardscapes.com${art.path}`;
  const doc: PostDoc = {
    ...frame.doc,
    _id: `code-${art.file}`,
    title: art.title,
    path: art.path,
    wpId: undefined,
    date: "2026-11-19T12:00:00Z",
    author: null,
    categories: [],
    featuredImage: null,
    featuredMedium: null,
    // No author line and no date under the title: the byline is not confirmed yet.
    noMeta: true,
    // The copied frame carries the other post's id in its markup.
    frameTpl: (frame.doc.frameTpl || "").replaceAll(String(frame.doc.wpId), "0"),
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

export type { PtTextBlock };
