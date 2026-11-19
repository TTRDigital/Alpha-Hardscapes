/**
 * Smaller copies of the site's photos, served instead of the originals
 * (lib/site/tune.ts rewrites the page HTML, this script rewrites the
 * stylesheets). Measured on October 26, 2026 (Lighthouse, phone profile): hero
 * backgrounds of 1 to 6 MB (PNG photos at 2880 px) were the largest paint on
 * most pages, at 6 to 10 s.
 *
 * For every PNG, JPEG or WebP over 100 KB that a page, template or stylesheet
 * uses (content/seed.json, lib/generated/shells.json, public/assets/css):
 *   photo.png  -> photo.png.webp    same width and height, WebP quality 80
 *   photo.webp -> photo.min.webp    re-encoded at quality 75 (WordPress saved these close to lossless)
 * kept only when it is at least 25% smaller. Section backgrounds wider than
 * 1080 px also get photo.png.m.webp (photo.m.webp for a WebP), 1080 px wide at
 * quality 70, used on phones.
 *
 *   npm run webp      # idempotent: existing copies are kept
 *
 * Writes lib/generated/webp.json (original path -> copy, and copy -> phone copy)
 * and points the url()s in public/assets/css at the copies.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const PUBLIC = join(ROOT, "public");
const CSS_DIR = join(PUBLIC, "assets/css");
const OUT = join(ROOT, "lib/generated/webp.json");
const MIN_BYTES = 100 * 1024;
const PHONE_WIDTH = 1080;

const REF = /\/wp-content\/uploads\/[^"'\s()\\,<>]+?\.(?:png|jpe?g|webp)(?=["'\s()\\,<>&?]|$)/gi;

export function copyPath(src: string) {
  return /\.webp$/i.test(src) ? src.replace(/\.webp$/i, ".min.webp") : `${src}.webp`;
}

/** Paths an image is used under; a copy made by an earlier run counts as its original. */
function refs(text: string) {
  return (text.replace(/\\\//g, "/").match(REF) || []).map((r) => r.replace(/\.((?:png|jpe?g))(?:\.m)?\.webp$/i, ".$1").replace(/(?:\.min|\.m)\.webp$/i, ".webp"));
}

const sources = new Set<string>();
for (const file of [join(ROOT, "content/seed.json"), join(ROOT, "lib/generated/shells.json")]) refs(readFileSync(file, "utf8")).forEach((r) => sources.add(r));
const cssFiles = readdirSync(CSS_DIR).filter((f) => f.endsWith(".css"));
for (const f of cssFiles) refs(readFileSync(join(CSS_DIR, f), "utf8")).forEach((r) => sources.add(r));

const heroes = new Set(Object.values(JSON.parse(readFileSync(join(ROOT, "lib/generated/hero-images.json"), "utf8")) as Record<string, string>));

const images: Record<string, string> = {};
const phone: Record<string, string> = {};
let before = 0;
let after = 0;

for (const src of [...sources].sort()) {
  const file = join(PUBLIC, src);
  if (!existsSync(file) || statSync(file).size < MIN_BYTES) continue;
  const size = statSync(file).size;
  const target = copyPath(src);
  const out = join(PUBLIC, target);
  if (!existsSync(out)) {
    const quality = /\.webp$/i.test(src) ? 75 : 80;
    const buf = await sharp(file).rotate().webp({ quality, alphaQuality: 100, effort: 5 }).toBuffer();
    if (buf.length <= size * 0.75) writeFileSync(out, buf);
  }
  const used = existsSync(out) ? target : src;
  if (used === target) {
    images[src] = target;
    before += size;
    after += statSync(out).size;
  }

  if (heroes.has(src) || heroes.has(target)) {
    const { width = 0 } = await sharp(file).metadata();
    if (width > PHONE_WIDTH) {
      const small = `${target.replace(/(?:\.min)?\.webp$/, "")}.m.webp`;
      const smallFile = join(PUBLIC, small);
      if (!existsSync(smallFile)) writeFileSync(smallFile, await sharp(file).rotate().resize({ width: PHONE_WIDTH }).webp({ quality: 70, alphaQuality: 100, effort: 5 }).toBuffer());
      phone[used] = small;
    }
  }
}

// Stylesheets: url(/wp-content/...png) -> url(/wp-content/...png.webp)
let cssChanged = 0;
for (const f of cssFiles) {
  const path = join(CSS_DIR, f);
  const css = readFileSync(path, "utf8");
  const next = css.replace(REF, (m) => images[m] || m);
  if (next !== css) {
    writeFileSync(path, next);
    cssChanged++;
  }
}

writeFileSync(OUT, `${JSON.stringify({ images, phone }, null, 0)}\n`);
console.log(`${Object.keys(images).length} images: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB; ${Object.keys(phone).length} phone backgrounds; ${cssChanged} stylesheets updated -> ${OUT}`);
