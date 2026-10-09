import { escapeAttr, escapeHtml } from "./html.ts";
import { renderPortableText, type PtBlock } from "./portableText.ts";

/**
 * Every piece of the site (page frame, Elementor container, widget, list
 * item, header, footer, popup) is stored as a template (`tpl`): the exact
 * HTML WordPress printed, with editable parts replaced by slots such as
 * `[[@text:title]]`. The slot kind says how the field is printed:
 *
 *   text      plain text field, HTML-escaped
 *   html      raw HTML field
 *   attr      attribute value (links, video URLs), attribute-escaped
 *   img       image field (see ElImage)
 *   rich      Portable Text field
 *   nodes     array of child nodes (each with its own tpl)
 *   items     array of repeated items (each with its own tpl)
 *   nav       menu items of a nav-menu widget (main or dropdown variant)
 *   navli/nava  computed menu classes (current page highlighting)
 *   ctx/ctxattr values that come from the page being rendered
 */

export type Fields = Record<string, unknown> & { _type?: string; _key?: string; tpl?: string };

export type ElImage = {
  _type?: "wpImage";
  /** Image uploaded in the CMS; when set it replaces the original file. */
  upload?: { asset?: { _ref?: string } } | null;
  src?: string;
  srcset?: string;
  sizes?: string;
  width?: string;
  height?: string;
  alt?: string;
  /** Remaining attributes (class, decoding, loading...), printed as is. */
  attrs?: string;
};

export type NavItem = Fields & {
  label?: string;
  link?: string;
  classes?: string;
  linkClasses?: string;
  pageId?: number;
  tplDropdown?: string;
  children?: NavItem[];
};

export type RenderContext = {
  /** Path of the page being rendered, with trailing slash ("/masonry/"). */
  path: string;
  /** Raw values for ctx/ctxattr slots. */
  values: Record<string, string | undefined>;
  /** Paths that are ancestors of `path` in the page hierarchy. */
  ancestorPaths?: string[];
  image: { projectId: string; dataset: string };
  /** Internal: current-page state of the nav menu being rendered. */
  nav?: NavState;
  navVariant?: "main" | "dropdown";
  /** Blog post or post archive: the posts page menu item gets current_page_parent. */
  inBlog?: boolean;
  postsPagePath?: string;
};

type NavState = { current: Set<NavItem>; parent: Set<NavItem>; ancestor: Set<NavItem>; pageAncestor: Set<NavItem> };

const SLOT = /\[\[@(\w+):(\w+)\]\]/g;

export function renderTpl(tpl: string | undefined, fields: Fields, ctx: RenderContext): string {
  if (!tpl) return "";
  return tpl.replace(SLOT, (_m, kind: string, name: string) => renderSlot(kind, name, fields, ctx));
}

function renderSlot(kind: string, name: string, fields: Fields, ctx: RenderContext): string {
  const value = fields[name];
  switch (kind) {
    case "text":
      return escapeHtml(value);
    case "html":
      return value == null ? "" : String(value);
    case "attr":
      return escapeAttr(value);
    case "img":
      return renderImage(value as ElImage | undefined, ctx);
    case "rich":
      return renderPortableText(value as PtBlock[]);
    case "nodes":
      return renderNodes(value as Fields[] | undefined, ctx);
    case "items":
      return renderItems(value as Fields[] | undefined, ctx);
    case "nav":
      return renderNav(fields, name as "main" | "dropdown" | "children", ctx);
    case "navli":
      return escapeAttr(navClasses(fields as NavItem, ctx, "li"));
    case "nava": {
      // Full attributes: class plus aria-current on the current page's link.
      const cls = navClasses(fields as NavItem, ctx, "a");
      return `class="${escapeAttr(cls)}"${ctx.nav?.current.has(fields as NavItem) ? ' aria-current="page"' : ""}`;
    }
    case "ctx":
      return ctx.values[name] ?? "";
    case "ctxattr":
      return escapeAttr(ctx.values[name] ?? "");
    default:
      return "";
  }
}

export function renderNodes(nodes: Fields[] | undefined | null, ctx: RenderContext): string {
  if (!nodes?.length) return "";
  return nodes.map((n) => renderTpl(n.tpl, n, ctx)).join("");
}

/** Items added in the CMS have no template of their own: they reuse a sibling's. */
function renderItems(items: Fields[] | undefined | null, ctx: RenderContext): string {
  if (!items?.length) return "";
  const fallback = items.find((i) => i.tpl)?.tpl;
  return items.map((item) => renderTpl(item.tpl || fallback, item, ctx)).join("");
}

/* ---------------- images ---------------- */

function sanityImageUrl(ref: string, ctx: RenderContext) {
  // image-<hash>-<w>x<h>-<format>
  const m = /^image-([a-f0-9]+)-(\d+)x(\d+)-(\w+)$/.exec(ref);
  if (!m) return null;
  return {
    url: `https://cdn.sanity.io/images/${ctx.image.projectId}/${ctx.image.dataset}/${m[1]}-${m[2]}x${m[3]}.${m[4]}`,
    width: Number(m[2]),
    height: Number(m[3]),
  };
}

export function renderImage(img: ElImage | undefined, ctx: RenderContext): string {
  if (!img) return "";
  let { src, srcset, width, height } = img;
  const sizes = img.sizes;
  const ref = img.upload?.asset?._ref;
  const asset = ref ? sanityImageUrl(ref, ctx) : null;
  if (asset) {
    // A replacement image: keep the box WordPress used (width/height and
    // the srcset widths), crop like WordPress did for square thumbnails.
    const w = Number(width) || asset.width;
    const h = Number(height) || Math.round((w * asset.height) / asset.width);
    const crop = Math.abs(w / h - asset.width / asset.height) > 0.02;
    const at = (cw: number) => `${asset.url}?w=${cw}${crop ? `&h=${Math.round((cw * h) / w)}&fit=crop` : ""}&auto=format`;
    src = at(Math.min(w, asset.width));
    const widths = srcset ? [...srcset.matchAll(/\s(\d+)w/g)].map((m) => Number(m[1])) : [];
    srcset = widths.length ? widths.map((cw) => `${at(Math.min(cw, asset.width))} ${cw}w`).join(", ") : undefined;
    width = String(w);
    height = String(h);
  }
  const parts = [img.attrs || ""];
  if (width) parts.push(`width="${escapeAttr(width)}"`);
  if (height) parts.push(`height="${escapeAttr(height)}"`);
  if (src != null) parts.push(`src="${escapeAttr(src)}"`);
  if (img.alt != null) parts.push(`alt="${escapeAttr(img.alt)}"`);
  if (srcset) parts.push(`srcset="${escapeAttr(srcset)}"`);
  if (sizes && srcset) parts.push(`sizes="${escapeAttr(sizes)}"`);
  return `<img ${parts.filter(Boolean).join(" ")}>`;
}

/* ---------------- nav menus ---------------- */

function normPath(href: string | undefined) {
  if (!href) return null;
  if (href.startsWith("#") || /^(tel|mailto):/.test(href)) return null;
  const path = href.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0];
  if (!path.startsWith("/")) return null;
  return path.endsWith("/") ? path : `${path}/`;
}

function computeNavState(items: NavItem[], ctx: RenderContext): NavState {
  const state: NavState = { current: new Set(), parent: new Set(), ancestor: new Set(), pageAncestor: new Set() };
  const ancestors = new Set(ctx.ancestorPaths || []);
  const walk = (list: NavItem[], chain: NavItem[]) => {
    for (const item of list) {
      const p = normPath(item.link);
      if (p && p === ctx.path) {
        state.current.add(item);
        if (chain.length) state.parent.add(chain[chain.length - 1]);
        for (const a of chain) state.ancestor.add(a);
      }
      if (p && ancestors.has(p)) state.pageAncestor.add(item);
      if (item.children?.length) walk(item.children, [...chain, item]);
    }
  };
  walk(items, []);
  return state;
}

function renderNav(fields: Fields, variant: "main" | "dropdown" | "children", ctx: RenderContext): string {
  if (variant === "children") {
    const children = (fields as NavItem).children || [];
    return children.map((c) => renderNavItem(c, children, ctx)).join("");
  }
  const items = (fields.items as NavItem[]) || [];
  const navCtx: RenderContext = { ...ctx, nav: computeNavState(items, ctx), navVariant: variant };
  return items.map((item) => renderNavItem(item, items, navCtx)).join("");
}

function renderNavItem(item: NavItem, siblings: NavItem[], ctx: RenderContext) {
  const dropdown = ctx.navVariant === "dropdown";
  const pick = (i: NavItem) => (dropdown ? i.tplDropdown : i.tpl);
  const tpl = pick(item) || pick(siblings.find((s) => pick(s)) || {}) || "";
  return renderTpl(tpl, item, ctx);
}

function navClasses(item: NavItem, ctx: RenderContext, el: "li" | "a"): string {
  const state = ctx.nav;
  const base = (el === "li" ? item.classes : item.linkClasses) || "";
  if (!state) return base;
  const isCurrent = state.current.has(item);
  const extra: string[] = [];
  if (el === "a") {
    if (isCurrent) extra.push("elementor-item-active");
    return [base, ...extra].filter(Boolean).join(" ");
  }
  // Same classes WordPress' wp_nav_menu() adds.
  const isPage = /\bmenu-item-object-page\b/.test(base);
  const path = normPath(item.link);
  if (isCurrent) {
    extra.push("current-menu-item");
    if (isPage && item.pageId) extra.push("page_item", `page-item-${item.pageId}`, "current_page_item");
  }
  if (state.ancestor.has(item)) {
    extra.push("current-menu-ancestor");
    if (state.parent.has(item)) extra.push("current-menu-parent");
    if (isPage) extra.push("current_page_ancestor");
    if (isPage && state.parent.has(item)) extra.push("current_page_parent");
  } else if (state.pageAncestor.has(item)) {
    extra.push("current-page-ancestor");
    if (path && path === ctx.ancestorPaths?.[0]) extra.push("current-page-parent");
  }
  if (ctx.postsPagePath && path === ctx.postsPagePath && ctx.inBlog && !extra.includes("current_page_parent")) extra.push("current_page_parent");
  return [base, ...extra].filter(Boolean).join(" ");
}
