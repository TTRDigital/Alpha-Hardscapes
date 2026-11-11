// Build: content (Sanity project 7ysj6im9, document type "landingPage") with the committed content/*.json as fallback -> dist/<slug>/index.html.
// Never fails the deploy because Sanity is down, empty or private: any problem logs a line and the committed content is used.
// Only reads. No token needed (public dataset); an optional SANITY_READ_TOKEN env var is used if the dataset is private.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { render } from "./render.mjs";
import { merge, normalizeSanityDoc } from "./merge.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const PROJECT = "7ysj6im9", DATASET = process.env.ALPHA_SANITY_DATASET || "production", API = "2025-02-19";
const OUT = join(ROOT, "dist");

async function fetchSanity() {
  if (process.env.SKIP_SANITY) return {};
  const q = encodeURIComponent('*[_type=="landingPage" && !(_id in path("drafts.**"))]');
  const headers = process.env.SANITY_READ_TOKEN ? { authorization: `Bearer ${process.env.SANITY_READ_TOKEN}` } : {};
  try {
    const host = process.env.SANITY_READ_TOKEN ? "api" : "apicdn";
    const r = await fetch(`https://${PROJECT}.${host}.sanity.io/v${API}/data/query/${DATASET}?query=${q}`, { headers, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { result } = await r.json();
    return Object.fromEntries((result || []).map((d) => [d.slug?.current, d]).filter(([k]) => k));
  } catch (e) {
    console.log(`[build] Sanity not used (${e.message}); building from content/*.json`);
    return {};
  }
}

const css = readFileSync(join(ROOT, "templates/base.css"), "utf8").trimEnd();
const icons = readFileSync(join(ROOT, "templates/icons.svg"), "utf8").trimEnd();
const script = readFileSync(join(ROOT, "templates/page.js"), "utf8").trimEnd();

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, "public"), OUT, { recursive: true });
cpSync(join(ROOT, "number.js"), join(OUT, "number.js"));

const remote = await fetchSanity();
for (const f of readdirSync(join(ROOT, "content")).filter((x) => x.endsWith(".json"))) {
  const base = JSON.parse(readFileSync(join(ROOT, "content", f), "utf8"));
  const doc = remote[base.slug];
  let page = base, from = "content/" + f;
  if (doc) {
    try { page = merge(base, normalizeSanityDoc(doc)); from = "Sanity"; } catch (e) { console.log(`[build] ${base.slug}: Sanity doc ignored (${e.message})`); }
  }
  mkdirSync(join(OUT, base.slug), { recursive: true });
  writeFileSync(join(OUT, base.slug, "index.html"), render(page, { css, icons, script }));
  console.log(`[build] ${base.slug}: ${from}`);
}
if (!existsSync(join(OUT, "outdoor/index.html"))) throw new Error("outdoor page missing");
