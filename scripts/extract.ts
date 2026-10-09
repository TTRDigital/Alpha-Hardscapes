/**
 * One-off migration: turns the crawled WordPress site into CMS documents.
 *
 *   npm run extract -- <crawl-dir>
 *
 * <crawl-dir> holds html/*.html (one file per URL, "home.html" for "/",
 * "a__b.html" for "/a/b/"), wp/*.json (WordPress REST API dumps) and
 * css-manifest.json (combined stylesheet -> split files, see README).
 *
 * Writes content/seed.json (all documents) and lib/generated/shells.json
 * (the page skeletons: head, scripts, wrappers).
 */
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { relativeUrl } from "../lib/render/html.ts";
import type { Seo } from "../lib/render/seo.ts";
import type { Fields } from "../lib/render/template.ts";
import { convertChildren, convertElement, htmlToPortableText, imageFields, key, outer, resolveLazy, stats, type ConvertCtx } from "./lib/convert.ts";

const SRC = process.argv[2];
if (!SRC) throw new Error("Usage: npm run extract -- <crawl-dir>");
const ROOT = new URL("..", import.meta.url).pathname;
const CSS_OUT = join(ROOT, "public/assets/css");

type WpItem = { id: number; link: string; parent?: number; title: { rendered: string }; slug: string; date: string; modified: string; author: number; categories?: number[]; excerpt: { rendered: string }; featured_media: number; template?: string };
const wpPages: WpItem[] = JSON.parse(readFileSync(join(SRC, "wp/pages.json"), "utf8"));
const wpPosts: WpItem[] = JSON.parse(readFileSync(join(SRC, "wp/posts.json"), "utf8"));
const wpCats: { id: number; name: string; slug: string; link: string; description: string }[] = JSON.parse(readFileSync(join(SRC, "wp/categories.json"), "utf8"));
const wpUsers: { id: number; name: string; slug: string; link: string; description: string; avatar_urls: Record<string, string> }[] = JSON.parse(readFileSync(join(SRC, "wp/users.json"), "utf8"));
const cssManifest: Record<string, string[]> = JSON.parse(readFileSync(join(SRC, "css-manifest.json"), "utf8"));

const pathOf = (link: string) => relativeUrl(link);
const pagesByPath = new Map<string, number>();
for (const p of [...wpPages, ...wpPosts]) pagesByPath.set(pathOf(p.link), p.id);
const wpById = new Map<number, WpItem>([...wpPages, ...wpPosts].map((p) => [p.id, p]));

const docs = new Map<string, Record<string, unknown>>();
const shells = new Map<string, string>();
const templateIds = new Set<number>();

function hash(s: string, n = 10) {
  return createHash("sha1").update(s).digest("hex").slice(0, n);
}

function decode(html: string) {
  return cheerio.load(`<b>${html}</b>`, null, false)("b").text();
}

/* ---------------- head / shell ---------------- */

function extractSeo($: CheerioAPI): Seo {
  const meta = (sel: string) => $(sel).attr("content") || undefined;
  const misc: Seo["twitterMisc"] = [];
  for (let i = 1; i < 5; i++) {
    const label = meta(`meta[name="twitter:label${i}"]`);
    const data = meta(`meta[name="twitter:data${i}"]`);
    if (label || data) misc.push({ _key: `t${i}`, label, data });
  }
  return {
    title: $("head > title").text() || undefined,
    description: meta('meta[name="description"]'),
    robots: meta('meta[name="robots"]'),
    canonical: $('link[rel="canonical"]').attr("href") || undefined,
    ogLocale: meta('meta[property="og:locale"]'),
    ogType: meta('meta[property="og:type"]'),
    ogTitle: meta('meta[property="og:title"]'),
    ogDescription: meta('meta[property="og:description"]'),
    ogUrl: meta('meta[property="og:url"]'),
    ogSiteName: meta('meta[property="og:site_name"]'),
    articlePublisher: meta('meta[property="article:publisher"]'),
    articleAuthor: meta('meta[property="article:author"]'),
    publishedTime: meta('meta[property="article:published_time"]'),
    modifiedTime: meta('meta[property="article:modified_time"]'),
    ogImage: meta('meta[property="og:image"]'),
    ogImageWidth: meta('meta[property="og:image:width"]'),
    ogImageHeight: meta('meta[property="og:image:height"]'),
    ogImageType: meta('meta[property="og:image:type"]'),
    author: meta('meta[name="author"]'),
    twitterCard: meta('meta[name="twitter:card"]'),
    twitterMisc: misc.length ? misc : undefined,
    schema: $("script.yoast-schema-graph").html() || undefined,
  };
}

function writeInlineCss(css: string) {
  const name = `i-${hash(css)}.css`;
  const file = join(CSS_OUT, name);
  if (!existsSync(file)) writeFileSync(file, relHostCss(css));
  return `/assets/css/${name}`;
}

function relHostCss(css: string) {
  return css.replace(/(https?:)?\/\/(www\.)?alphahardscapes\.com\//gi, "/");
}

const ICON_LINKS = [
  '<link rel="icon" href="/favicon.ico" sizes="48x48">',
  '<link rel="icon" href="/icon-32.png" type="image/png" sizes="32x32">',
  '<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">',
  '<link rel="manifest" href="/site.webmanifest">',
  '<meta name="theme-color" content="#AECD38">',
  '<meta name="msapplication-TileImage" content="/icon-192.png">',
].join("\n");

/** Builds the page skeleton. Mutates $ (call last). */
function buildShell($: CheerioAPI): string {
  const head = $("head");
  // SEO tags are rendered from the CMS.
  const seoSel = [
    'meta[name="robots"]', 'meta[name="description"]', 'link[rel="canonical"]', 'meta[property^="og:"]', 'meta[property^="article:"]',
    'meta[name^="twitter:"]', 'meta[name="author"]', "script.yoast-schema-graph",
  ].join(",");
  head.find(seoSel).remove();
  head.find("title").replaceWith("[[@ctx:seo]]");
  // Business details now live in the Yoast graph (Site settings > Business schema).
  head.find('script[type="application/ld+json"]:not(.yoast-schema-graph)').remove();
  // WordPress plugin leftovers.
  head.find('meta[name="redi-version"]').remove();
  // Favicons: one proper set at the site root.
  const icons = head.find('link[rel="icon"], link[rel="apple-touch-icon"], meta[name="msapplication-TileImage"]');
  icons.first().before(ICON_LINKS);
  icons.remove();
  // Dead WordPress endpoints.
  head.find('link[rel="https://api.w.org/"], link[rel="EditURI"], link[rel="shortlink"], link[type="application/json+oembed"], link[type="text/xml+oembed"], link[rel="alternate"][type="application/json"], meta[name="generator"]').remove();
  head.find('link[rel="alternate"][type="application/rss+xml"]').filter((_, el) => /comments/i.test($(el).attr("href") || "")).remove();
  // Combined stylesheet -> split files.
  head.find('link[rel="preload"][as="style"]').remove();
  head.find('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = /(siteground-optimizer-combined-css-[a-f0-9]+\.css)/.exec(href);
    if (!m) return;
    const files = cssManifest[m[1]];
    if (!files) throw new Error(`No CSS manifest entry for ${m[1]}`);
    $(el).replaceWith(files.map((f) => `<link rel="stylesheet" href="${f}" media="all">`).join("\n"));
  });
  // Inline <style> blocks in the head become cacheable files, same order.
  head.find("style").each((_, el) => {
    const css = $(el).html() || "";
    const id = $(el).attr("id");
    $(el).replaceWith(`<link rel="stylesheet"${id ? ` id="${id}"` : ""} href="${writeInlineCss(css)}" media="all">`);
  });
  // Scripts
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src") || "";
    const m = /siteground-optimizer-combined-js-([a-f0-9]+)\.js/.exec(src);
    if (m) $(el).attr("src", `/assets/js/${m[1]}.js`);
    else $(el).attr("src", relativeUrl(src));
  });
  $("script:not([src])").each((_, el) => {
    let js = $(el).html() || "";
    js = js.replace(/,"post":\{"id":\d+,"title":"(?:[^"\\]|\\.)*","excerpt":"(?:[^"\\]|\\.)*","featuredImage":(?:false|"(?:[^"\\]|\\.)*")\}/, ',"post":[[@ctx:elementorPost]]');
    js = js.replace(/"page_permalink":"(?:[^"\\]|\\.)*"/, '"page_permalink":"[[@ctx:permalinkJs]]"');
    js = js.replace(/https?:\\\/\\\/(www\.)?alphahardscapes\.com\\\//gi, "\\/").replace(/https?:\/\/(www\.)?alphahardscapes\.com\//gi, "/");
    $(el).html(js);
  });
  // Body regions
  $("body").attr("class", "[[@ctxattr:bodyClass]]");
  $("header.elementor-location-header").replaceWith("[[@ctx:header]]");
  $("footer.elementor-location-footer").replaceWith("[[@ctx:footer]]");
  const popups = $('body > [data-elementor-type="popup"]');
  if (popups.length) {
    popups.first().before("[[@ctx:popups]]");
    popups.remove();
  }
  const frame = $("#content").length ? $("#content") : $('body [data-elementor-type="wp-page"], body [data-elementor-type="wp-post"]').first();
  frame.replaceWith("[[@ctx:content]]");
  let html = $.html();
  html = html.replace(/(href|src)="(https?:)?\/\/(www\.)?alphahardscapes\.com(\/[^"]*)?"/gi, (_m, a, _p, _w, path) => `${a}="${path || "/"}"`);
  const k = hash(html);
  shells.set(k, html);
  return k;
}

/* ---------------- templates (header, footer, popups) ---------------- */

function extractTemplate($: CheerioAPI, root: Element, ctx: ConvertCtx) {
  const id = Number(root.attribs["data-elementor-id"]);
  if (templateIds.has(id)) return id;
  templateIds.add(id);
  const kind = root.attribs["data-elementor-type"];
  const clone = $(root).clone();
  const fields: Fields = {};
  const children = (clone[0] as Element).children as AnyNode[];
  const nodes: Fields[] = [];
  const firstEl = children.find((c) => c.type === "tag");
  for (const c of children) if (c.type === "tag") nodes.push(convertElement($, c as Element, ctx));
  if (firstEl) $(firstEl).before("[[@nodes:content]]");
  for (const c of children.slice()) if (c.type === "tag") $(c).remove();
  fields.content = nodes;
  const titles: Record<number, string> = { 61: "Header", 102: "Footer" };
  docs.set(`template-${id}`, {
    _id: `template-${id}`,
    _type: "elementorTemplate",
    title: titles[id] || `${kind === "popup" ? "Popup" : "Template"} ${id}`,
    kind,
    wpId: id,
    tpl: outer($, clone),
    content: nodes,
  });
  return id;
}

/* ---------------- main loop ---------------- */

const htmlDir = join(SRC, "html");
const files = readdirSync(htmlDir).filter((f) => f.endsWith(".html"));
const pathFromFile = (f: string) => {
  const base = f.replace(/\.html$/, "");
  if (base === "home") return "/";
  if (base === "_404") return null;
  return `/${base.replace(/__/g, "/")}/`;
};

const archives: Record<string, unknown>[] = [];

for (const file of files.sort()) {
  const path = pathFromFile(file);
  const html = readFileSync(join(htmlDir, file), "utf8");
  const $ = cheerio.load(html);
  resolveLazy($);
  const bodyClass = $("body").attr("class") || "";
  const pageIdM = /\bpage-id-(\d+)\b/.exec(bodyClass) || /\bpostid-(\d+)\b/.exec(bodyClass);
  const wpId = pageIdM ? Number(pageIdM[1]) : undefined;
  const ctx: ConvertCtx = { pageId: wpId, pagesByPath };

  for (const t of $('[data-elementor-type="header"], [data-elementor-type="footer"], body > [data-elementor-type="popup"]').toArray()) {
    extractTemplate($, t as Element, ctx);
  }
  const popupIds = $('body > [data-elementor-type="popup"]').toArray().map((e) => Number((e as Element).attribs["data-elementor-id"]));
  const seo = extractSeo($);
  const wp = wpId ? wpById.get(wpId) : undefined;

  // Content frame
  const frameEl = $("#content").length ? $("#content") : $('body [data-elementor-type="wp-page"], body [data-elementor-type="wp-post"]').first();
  const frame = frameEl.clone();
  const doc: Record<string, unknown> = { seo, bodyClass, popups: popupIds };
  const cls = new Set(bodyClass.split(/\s+/));
  const isPost = cls.has("single-post");
  const isArchive = (cls.has("blog") || cls.has("archive")) && !cls.has("single");
  const is404 = cls.has("error404");

  if (isArchive) {
    // Grid of cards and pagination are generated from the posts.
    frame.find("main#main").each((_, m) => {
      const row = $(m).find("> .ast-row");
      if (row.length) row.html("[[@ctx:cards]]");
    });
    frame.find(".ast-pagination").replaceWith("[[@ctx:pagination]]");
    frame.find(".elementor-widget-archive-posts .elementor-widget-container").html("[[@ctx:elementorArchive]]");
    // Elementor archive template (author/sebastian) has Elementor nodes too
  }

  const root = frame.find('[data-elementor-type="wp-page"], [data-elementor-type="wp-post"], [data-elementor-type="archive"]').first();
  const rootEl = (root.length ? root[0] : frame.is('[data-elementor-type="wp-page"], [data-elementor-type="wp-post"]') ? frame[0] : null) as Element | null;
  if (rootEl) {
    const kids = (rootEl.children as AnyNode[]).filter((k) => k.type !== "comment");
    const firstTag = kids.findIndex((k) => k.type === "tag");
    const run = firstTag >= 0 ? kids.slice(firstTag) : [];
    doc.content = convertChildren($, run, ctx);
    if (run.length) $(run[0]).before("[[@nodes:content]]");
    for (const k of run) $(k).remove();
  } else if (isPost) {
    const ec = frame.find(".entry-content").first();
    const inner = (ec.html() || "").trim();
    const pt = htmlToPortableText(inner);
    if (pt) {
      doc.body = pt;
      ec.html("[[@rich:body]]");
    } else {
      doc.bodyHtml = inner;
      ec.html("[[@html:bodyHtml]]");
    }
  }

  if (isPost) {
    frame.find("h1.entry-title").first().html("[[@text:title]]");
    frame.find(".entry-header .entry-meta").first().replaceWith("[[@ctx:entryMeta]]");
    const thumb = frame.find(".entry-header .post-thumb-img-content").first();
    if (thumb.length) {
      const img = thumb.find("img").first();
      if (img.length) doc.featuredImage = imageFields($, img as never);
      thumb.replaceWith("[[@ctx:thumbnail]]");
    } else frame.find(".entry-header").first().append("[[@ctx:thumbnail]]");
    frame.find("nav.post-navigation").replaceWith("[[@ctx:postNav]]");
    const art = frame.find("article").first();
    doc.articleClass = art.attr("class");
    art.attr("class", "[[@ctxattr:articleClass]]");
  }

  // Forms in the page body
  frame.find('input[name="queried_id"]').attr("value", "[[@ctxattr:queriedId]]");
  frame.find('input[name="referer_title"]').attr("value", "[[@ctxattr:refererTitle]]");

  let frameTpl = outer($, frame);
  frameTpl = frameTpl.replace(/(href|src|action)="(https?:)?\/\/(www\.)?alphahardscapes\.com(\/[^"]*)?"/gi, (_m, a, _p, _w, p) => `${a}="${p || "/"}"`);
  doc.frameTpl = frameTpl;
  doc.shell = buildShell($);

  if (is404) {
    Object.assign(doc, { _id: "notFound", _type: "notFoundPage", title: "Page not found" });
    docs.set("notFound", doc);
    continue;
  }
  if (isArchive) {
    const page2 = /\/page\/\d+\/$/.test(path!);
    if (page2) {
      // Pagination pages reuse page 1; only the SEO differs and is generated.
      continue;
    }
    const kind = cls.has("author") ? "author" : cls.has("category") ? "category" : "blog";
    const slug = path!.split("/").filter(Boolean).pop()!;
    const id = `archive-${kind}${kind === "blog" ? "" : `-${slug}`}`;
    if (kind === "author" && !docs.has(`author-${slug}`)) {
      // Authors without public posts are missing from the REST API; take the name from the page.
      const name = $(".ast-author-bio .page-title").text().replace(/^Author name:\s*/, "").trim() || (seo.title || slug).split(/[,|]/)[0].trim();
      const avatar = $(".ast-author-avatar img").attr("src");
      docs.set(`author-${slug}`, { _id: `author-${slug}`, _type: "author", name, slug: { _type: "slug", current: slug }, avatar });
    }
    Object.assign(doc, {
      _id: id,
      _type: "archivePage",
      title: kind === "blog" ? "Blog" : `${kind === "author" ? "Author" : "Category"}: ${slug}`,
      kind,
      path,
      ...(kind === "author" ? { author: { _type: "reference", _ref: `author-${slug}` } } : {}),
      ...(kind === "category" ? { category: { _type: "reference", _ref: `category-${slug}` } } : {}),
    });
    docs.set(id, doc);
    archives.push(doc);
    continue;
  }
  if (!wpId) {
    console.warn("No WordPress id for", file);
    continue;
  }
  if (isPost) {
    const author = wpUsers.find((u) => u.id === wp?.author);
    // Archive cards print WordPress' generated excerpt; keep it verbatim.
    Object.assign(doc, {
      _id: `post-${wpId}`,
      _type: "post",
      title: decode(wp?.title.rendered || seo.title || ""),
      path,
      wpId,
      date: wp?.date ? `${wp.date}Z` : undefined,
      modified: wp?.modified ? `${wp.modified}Z` : undefined,
      author: author ? { _type: "reference", _ref: `author-${author.slug}` } : undefined,
      categories: (wp?.categories || []).map((c) => {
        const cat = wpCats.find((x) => x.id === c)!;
        return { _type: "reference", _ref: `category-${cat.slug}`, _key: cat.slug };
      }),
      wpTemplate: wp?.template || "",
    });
    docs.set(`post-${wpId}`, doc);
  } else {
    const parent = wp?.parent ? wpById.get(wp.parent) : undefined;
    Object.assign(doc, {
      _id: `page-${wpId}`,
      _type: "page",
      title: decode(wp?.title.rendered || seo.title || ""),
      path,
      wpId,
      parent: parent ? { _type: "reference", _ref: `page-${parent.id}`, _weak: true } : undefined,
      ancestorPaths: (() => {
        const out: string[] = [];
        for (let a = parent; a; a = a.parent ? wpById.get(a.parent) : undefined) out.push(pathOf(a.link));
        return out;
      })(),
      wpTemplate: wp?.template || "default",
    });
    docs.set(`page-${wpId}`, doc);
  }
}

/* ---------------- form field labels ---------------- */

// Elementor posts fields by ID (form_fields[field_89fc83e]); leads are sent with the labels.
const formFields: Record<string, Record<string, string>> = {};
for (const file of files) {
  const $ = cheerio.load(readFileSync(join(htmlDir, file), "utf8"));
  $("form.elementor-form").each((_, f) => {
    const key = `${$(f).find('input[name="post_id"]').val()}:${$(f).find('input[name="form_id"]').val()}`;
    const map = (formFields[key] ||= {});
    $(f).find("[name^='form_fields[']").each((_, el) => {
      const id = /^form_fields\[([^\]]+)\]/.exec($(el).attr("name") || "")?.[1];
      if (!id || map[id]) return;
      const group = $(el).closest(".elementor-field-group");
      const label = group.find("label.elementor-field-label").first().text().trim() || $(el).attr("placeholder") || id;
      map[id] = label.replace(/\s+/g, " ");
    });
  });
}
writeFileSync(join(ROOT, "content/form-fields.json"), JSON.stringify(formFields, null, 1));

/* ---------------- authors, categories, post excerpts ---------------- */

for (const u of wpUsers) {
  if (docs.has(`author-${u.slug}`)) docs.delete(`author-${u.slug}`);
  docs.set(`author-${u.slug}`, { _id: `author-${u.slug}`, _type: "author", name: u.name, slug: { _type: "slug", current: u.slug }, wpId: u.id, description: u.description, avatar: u.avatar_urls?.["96"] });
}
for (const c of wpCats) {
  docs.set(`category-${c.slug}`, { _id: `category-${c.slug}`, _type: "category", name: c.name, slug: { _type: "slug", current: c.slug }, wpId: c.id, description: c.description });
}
// Excerpts exactly as printed on the blog grid.
for (const file of files.filter((f) => /^(blog|category__|author__)/.test(f) && !f.startsWith("blog__"))) {
  const $ = cheerio.load(readFileSync(join(htmlDir, file), "utf8"));
  resolveLazy($);
  $("article").each((_, a) => {
    const id = /\bpost-(\d+)\b/.exec(`${$(a).attr("id") || ""} ${$(a).attr("class") || ""}`)?.[1];
    const d = id && docs.get(`post-${id}`);
    if (!d) return;
    const ex = $(a).find(".ast-excerpt-container p, .elementor-post__excerpt p").first();
    if (ex.length && d.excerpt == null) d.excerpt = ex.text().replace(/\s*\[…\]$/, "");
    if (d.cardClass == null && !$(a).hasClass("elementor-post")) d.cardClass = $(a).attr("class");
    const medium = $(a).find(".elementor-post__thumbnail img").first();
    if (medium.length && d.featuredMedium == null) d.featuredMedium = imageFields($, medium as never);
  });
}

/* ---------------- settings ---------------- */

const home = docs.get("page-100")!;
docs.set("siteSettings", {
  _id: "siteSettings",
  _type: "siteSettings",
  title: "Alpha Hardscapes",
  siteUrl: "https://alphahardscapes.com",
  header: { _type: "reference", _ref: "template-61" },
  footer: { _type: "reference", _ref: "template-102" },
  popups: (home.popups as number[]).map((id) => ({ _type: "reference", _ref: `template-${id}`, _key: `p${id}` })),
  postsPerPage: 10,
  // Thank-you pages matched to each form by name (WordPress kept this in Elementor's form settings).
  forms: [
    ["Homepage Form", "100:7fa96b4", "/thank-you/"],
    ["Book a Quote Form", "4223:d854bea", "/thank-you-book-your-quote/"],
    ["Walkway Patio Form", "4206:d854bea", "/thank-you-walkway-patio/"],
    ["Retaining Wall Block Form", "4194:d854bea", "/thank-you-retaining-wall-block/"],
    ["Snow Removal Form", "4178:d854bea", "/thank-you-snow-removal/"],
    ["Retaining Walls Stone Form", "4168:d854bea", "/thank-you-retaining-walls-stone/"],
    ["Repairs & Maintenance Form", "4156:d854bea", "/thank-you-repairs-maintenance/"],
    ["Pavers Form", "4143:d854bea", "/thank-you-pavers/"],
    ["Retaining Walls Form", "4135:d854bea", "/thank-you-retaining-walls/"],
    ["Leaf Removal Form", "4111:d854bea", "/thank-you-leaf-removal/"],
    ["Landscaping Form", "4104:d854bea", "/thank-you-landscaping/"],
    ["Seasonal Clean Up Form", "4091:d854bea", "/thank-you-seasonal-clean-up/"],
    ["Quote Form (popup)", "377:d854bea", "/thank-you/"],
    ["Landing Page Form", "2279:6989098", "/thank-you-lp/"],
    ["Opt-in Form", "4233:6989098", "/optin-thank-you/"],
  ].map(([name, formKey, redirect]) => ({ _type: "formSetting", _key: formKey.replace(/\W/g, ""), name, formKey, redirect })),
});

mkdirSync(join(ROOT, "content"), { recursive: true });
mkdirSync(join(ROOT, "lib/generated"), { recursive: true });
// Referenced documents first, so the seed can be written in order.
const ORDER = ["author", "category", "elementorTemplate", "page", "post", "archivePage", "notFoundPage", "siteSettings"];
const sorted = [...docs.values()].sort((a, b) => ORDER.indexOf(String(a._type)) - ORDER.indexOf(String(b._type)));
writeFileSync(join(ROOT, "content/seed.json"), JSON.stringify(sorted, null, 1));
writeFileSync(join(ROOT, "lib/generated/shells.json"), JSON.stringify(Object.fromEntries(shells)));
console.log(`docs: ${docs.size}, shells: ${shells.size}, templates: ${templateIds.size}`);
console.log("widgets", stats.widgets, "rich", stats.rich, "rich fallback", stats.richFallback);
void key;
