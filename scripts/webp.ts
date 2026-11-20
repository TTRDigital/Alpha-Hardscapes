/**
 * Smaller copies of the site's photos, served instead of the originals
 * (lib/site/tune.ts rewrites the page HTML, this script rewrites the
 * stylesheets). Measured on October 26, 2026 (Lighthouse, phone profile): hero
 * backgrounds of 1 to 6 MB (PNG photos at 2880 px) were the largest paint on
 * most pages, at 6 to 10 s.
 *
 * For every PNG, JPEG or WebP over 20 KB (100 KB until Nov 20, 2026) that a page, template or stylesheet
 * uses (content/seed.json, lib/generated/shells.json, public/assets/css):
 *   photo.png  -> photo.png.webp    same width and height, WebP quality 80
 *   photo.webp -> photo.min.webp    re-encoded at quality 75 (WordPress saved these close to lossless)
 * kept only when it is at least 25% smaller. Section backgrounds over 60 KB
 * also get photo.png.p.webp (photo.p.webp for a WebP), at most 828 px wide (a
 * phone screen at 2x) and quality 60, used on phones when at least 20% smaller.
 * The 1080 px / quality 70 phone copies of October (.m.webp, 100 to 190 KB) were
 * the largest download before the first paint on phones (Nov 20 sweep, TTR-2513).
 *
 *   npm run webp      # idempotent: existing copies are kept
 *
 * Photos over 300 KB and wider than 1200 px also get photo.w1080.webp (1080 px,
 * quality 72), added to the image's srcset at render time, so phones at 2x to 3x
 * download it instead of the 1440 to 2560 px original; desktops keep the original.
 *
 * Writes lib/generated/webp.json (original path -> copy, copy -> phone copy, copy -> 1080 px copy)
 * and points the url()s in public/assets/css at the copies.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const PUBLIC = join(ROOT, "public");
const CSS_DIR = join(PUBLIC, "assets/css");
const OUT = join(ROOT, "lib/generated/webp.json");
const MIN_BYTES = 20 * 1024;
const PHONE_WIDTH = 828;
const PHONE_MIN_BYTES = 60 * 1024;

const REF = /\/wp-content\/uploads\/[^"'\s()\\,<>]+?\.(?:png|jpe?g|webp)(?=["'\s()\\,<>&?]|$)/gi;

export function copyPath(src: string) {
  return /\.webp$/i.test(src) ? src.replace(/\.webp$/i, ".min.webp") : `${src}.webp`;
}

/** Paths an image is used under; a copy made by an earlier run counts as its original. */
function refs(text: string) {
  return (text.replace(/\\\//g, "/").match(REF) || []).map((r) => r.replace(/\.((?:png|jpe?g))(?:\.m|\.p|\.w1080)?\.webp$/i, ".$1").replace(/(?:\.min|\.m|\.p|\.w1080)\.webp$/i, ".webp"));
}

const sources = new Set<string>();
for (const file of [join(ROOT, "content/seed.json"), join(ROOT, "lib/generated/shells.json")]) refs(readFileSync(file, "utf8")).forEach((r) => sources.add(r));
const cssFiles = readdirSync(CSS_DIR).filter((f) => f.endsWith(".css"));
for (const f of cssFiles) refs(readFileSync(join(CSS_DIR, f), "utf8")).forEach((r) => sources.add(r));

const heroes = new Set(Object.values(JSON.parse(readFileSync(join(ROOT, "lib/generated/hero-images.json"), "utf8")) as Record<string, string>));

const images: Record<string, string> = {};
const phone: Record<string, string> = {};
/** Full-size photo -> 1080 px copy, added to its srcset so phones stop downloading the 1440 to 2560 px file (TTR-2513). */
const mid: Record<string, string> = {};
const MID_WIDTH = 1080;
const MID_MIN_BYTES = 300 * 1024;
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

  // Photos over 300 KB wider than 1200 px: a 1080 px copy at quality 72 for the srcset (phones at 2x to 3x).
  {
    const usedFile = join(PUBLIC, used);
    if (statSync(usedFile).size >= MID_MIN_BYTES) {
      const { width = 0 } = await sharp(file).metadata();
      if (width > 1200) {
        const copy = `${used.replace(/(?:\.min)?\.webp$/i, "")}.w1080.webp`;
        const copyFile = join(PUBLIC, copy);
        if (!existsSync(copyFile)) writeFileSync(copyFile, await sharp(file).rotate().resize({ width: MID_WIDTH }).webp({ quality: 72, effort: 5 }).toBuffer());
        mid[used] = copy;
      }
    }
  }

  if (heroes.has(src) || heroes.has(target)) {
    const usedFile = join(PUBLIC, used);
    const usedSize = statSync(usedFile).size;
    if (usedSize >= PHONE_MIN_BYTES) {
      const small = `${used.replace(/(?:\.min)?\.webp$/i, "")}.p.webp`;
      const smallFile = join(PUBLIC, small);
      if (!existsSync(smallFile)) {
        const { width = 0 } = await sharp(file).metadata();
        writeFileSync(smallFile, await sharp(file).rotate().resize({ width: Math.min(width, PHONE_WIDTH) }).webp({ quality: 60, alphaQuality: 100, effort: 6 }).toBuffer());
      }
      if (statSync(smallFile).size <= usedSize * 0.8) phone[used] = small;
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

writeFileSync(OUT, `${JSON.stringify({ images, phone, mid }, null, 0)}\n`);
console.log(`${Object.keys(images).length} images: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB; ${Object.keys(phone).length} phone backgrounds; ${cssChanged} stylesheets updated -> ${OUT}`);
