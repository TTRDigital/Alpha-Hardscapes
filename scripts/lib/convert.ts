/**
 * Converts WordPress/Elementor markup into CMS nodes: a template (`tpl`)
 * holding the exact original HTML with editable parts replaced by slots,
 * plus the field values for those slots. See lib/render/template.ts.
 */
import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { createHash } from "node:crypto";
import { relativeUrl } from "../../lib/render/html.ts";
import { renderPortableText, type PtBlock, type PtMarkDef, type PtSpan } from "../../lib/render/portableText.ts";
import type { ElImage, Fields } from "../../lib/render/template.ts";
import { canonical } from "./normalize.ts";

export type Stats = { widgets: Record<string, number>; richFallback: number; rich: number };
export const stats: Stats = { widgets: {}, richFallback: 0, rich: 0 };

let keyCounter = 0;
export function key(seed?: string) {
  keyCounter++;
  return createHash("sha1").update(`${seed ?? ""}:${keyCounter}`).digest("hex").slice(0, 12);
}

/** Lazy-loading placeholders (SiteGround) are replaced by the real markup. */
export function resolveLazy($: CheerioAPI) {
  $("img.lazyload").each((_, el) => {
    const $img = $(el);
    const ns = $img.next("noscript");
    if (ns.length) {
      const real = ns.text() || ns.html() || "";
      $img.replaceWith(real);
      ns.remove();
    } else {
      const src = $img.attr("data-src");
      if (src) $img.attr("src", src).removeAttr("data-src");
      const ss = $img.attr("data-srcset");
      if (ss) $img.attr("srcset", ss).removeAttr("data-srcset");
      $img.removeClass("lazyload");
    }
  });
  $("video.lazyload, iframe.lazyload").each((_, el) => {
    const $el = $(el);
    const src = $el.attr("data-src");
    if (src) $el.attr("src", src).removeAttr("data-src");
    $el.removeClass("lazyload");
    if ($el.attr("class") === "") $el.removeAttr("class");
  });
}

/* ---------------- small helpers ---------------- */

export function outer($: CheerioAPI, el: AnyNode | Cheerio<AnyNode>) {
  return $.html(el as never);
}

function isWs(n: AnyNode) {
  return n.type === "text" && !(n as unknown as { data: string }).data.trim();
}

function textOf(n: AnyNode) {
  return (n as unknown as { data: string }).data;
}

/** Replaces the content of $el with a text/html slot, keeping edge whitespace in the template. */
function contentSlot($: CheerioAPI, $el: Cheerio<Element>, name: string, fields: Fields) {
  const inner = $el.html() ?? "";
  if (inner.includes("[[@")) console.warn("nested slot inside", name, inner.slice(0, 120));
  const lead = inner.match(/^\s*/)![0];
  const trail = inner.slice(lead.length).match(/\s*$/)![0];
  const core = inner.slice(lead.length, inner.length - trail.length);
  if (/<[a-z!/]/i.test(core)) {
    fields[`${name}Html`] = core;
    $el.html(`${lead}[[@html:${name}Html]]${trail}`);
  } else {
    fields[name] = cheerio.load(`<b>${core}</b>`, null, false)("b").text();
    $el.html(`${lead}[[@text:${name}]]${trail}`);
  }
}

function attrSlot($el: Cheerio<Element>, attr: string, name: string, fields: Fields, url = true) {
  const v = $el.attr(attr);
  if (v == null) return;
  fields[name] = url ? relativeUrl(v) : v;
  $el.attr(attr, `[[@attr:${name}]]`);
}

const IMG_FIELDS = ["src", "srcset", "sizes", "width", "height", "alt"] as const;

export function imageFields($: CheerioAPI, $img: Cheerio<Element>): ElImage {
  const attribs = { ...($img[0] as Element).attribs };
  const img: ElImage = { _type: "elImage" };
  for (const f of IMG_FIELDS) {
    if (attribs[f] != null) {
      img[f] = f === "src" ? relativeUrl(attribs[f]) : f === "srcset" ? attribs[f].split(/,\s*/).map((s) => relativeUrl(s)).join(", ") : attribs[f];
      delete attribs[f];
    }
  }
  const rest = Object.entries(attribs)
    .map(([k, v]) => (v === "" && k !== "alt" ? k : `${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`))
    .join(" ");
  if (rest) img.attrs = rest;
  return img;
}

function imgSlot($: CheerioAPI, $img: Cheerio<Element>, name: string, fields: Fields) {
  fields[name] = imageFields($, $img);
  $img.replaceWith(`[[@img:${name}]]`);
}

/** Inputs whose value depends on the page the form is shown on. */
function formContextSlots($: CheerioAPI, $root: Cheerio<AnyNode>) {
  $root.find('input[name="queried_id"]').attr("value", "[[@ctxattr:queriedId]]");
  $root.find('input[name="referer_title"]').attr("value", "[[@ctxattr:refererTitle]]");
}

/** Root-relative links everywhere in a template. */
function relativizeTpl(html: string) {
  return html.replace(/(href|src|action|data-thumbnail|data-src)="(https?:)?\/\/(www\.)?alphahardscapes\.com(\/[^"]*)?"/gi, (_m, a, _p, _w, path) => `${a}="${path || "/"}"`);
}

/* ---------------- Portable Text ---------------- */

const BLOCK_STYLES: Record<string, string> = { p: "normal", h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6" };
const DECOS: Record<string, string> = { strong: "strong", em: "em", u: "underline", b: "b", i: "i" };

function spansOf($: CheerioAPI, nodes: AnyNode[], marks: string[], defs: PtMarkDef[]): PtSpan[] | null {
  const out: PtSpan[] = [];
  for (const n of nodes) {
    if (n.type === "text") {
      out.push({ _type: "span", _key: key(), text: textOf(n), marks: [...marks] });
      continue;
    }
    if (n.type === "comment") continue;
    if (n.type !== "tag") return null;
    const el = n as Element;
    const attrs = el.attribs;
    if (el.name === "br") {
      out.push({ _type: "span", _key: key(), text: "\n", marks: [...marks] });
      continue;
    }
    let mark: string;
    if (DECOS[el.name] && !Object.keys(attrs).length) mark = DECOS[el.name];
    else if (el.name === "a") {
      const { href, target, rel, ...rest } = attrs;
      const extra = Object.entries(rest).map(([k, v]) => `${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`).join(" ");
      const def: PtMarkDef = { _type: "link", _key: key(), href: href != null ? relativeUrl(href) : undefined, target, rel, ...(extra ? { extra } : {}) };
      defs.push(def);
      mark = def._key;
    } else if (el.name === "span" || ((el.name === "strong" || el.name === "em") && Object.keys(attrs).length)) {
      const { style, ...rest } = attrs;
      const extra = Object.entries(rest).map(([k, v]) => `${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`).join(" ");
      const def: PtMarkDef = { _type: "inlineStyle", _key: key(), tag: el.name, style, ...(extra ? { extra } : {}) };
      defs.push(def);
      mark = def._key;
    } else return null;
    const inner = spansOf($, el.children as AnyNode[], [...marks, mark], defs);
    if (!inner) return null;
    if (!inner.length) return null;
    out.push(...inner);
  }
  return out;
}

function blockFrom($: CheerioAPI, nodes: AnyNode[], style: string, extra: Partial<PtBlock> = {}): PtBlock | null {
  const defs: PtMarkDef[] = [];
  const children = spansOf($, nodes, [], defs);
  if (!children) return null;
  if (!children.length) children.push({ _type: "span", _key: key(), text: "", marks: [] });
  return { _type: "block", _key: key(), style, markDefs: defs, children, ...extra } as PtBlock;
}

function listBlocks($: CheerioAPI, list: Element, level: number): PtBlock[] | null {
  if (Object.keys(list.attribs).length) return null;
  const type = list.name === "ol" ? "number" : "bullet";
  const out: PtBlock[] = [];
  for (const li of list.children as AnyNode[]) {
    if (isWs(li)) continue;
    if (li.type !== "tag" || (li as Element).name !== "li" || Object.keys((li as Element).attribs).length) return null;
    const kids = (li as Element).children as AnyNode[];
    const nestedIdx = kids.findIndex((k) => k.type === "tag" && ["ul", "ol"].includes((k as Element).name));
    const inline = nestedIdx >= 0 ? kids.slice(0, nestedIdx) : kids;
    const block = blockFrom($, inline, "normal", { listItem: type, level } as Partial<PtBlock>);
    if (!block) return null;
    out.push(block);
    if (nestedIdx >= 0) {
      for (const rest of kids.slice(nestedIdx)) {
        if (isWs(rest)) continue;
        if (rest.type !== "tag" || !["ul", "ol"].includes((rest as Element).name)) return null;
        const nested = listBlocks($, rest as Element, level + 1);
        if (!nested) return null;
        out.push(...nested);
      }
    }
  }
  return out;
}

/** HTML to Portable Text. Returns null when the HTML cannot be represented exactly. */
export function htmlToPortableText(html: string): PtBlock[] | null {
  const $ = cheerio.load(html, null, false);
  const blocks: PtBlock[] = [];
  let bare: AnyNode[] = [];
  const flushBare = () => {
    if (bare.some((n) => !isWs(n))) {
      const b = blockFrom($, bare, "bare");
      if (!b) return false;
      blocks.push(b);
    }
    bare = [];
    return true;
  };
  for (const n of $.root()[0].children as AnyNode[]) {
    if (n.type === "comment") continue;
    const el = n as Element;
    if (n.type === "tag" && (BLOCK_STYLES[el.name] || ["ul", "ol", "table", "div", "figure", "blockquote", "hr"].includes(el.name))) {
      if (!flushBare()) return null;
      if (BLOCK_STYLES[el.name]) {
        if (Object.keys(el.attribs).length) {
          blocks.push({ _type: "htmlBlock", _key: key(), html: outer($, el) });
          continue;
        }
        const b = blockFrom($, el.children as AnyNode[], BLOCK_STYLES[el.name]);
        if (!b) {
          blocks.push({ _type: "htmlBlock", _key: key(), html: outer($, el) });
          continue;
        }
        blocks.push(b);
      } else if (el.name === "ul" || el.name === "ol") {
        const l = listBlocks($, el, 1);
        if (!l) blocks.push({ _type: "htmlBlock", _key: key(), html: outer($, el) });
        else blocks.push(...l);
      } else {
        blocks.push({ _type: "htmlBlock", _key: key(), html: outer($, el) });
      }
    } else {
      bare.push(n);
    }
  }
  if (!flushBare()) return null;
  // Whitespace-only bare text between blocks is not kept; check the result.
  if (canonical(renderPortableText(blocks)) !== canonical(html)) return null;
  // Two text-only bare blocks in a row would merge differently; keep it simple.
  return blocks;
}

/* ---------------- Elementor elements ---------------- */

function isElementorElement(n: AnyNode): n is Element {
  return n.type === "tag" && ((n as Element).attribs.class || "").split(/\s+/).includes("elementor-element");
}

/**
 * Replaces the run of child elements starting at the first Elementor child
 * with a nodes slot. Leading decoration (shape dividers, background video)
 * stays in the template.
 */
function childrenSlot($: CheerioAPI, parent: Element, name: string, fields: Fields, ctx: ConvertCtx) {
  const kids = (parent.children as AnyNode[]).filter((k) => k.type !== "comment");
  const first = kids.findIndex(isElementorElement);
  if (first < 0) {
    fields[name] = [];
    return;
  }
  const run = kids.slice(first);
  fields[name] = convertChildren($, run, ctx);
  $(run[0]).before(`[[@nodes:${name}]]`);
  for (const n of run) $(n).remove();
}

/**
 * Converts a run of child nodes. Plain HTML between Elementor elements
 * (paragraphs typed straight into a post) becomes one rich text block.
 */
export function convertChildren($: CheerioAPI, run: AnyNode[], ctx: ConvertCtx): Fields[] {
  const nodes: Fields[] = [];
  let loose: AnyNode[] = [];
  const flush = () => {
    if (!loose.some((n) => !isWs(n))) {
      loose = [];
      return;
    }
    const html = relativizeTpl(loose.map((n) => (n.type === "text" ? textOf(n) : outer($, n))).join("")).trim();
    const pt = htmlToPortableText(html);
    nodes.push(pt ? { _type: "el.richText", _key: key(), tpl: "[[@rich:body]]", body: pt } : { _type: "el.raw", _key: key(), tpl: html });
    loose = [];
  };
  for (const n of run) {
    if (n.type === "comment") continue;
    if (isElementorElement(n)) {
      flush();
      nodes.push(convertElement($, n, ctx));
    } else loose.push(n);
  }
  flush();
  return nodes;
}

export type ConvertCtx = { pageId?: number; pagesByPath: Map<string, number> };

export function convertElement($: CheerioAPI, el: Element, ctx: ConvertCtx): Fields {
  const type = el.attribs["data-element_type"];
  const elId = el.attribs["data-id"];
  const clone = $(el).clone();
  const root = clone[0] as Element;
  const fields: Fields = { _key: key(elId), elId };
  if (type === "container" || type === "section" || type === "column") {
    fields._type = "el.container";
    let host: Element = root;
    const inner = clone.children(".e-con-inner, .elementor-container, .elementor-widget-wrap").first();
    if (inner.length) host = inner[0] as Element;
    // Old-style section > container > column > widget-wrap
    if (type === "section" || type === "column") {
      const wrap = clone.find("> .elementor-container, > .elementor-widget-wrap").first();
      if (wrap.length) host = wrap[0] as Element;
    }
    childrenSlot($, host, "children", fields, ctx);
    formContextSlots($, clone);
    fields.tpl = relativizeTpl(outer($, clone));
    return fields;
  }
  const widgetType = (el.attribs["data-widget_type"] || "unknown").replace(/\.default$/, "");
  stats.widgets[widgetType] = (stats.widgets[widgetType] || 0) + 1;
  const handler = WIDGETS[widgetType];
  fields._type = handler ? `el.${handler.type}` : "el.raw";
  fields.widget = widgetType;
  if (handler) handler.slot($, clone, fields, ctx);
  formContextSlots($, clone);
  fields.tpl = relativizeTpl(outer($, clone));
  return fields;
}

type WidgetHandler = { type: string; slot: ($: CheerioAPI, w: Cheerio<Element>, fields: Fields, ctx: ConvertCtx) => void };

function first($w: Cheerio<Element>, sel: string) {
  const r = $w.find(sel).first();
  return r.length ? (r as Cheerio<Element>) : null;
}

function direct($w: Cheerio<Element>, sel: string) {
  const r = $w.children(sel).first();
  return r.length ? (r as Cheerio<Element>) : null;
}

function linkAndText($: CheerioAPI, $el: Cheerio<Element>, textName: string, linkName: string, fields: Fields) {
  const kids = ($el[0].children as AnyNode[]).filter((k) => !isWs(k));
  if (kids.length === 1 && kids[0].type === "tag" && (kids[0] as Element).name === "a") {
    const $a = $(kids[0]) as Cheerio<Element>;
    attrSlot($a, "href", linkName, fields);
    contentSlot($, $a, textName, fields);
  } else contentSlot($, $el, textName, fields);
}

const WIDGETS: Record<string, WidgetHandler> = {
  heading: {
    type: "heading",
    slot($, w, f) {
      const t = first(w, ".elementor-heading-title");
      if (t) linkAndText($, t, "title", "link", f);
    },
  },
  "text-editor": {
    type: "text",
    slot($, w, f) {
      const host = first(w, ".elementor-widget-container") || w;
      const html = (host.html() ?? "").trim();
      const pt = htmlToPortableText(html);
      if (pt) {
        stats.rich++;
        f.body = pt;
        host.html("[[@rich:body]]");
      } else {
        stats.richFallback++;
        f.bodyHtml = html;
        host.html("[[@html:bodyHtml]]");
      }
    },
  },
  image: {
    type: "image",
    slot($, w, f) {
      const img = first(w, "img");
      if (img) {
        const a = img.parent("a");
        if (a.length) attrSlot(a as Cheerio<Element>, "href", "link", f);
        imgSlot($, img, "image", f);
      }
      const cap = first(w, "figcaption");
      if (cap) contentSlot($, cap, "caption", f);
    },
  },
  button: {
    type: "button",
    slot($, w, f) {
      const a = first(w, ".elementor-button");
      if (a) attrSlot(a, "href", "link", f);
      const t = first(w, ".elementor-button-text");
      if (t) contentSlot($, t, "text", f);
    },
  },
  "icon-box": {
    type: "iconBox",
    slot($, w, f) {
      const iconA = first(w, ".elementor-icon-box-icon a");
      if (iconA) attrSlot(iconA, "href", "iconLink", f);
      const t = first(w, ".elementor-icon-box-title");
      if (t) linkAndText($, t, "title", "link", f);
      const d = first(w, ".elementor-icon-box-description");
      if (d) contentSlot($, d, "description", f);
    },
  },
  "icon-list": {
    type: "iconList",
    slot($, w, f) {
      itemsSlot($, w, "li.elementor-icon-list-item", "items", f, ($i, item) => {
        const a = direct($i, "a");
        if (a) attrSlot(a, "href", "link", item);
        const t = first($i, ".elementor-icon-list-text");
        if (t) contentSlot($, t, "text", item);
      });
    },
  },
  "social-icons": {
    type: "socialIcons",
    slot($, w, f) {
      itemsSlot($, w, ".elementor-grid-item", "items", f, ($i, item) => {
        const a = direct($i, "a");
        if (a) attrSlot(a, "href", "link", item);
        const t = first($i, ".elementor-screen-only");
        if (t) contentSlot($, t, "label", item);
      });
    },
  },
  icon: {
    type: "icon",
    slot($, w, f) {
      const a = first(w, "a.elementor-icon");
      if (a) attrSlot(a, "href", "link", f);
    },
  },
  video: {
    type: "video",
    slot($, w, f) {
      const v = first(w, "video");
      if (v) attrSlot(v, "src", "videoUrl", f);
    },
  },
  google_maps: {
    type: "map",
    slot($, w, f) {
      const i = first(w, "iframe");
      if (i) {
        attrSlot(i, "src", "mapUrl", f, false);
        attrSlot(i, "title", "mapTitle", f, false);
        i.attr("aria-label", "[[@attr:mapTitle]]");
      }
    },
  },
  html: {
    type: "htmlCode",
    slot($, w, f) {
      const host = first(w, ".elementor-widget-container") || w;
      f.html = host.html() ?? "";
      host.html("[[@html:html]]");
    },
  },
  "nested-accordion": {
    type: "accordion",
    slot($, w, f, ctx) {
      itemsSlot($, w, "details.e-n-accordion-item", "items", f, ($i, item) => {
        const t = first($i, ".e-n-accordion-item-title-text");
        if (t) contentSlot($, t, "title", item);
        childrenSlot($, $i[0], "content", item, ctx);
      });
    },
  },
  reviews: {
    type: "reviews",
    slot($, w, f) {
      itemsSlot($, w, ".swiper-slide", "items", f, ($i, item) => {
        const a = first($i, "a.elementor-testimonial__header");
        if (a) attrSlot(a, "href", "link", item);
        const img = first($i, ".elementor-testimonial__image img");
        if (img) imgSlot($, img, "image", item);
        const n = first($i, ".elementor-testimonial__name");
        if (n) contentSlot($, n, "name", item);
        const ti = first($i, ".elementor-testimonial__title");
        if (ti) contentSlot($, ti, "title", item);
        const tx = first($i, ".elementor-testimonial__text");
        if (tx) contentSlot($, tx, "text", item);
      });
    },
  },
  "image-carousel": {
    type: "carousel",
    slot($, w, f) {
      itemsSlot($, w, ".swiper-slide", "items", f, ($i, item) => {
        const a = direct($i, "a");
        if (a) attrSlot(a, "href", "link", item);
        const img = first($i, "img");
        if (img) imgSlot($, img, "image", item);
      });
    },
  },
  "image-gallery": {
    type: "imageGallery",
    slot($, w, f) {
      itemsSlot($, w, "figure.gallery-item", "items", f, ($i, item) => {
        const a = first($i, ".gallery-icon > a");
        if (a) attrSlot(a, "href", "link", item);
        const img = first($i, "img");
        if (img) imgSlot($, img, "image", item);
      });
    },
  },
  gallery: {
    type: "gallery",
    slot($, w, f) {
      itemsSlot($, w, "a.e-gallery-item", "items", f, ($i, item) => {
        attrSlot($i, "href", "link", item);
        const d = first($i, "[data-thumbnail]");
        if (d) attrSlot(d, "data-thumbnail", "thumbnail", item);
      });
    },
  },
  template: {
    type: "embed",
    slot($, w, f, ctx) {
      const root = first(w, "[data-elementor-type]");
      if (root) childrenSlot($, root[0], "children", f, ctx);
    },
  },
  "nav-menu": { type: "navMenu", slot: navMenuSlot },
};

/**
 * Repeated items (list entries, slides, accordion panels). Each item keeps
 * its own template; the whitespace before it is part of the template.
 */
function itemsSlot(
  $: CheerioAPI,
  w: Cheerio<Element>,
  sel: string,
  name: string,
  fields: Fields,
  fill: ($i: Cheerio<Element>, item: Fields) => void,
) {
  const found = w.find(sel).toArray() as Element[];
  // Only direct siblings of the first match (nested lists are handled by their own widget).
  if (!found.length) {
    fields[name] = [];
    return;
  }
  const parent = found[0].parent as Element;
  const siblings = found.filter((e) => e.parent === parent);
  const items: Fields[] = [];
  for (const el of siblings) {
    let lead = "";
    const prev = el.prev;
    if (prev && isWs(prev)) {
      lead = textOf(prev);
      $(prev).remove();
    }
    const $i = $(el).clone() as Cheerio<Element>;
    const item: Fields = { _type: `${String(fields._type).replace(/^el\./, "")}Item`, _key: key() };
    fill($i, item);
    item.tpl = relativizeTpl(lead + outer($, $i));
    items.push(item);
  }
  fields[name] = items;
  $(siblings[0]).before(`[[@items:${name}]]`);
  for (const el of siblings) $(el).remove();
}

/* ---------------- nav menus ---------------- */

const CURRENT_LI = /^(current-menu-item|current-menu-ancestor|current-menu-parent|current-page-ancestor|current-page-parent|current_page_item|current_page_parent|current_page_ancestor|page_item|page-item-\d+)$/;

function cleanClasses(cls: string | undefined, re: RegExp) {
  return (cls || "").split(/\s+/).filter((c) => c && !re.test(c)).join(" ");
}

function navMenuSlot($: CheerioAPI, w: Cheerio<Element>, fields: Fields, ctx: ConvertCtx) {
  const mainUl = w.find("nav.elementor-nav-menu--main ul.elementor-nav-menu").first();
  const dropUl = w.find("nav.elementor-nav-menu--dropdown ul.elementor-nav-menu").first();
  const dropById = new Map<string, Element>();
  dropUl.find("li").each((_, li) => {
    const id = /menu-item-\d+/.exec((li as Element).attribs.class || "")?.[0];
    if (id) dropById.set(id, li as Element);
  });
  const build = (ul: Cheerio<AnyNode>): Fields[] =>
    (ul.children("li").toArray() as Element[]).map((li) => {
      const id = /menu-item-(\d+)/.exec(li.attribs.class || "");
      const item: Fields = { _type: "navItem", _key: key(id?.[0]), wpId: id ? Number(id[1]) : undefined };
      const sub = $(li).children("ul.sub-menu");
      if (sub.length) item.children = build(sub);
      item.tpl = navItemTpl($, li, item, ctx, true);
      const drop = id ? dropById.get(id[0]) : undefined;
      if (drop) item.tplDropdown = navItemTpl($, drop, item, ctx, false);
      return item;
    });
  fields.items = build(mainUl);
  mainUl.html("[[@nav:main]]");
  dropUl.html("[[@nav:dropdown]]");
}

function navItemTpl($: CheerioAPI, li: Element, item: Fields, ctx: ConvertCtx, fill: boolean) {
  const $li = $(li).clone() as Cheerio<Element>;
  const cls = $li.attr("class");
  const a = $li.children("a").first() as Cheerio<Element>;
  if (fill) {
    item.classes = cleanClasses(cls, CURRENT_LI);
    item.linkClasses = cleanClasses(a.attr("class"), /^elementor-item-active$/);
    item.link = relativeUrl(a.attr("href") || "");
    const textNode = (a[0].children as AnyNode[]).find((n) => n.type === "text" && textOf(n).trim());
    item.label = textNode ? textOf(textNode).trim() : "";
    const path = (item.link as string).split(/[?#]/)[0];
    const pageId = ctx.pagesByPath.get(path.endsWith("/") ? path : `${path}/`);
    if (pageId && /menu-item-object-page/.test(cls || "")) item.pageId = pageId;
  }
  $li.attr("class", "[[@navli:x]]");
  a.attr("class", "[[@nava:x]]");
  a.removeAttr("aria-current");
  if (a.attr("href") != null) a.attr("href", "[[@attr:link]]");
  const textNode = (a[0].children as AnyNode[]).find((n) => n.type === "text" && textOf(n).trim());
  if (textNode) {
    const t = textOf(textNode);
    const lead = t.match(/^\s*/)![0];
    const trail = t.match(/\s*$/)![0];
    (textNode as unknown as { data: string }).data = `${lead}[[@text:label]]${trail}`;
  }
  const sub = $li.children("ul.sub-menu");
  if (sub.length) sub.html("[[@nav:children]]");
  return relativizeTpl(outer($, $li)).replace('class="[[@nava:x]]"', "[[@nava:x]]");
}
