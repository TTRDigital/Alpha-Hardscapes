/**
 * Blur placeholders for the blog photos (the featured image of every post and
 * the section photos): a 24 px WebP of each file as a data URI, written to
 * lib/generated/blog-placeholders.json. The post page paints it behind the hero
 * and the section photos while the real file loads, like next/image's
 * placeholder="blur". Run it again after adding posts or section photos.
 *
 *   npm run blog-images
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const out = join(ROOT, "lib/generated/blog-placeholders.json");

type Img = { src?: string; srcset?: string } | null | undefined;
type Doc = { _type: string; featuredImage?: Img; sectionImages?: { image?: Img }[] };

/** The largest file WordPress generated for an image (its srcset), or the src itself: what the blog renders. */
function largest(img: Img): string | null {
  if (!img) return null;
  let best: { src: string; width: number } | null = img.src ? { src: img.src, width: 0 } : null;
  for (const m of (img.srcset || "").matchAll(/(\S+)\s+(\d+)w/g)) {
    const w = Number(m[2]);
    if (!best || w > best.width) best = { src: m[1], width: w };
  }
  return best?.src || null;
}

const docs = JSON.parse(readFileSync(join(ROOT, "content/seed.json"), "utf8")) as Doc[];
const sources = new Set<string>();
for (const d of docs) {
  if (d._type !== "post") continue;
  const f = largest(d.featuredImage);
  if (f) sources.add(f);
  for (const s of d.sectionImages || []) {
    const src = largest(s.image);
    if (src) sources.add(src);
  }
}

const map: Record<string, string> = {};
for (const src of [...sources].sort()) {
  if (!src.startsWith("/wp-content/")) continue;
  const file = join(ROOT, "public", src);
  if (!existsSync(file)) {
    console.warn(`missing ${src}`);
    continue;
  }
  const buf = await sharp(file).resize({ width: 24, withoutEnlargement: true }).webp({ quality: 40 }).toBuffer();
  map[src] = `data:image/webp;base64,${buf.toString("base64")}`;
}
writeFileSync(out, `${JSON.stringify(map, null, 0)}\n`);
console.log(`${Object.keys(map).length} placeholders -> ${out}`);
