#!/usr/bin/env node
/**
 * SiteGround (Apache + PHP) export.
 *
 * The site is a Next.js app that renders every URL on the server. SiteGround's
 * shared hosting has no Node server, so the deploy workflow
 * (.github/workflows/deploy-siteground.yml) builds the app, starts it on the
 * runner, and this script saves what it serves into out/:
 *
 *   - every page (all CMS paths, plus every internal link found on them,
 *     e.g. blog pagination) as <path>/index.html
 *   - sitemaps, robots.txt, the RSS feed and the 404 page
 *   - the Sanity Studio at /cms (a client-side app: HTML + /_next/static)
 *   - public/ (images, fonts, theme scripts at their WordPress URLs)
 *   - the forms: _sg/ajax.php answers the Elementor forms' POST to
 *     /wp-admin/admin-ajax.php like app/wp-admin/admin-ajax.php/route.ts does
 *   - .htaccess: the WordPress redirects (content/redirects.json), www ->
 *     main domain, headers, caching, and the "guess" redirect for unknown URLs
 *     (_sg/404.php, like lib/site/guess.ts)
 *
 * Usage: node scripts/siteground/export-static.mjs [http://127.0.0.1:3000]
 * Env: NEXT_PUBLIC_SITE_URL (the live origin), GHL_WEBHOOK_URL (optional
 * override of the webhook in lib/lead.ts).
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const BASE = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");
const OUT = join(ROOT, "out");
const ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
if (!ORIGIN) throw new Error("Set NEXT_PUBLIC_SITE_URL (e.g. https://example.com)");
const HOST = new URL(ORIGIN).host.replace(/^www\./, "");
const HERE = dirname(new URL(import.meta.url).pathname);

const log = (...a) => console.log("[export]", ...a);

async function get(path, opts = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(BASE + path, { redirect: "manual", ...opts });
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

function write(rel, body) {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

/** "/about-us/" -> "about-us/index.html" (decoded, like Apache maps URLs to files). */
function fileFor(path) {
  const parts = path.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
  return join(...parts, "index.html");
}

const SKIP = /^\/(wp-content|wp-includes|wp-admin|wp-json|_next|cms|_sg|static-export|search-results|search|xmlrpc\.php)(\/|$)|\/feed\/$/;

/** Internal page link -> canonical "/path/" or null. */
function internal(href) {
  if (!href || href.startsWith("#") || /^(mailto|tel|javascript|data|sms):/i.test(href)) return null;
  let url;
  try {
    url = new URL(href.replace(/&amp;/g, "&"), ORIGIN + "/");
  } catch {
    return null;
  }
  if (url.host.replace(/^www\./, "") !== HOST) return null;
  let p = url.pathname;
  if (url.search) return null; // query URLs (?s=, ?p=) are not static pages
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return null;
  if (!p.endsWith("/")) p += "/";
  if (SKIP.test(p)) return null;
  return p;
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  log("copying public/ and .next/static");
  cpSync(join(ROOT, "public"), OUT, { recursive: true });
  cpSync(join(ROOT, ".next/static"), join(OUT, "_next/static"), { recursive: true });

  const meta = await (await get("/static-export/")).json();
  log(`content from ${meta.fromCms ? "Sanity" : "the built-in copy"}: ${meta.paths.length} paths`);
  if (process.env.REQUIRE_CMS === "1" && !meta.fromCms) throw new Error("Sanity was not reachable: refusing to deploy the built-in copy");

  // ---- pages (CMS paths + crawl of internal links)
  const queue = ["/", ...meta.paths.map((p) => p.path)];
  const seen = new Set(queue);
  const pages = [];
  const redirected = [];
  const failed = [];
  while (queue.length) {
    const batch = queue.splice(0, 8);
    await Promise.all(
      batch.map(async (path) => {
        const res = await get(path);
        if (res.status >= 300 && res.status < 400) {
          redirected.push(path);
          return;
        }
        if (res.status !== 200) {
          failed.push(`${res.status} ${path}`);
          return;
        }
        const html = await res.text();
        write(fileFor(path), html);
        pages.push(path);
        for (const m of html.matchAll(/\shref=(["'])([^"']*)\1/gi)) {
          const p = internal(m[2]);
          if (p && !seen.has(p) && seen.size < 5000) {
            seen.add(p);
            queue.push(p);
          }
        }
      }),
    );
  }
  log(`${pages.length} pages saved, ${redirected.length} links were redirects, ${failed.length} not found`);
  for (const f of failed.slice(0, 40)) log("  not saved:", f);

  // ---- sitemaps, feed, robots
  const fixed = ["/sitemap_index.xml", "/page-sitemap.xml", "/post-sitemap.xml", "/category-sitemap.xml", "/author-sitemap.xml", "/robots.txt"];
  for (const p of fixed) {
    const res = await get(p);
    if (res.status === 200) write(p.slice(1), Buffer.from(await res.arrayBuffer()));
  }
  {
    const res = await get("/feed/");
    if (res.status === 200) write("feed.xml", Buffer.from(await res.arrayBuffer()));
  }

  // ---- 404 page
  {
    const res = await get("/zq-page-not-found-zq/");
    if (res.status === 404) write("404.html", await res.text());
    else log("404 page: unexpected status", res.status);
  }

  // ---- Sanity Studio
  {
    const res = await get("/cms/");
    const html = res.status === 200 ? await res.text() : res.status >= 300 && res.status < 400 ? await (await get("/cms")).text() : "";
    if (!html) throw new Error(`/cms answered ${res.status}`);
    write("cms/index.html", html);
  }

  // ---- forms
  const leadSrc = readFileSync(join(ROOT, "lib/lead.ts"), "utf8");
  const routeSrc = readFileSync(join(ROOT, "app/wp-admin/admin-ajax.php/route.ts"), "utf8");
  const webhook = (process.env.GHL_WEBHOOK_URL || "").trim() || (leadSrc.match(/https:\/\/services\.leadconnectorhq\.com\/hooks\/[^"'`\s]+/) || [""])[0];
  if (!webhook) throw new Error("No GoHighLevel webhook found (lib/lead.ts or GHL_WEBHOOK_URL)");
  const phone = (routeSrc.match(/Please call us at ([^."]+)/) || [, ""])[1];
  const formFields = JSON.parse(readFileSync(join(ROOT, "content/form-fields.json"), "utf8"));
  write(
    "_sg/forms.json",
    JSON.stringify({ webhook, phone, labels: formFields, forms: meta.forms || [] }),
  );
  write("_sg/paths.json", JSON.stringify(meta.paths.map((p) => ({ path: p.path, type: p.type }))));
  cpSync(join(HERE, "ajax.php"), join(OUT, "_sg/ajax.php"));
  cpSync(join(HERE, "404.php"), join(OUT, "_sg/404.php"));
  if (meta.search) {
    write("_sg/search.json", JSON.stringify(meta.search));
    cpSync(join(HERE, "search.php"), join(OUT, "_sg/search.php"));
    log(`search: ${meta.search.index.length} pages indexed`);
  }
  write("_sg/.htaccess", '<FilesMatch "\\.json$">\n  Require all denied\n</FilesMatch>\n');

  // ---- .htaccess
  const redirects = JSON.parse(readFileSync(join(ROOT, "content/redirects.json"), "utf8"));
  write(".htaccess", htaccess(redirects, Boolean(meta.search)));

  log("done:", OUT);
}

const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\ ]/g, (c) => (c === " " ? "\\s" : "\\" + c));

function htaccess(rows, hasSearch) {
  const lines = [];
  const plain = rows.filter((r) => !r.query);
  const withQuery = rows.filter((r) => r.query);
  for (const r of withQuery) {
    for (const [k, v] of Object.entries(r.query)) lines.push(`RewriteCond %{QUERY_STRING} (^|&)${reEscape(k)}=${reEscape(String(v))}(&|$)`);
    const src = decodeURIComponent(r.source).replace(/^\//, "").replace(/\/$/, "");
    lines.push(`RewriteRule ^${src ? reEscape(src) + "/?" : ""}$ ${r.destination}? [R=301,L]`);
  }
  for (const r of plain) {
    let src;
    try {
      src = decodeURIComponent(r.source);
    } catch {
      src = r.source;
    }
    src = src.replace(/^\//, "").replace(/\/$/, "");
    if (!src) continue;
    lines.push(`RewriteRule ^${reEscape(src)}/?$ ${r.destination.replace(/ /g, "%20")} [R=301,L,NE]`);
  }
  const template = readFileSync(join(HERE, "htaccess.txt"), "utf8");
  const search = hasSearch
    ? [
        "# Site search (/?s=, /page/2/?s=, /search/words/)",
        "RewriteCond %{QUERY_STRING} (^|&)s(=|&|$)",
        "RewriteRule ^(page/[0-9]+/?)?$ /_sg/search.php [L,END]",
        "RewriteRule ^search/[^/]+/?(page/[0-9]+/?)?$ /_sg/search.php [L,END]",
      ].join("\n")
    : "";
  return template.replace("{{SEARCH}}", search).replaceAll("{{HOST_RE}}", reEscape(HOST)).replaceAll("{{HOST}}", HOST).replace("{{REDIRECTS}}", lines.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
